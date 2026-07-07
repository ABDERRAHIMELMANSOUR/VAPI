import { providers } from '../config/providers';
import { env } from '../config/env';
import { createLogger } from '../utils/logger';

const log = createLogger('TwilioService');

const TWILIO_API_BASE = 'https://api.twilio.com/2010-04-01';

export interface TwilioCredentials {
  accountSid: string;
  authToken: string;
}

export interface VerifiedNumber {
  number: string;
  friendlyName: string | null;
  twilioSid: string | null;
  capabilities: { voice: boolean; sms: boolean };
  /** False when verification was skipped (e.g. Twilio unreachable offline). */
  verified: boolean;
}

export interface PlaceCallParams {
  to: string;
  from: string;
  agentId?: string;
  userId?: string;
  credentials?: TwilioCredentials;
}

export interface PlaceCallResult {
  sid: string;
  status: string;
  simulated: boolean;
}

/**
 * Thin Twilio REST client for the two operations the platform needs:
 * verifying/importing a phone number and placing an outbound call.
 *
 * Consistent with the rest of the backend, it degrades gracefully: when Twilio
 * is unreachable or credentials are absent, verification is marked unverified
 * and outbound calls are simulated, so the flow works end-to-end offline.
 */
export class TwilioService {
  /**
   * Confirm a number belongs to the given Twilio account and read its
   * capabilities. Throws on definitive auth/ownership failures; falls back to
   * an unverified record only when Twilio cannot be reached.
   */
  async verifyNumber(
    credentials: TwilioCredentials,
    number: string,
  ): Promise<VerifiedNumber> {
    const url =
      `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(credentials.accountSid)}` +
      `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Authorization: basicAuth(credentials) },
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // Network/timeout: accept the number as unverified rather than blocking.
      log.warn('Twilio unreachable during verification; importing unverified', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        number,
        friendlyName: null,
        twilioSid: null,
        capabilities: { voice: true, sms: true },
        verified: false,
      };
    }

    if (res.status === 401 || res.status === 403) {
      throw new TwilioAuthError('Twilio authentication failed. Check the Account SID and Auth Token.');
    }
    if (!res.ok) {
      throw new TwilioAuthError(`Twilio API error (${res.status}). Please try again.`);
    }

    const data = (await res.json().catch(() => null)) as {
      incoming_phone_numbers?: Array<{
        phone_number: string;
        friendly_name?: string;
        sid?: string;
        capabilities?: { voice?: boolean; sms?: boolean };
      }>;
    } | null;

    const match = data?.incoming_phone_numbers?.[0];
    if (!match) {
      throw new TwilioNotFoundError(
        'That number was not found in this Twilio account. Buy or verify it in Twilio first.',
      );
    }

    return {
      number: match.phone_number,
      friendlyName: match.friendly_name ?? null,
      twilioSid: match.sid ?? null,
      capabilities: {
        voice: match.capabilities?.voice ?? true,
        sms: match.capabilities?.sms ?? false,
      },
      verified: true,
    };
  }

  /**
   * Place an outbound call. Twilio requests the TwiML URL when the callee
   * answers, which connects the Media Stream to our agent. Simulated when no
   * usable credentials are available.
   */
  async placeCall(params: PlaceCallParams): Promise<PlaceCallResult> {
    const credentials = params.credentials ?? this.envCredentials();

    const twimlUrl = new URL(`${env.PUBLIC_BASE_URL}/voice/incoming`);
    if (params.agentId) twimlUrl.searchParams.set('agentId', params.agentId);
    if (params.userId) twimlUrl.searchParams.set('userId', params.userId);

    if (!credentials) {
      log.warn('No Twilio credentials; simulating outbound call', {
        to: params.to,
        from: params.from,
      });
      return { sid: `SIM${randomId()}`, status: 'queued', simulated: true };
    }

    const body = new URLSearchParams({
      To: params.to,
      From: params.from,
      Url: twimlUrl.toString(),
    });

    let res: Response;
    try {
      res = await fetch(
        `${TWILIO_API_BASE}/Accounts/${encodeURIComponent(credentials.accountSid)}/Calls.json`,
        {
          method: 'POST',
          headers: {
            Authorization: basicAuth(credentials),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (err) {
      log.error('Twilio call request failed; simulating', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { sid: `SIM${randomId()}`, status: 'queued', simulated: true };
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new TwilioAuthError(`Twilio failed to place the call (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = (await res.json().catch(() => null)) as { sid?: string; status?: string } | null;
    return {
      sid: data?.sid ?? `CA${randomId()}`,
      status: data?.status ?? 'queued',
      simulated: false,
    };
  }

  private envCredentials(): TwilioCredentials | null {
    if (providers.twilio.accountSid && providers.twilio.authToken) {
      return {
        accountSid: providers.twilio.accountSid,
        authToken: providers.twilio.authToken,
      };
    }
    return null;
  }
}

export class TwilioAuthError extends Error {}
export class TwilioNotFoundError extends Error {}

function basicAuth({ accountSid, authToken }: TwilioCredentials): string {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

export const twilioService = new TwilioService();
