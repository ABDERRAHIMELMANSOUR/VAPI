import { createConnection, type Socket } from 'net';
import { connect as tlsConnect } from 'tls';
import { providers } from '../config/providers';
import { createLogger } from '../utils/logger';
import type { EmailMessage, EmailSendResult } from '../types';

const log = createLogger('EmailService');

/**
 * Transactional + bulk email delivery. Supports three drivers selected via
 * EMAIL_PROVIDER:
 *   - "resend": Resend HTTP API
 *   - "smtp":   raw SMTP (STARTTLS/implicit TLS), no external dependency
 *   - "console": logs the message (default when unconfigured)
 */
export class EmailService {
  private readonly provider = providers.email.provider;
  private readonly defaultFrom = providers.email.from;

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const from = message.from ?? this.defaultFrom;
    const enriched: Required<Pick<EmailMessage, 'from' | 'to' | 'subject' | 'html'>> &
      EmailMessage = { ...message, from };

    switch (this.provider) {
      case 'resend':
        return this.sendViaResend(enriched);
      case 'smtp':
        return this.sendViaSmtp(enriched);
      default:
        return this.sendViaConsole(enriched);
    }
  }

  /**
   * Send the same message to many recipients with bounded concurrency.
   * Returns a per-recipient result so callers can persist delivery state.
   */
  async sendBulk(
    recipients: string[],
    message: Omit<EmailMessage, 'to'>,
    concurrency = 5,
  ): Promise<Array<{ to: string; result?: EmailSendResult; error?: string }>> {
    const results: Array<{ to: string; result?: EmailSendResult; error?: string }> = [];
    const queue = [...recipients];

    const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
      for (;;) {
        const to = queue.shift();
        if (!to) break;
        try {
          const result = await this.send({ ...message, to });
          results.push({ to, result });
        } catch (err) {
          results.push({ to, error: err instanceof Error ? err.message : String(err) });
        }
      }
    });

    await Promise.all(workers);
    return results;
  }

  // ── Resend ────────────────────────────────────────────────────────────────

  private async sendViaResend(message: EmailMessage): Promise<EmailSendResult> {
    const apiKey = providers.email.resend.apiKey;
    if (!apiKey) {
      log.warn('EMAIL_PROVIDER=resend but RESEND_API_KEY is missing; using console fallback');
      return this.sendViaConsole(message);
    }
    const res = await fetch(`${providers.email.resend.baseUrl}/emails`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: message.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      throw new Error(`Resend ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { id: string };
    log.info('Email sent via Resend', { to: message.to, id: data.id });
    return { id: data.id, provider: 'resend', accepted: true };
  }

  // ── SMTP (dependency-free) ──────────────────────────────────────────────────

  private async sendViaSmtp(message: EmailMessage): Promise<EmailSendResult> {
    const { host, port, user, pass } = providers.email.smtp;
    if (!host) {
      log.warn('EMAIL_PROVIDER=smtp but SMTP_HOST is missing; using console fallback');
      return this.sendViaConsole(message);
    }

    const client = new SmtpClient({ host, port, user, pass });
    const id = await client.sendMail(message);
    log.info('Email sent via SMTP', { to: message.to, id });
    return { id, provider: 'smtp', accepted: true };
  }

  // ── Console (offline default) ───────────────────────────────────────────────

  private sendViaConsole(message: EmailMessage): EmailSendResult {
    const id = `console_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    log.info('Email (console driver)', {
      id,
      from: message.from,
      to: message.to,
      subject: message.subject,
      preview: message.text ?? stripHtml(message.html).slice(0, 200),
    });
    return { id, provider: 'console', accepted: true };
  }
}

/**
 * Minimal SMTP client implementing enough of RFC 5321 to submit a message with
 * AUTH LOGIN over STARTTLS or implicit TLS. Avoids pulling in nodemailer while
 * still performing a real network send when SMTP is configured.
 */
class SmtpClient {
  constructor(
    private readonly opts: { host: string; port: number; user?: string; pass?: string },
  ) {}

  async sendMail(message: EmailMessage): Promise<string> {
    const implicitTls = this.opts.port === 465;
    let socket: Socket = implicitTls
      ? tlsConnect({ host: this.opts.host, port: this.opts.port, servername: this.opts.host })
      : createConnection({ host: this.opts.host, port: this.opts.port });

    const io = new SmtpIO(socket);
    try {
      await io.expect(220);
      await io.command(`EHLO ${hostname()}`, 250);

      if (!implicitTls) {
        await io.command('STARTTLS', 220);
        socket = tlsConnect({ socket, servername: this.opts.host });
        io.rebind(socket);
        await io.command(`EHLO ${hostname()}`, 250);
      }

      if (this.opts.user && this.opts.pass) {
        await io.command('AUTH LOGIN', 334);
        await io.command(Buffer.from(this.opts.user).toString('base64'), 334);
        await io.command(Buffer.from(this.opts.pass).toString('base64'), 235);
      }

      const fromAddr = extractAddress(message.from ?? '');
      await io.command(`MAIL FROM:<${fromAddr}>`, 250);
      await io.command(`RCPT TO:<${extractAddress(message.to)}>`, 250);
      await io.command('DATA', 354);

      const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${hostname()}>`;
      const payload = buildMimeMessage(message, messageId);
      await io.command(`${payload}\r\n.`, 250);
      await io.command('QUIT', 221).catch(() => undefined);
      return messageId;
    } finally {
      socket.destroy();
    }
  }
}

/** Promise-based line reader/writer for an SMTP socket. */
class SmtpIO {
  private buffer = '';
  private resolvers: Array<(line: string) => void> = [];

  constructor(private socket: Socket) {
    this.attach();
  }

  rebind(socket: Socket): void {
    this.socket = socket;
    this.buffer = '';
    this.attach();
  }

  private attach(): void {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk: string) => {
      this.buffer += chunk;
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, idx + 1);
        this.buffer = this.buffer.slice(idx + 1);
        // Multi-line replies use "250-" for continuation and "250 " for the last.
        if (/^\d{3} /.test(line.trimStart()) || line.length > 0) {
          const resolver = this.resolvers.shift();
          if (resolver) resolver(line.trim());
        }
      }
    });
  }

  private readLine(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('SMTP read timeout')), 15000);
      this.resolvers.push((line) => {
        clearTimeout(timeout);
        resolve(line);
      });
    });
  }

  async expect(code: number): Promise<string> {
    const line = await this.readLine();
    if (!line.startsWith(String(code))) {
      throw new Error(`SMTP: expected ${code} but got "${line}"`);
    }
    return line;
  }

  async command(cmd: string, expectCode: number): Promise<string> {
    this.socket.write(`${cmd}\r\n`);
    return this.expect(expectCode);
  }
}

function buildMimeMessage(message: EmailMessage, messageId: string): string {
  const boundary = `b_${Math.random().toString(36).slice(2)}`;
  const headers = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].join('\r\n');

  const text = message.text ?? stripHtml(message.html);
  const body = [
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(text),
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    dotStuff(message.html),
    `--${boundary}--`,
  ].join('\r\n');

  return `${headers}\r\n\r\n${body}`;
}

/** RFC 5321 dot-stuffing: lines beginning with "." must be escaped in DATA. */
function dotStuff(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => (line.startsWith('.') ? `.${line}` : line))
    .join('\r\n');
}

function extractAddress(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return (match ? match[1] : input).trim();
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hostname(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('os').hostname() || 'localhost';
  } catch {
    return 'localhost';
  }
}

export const emailService = new EmailService();
