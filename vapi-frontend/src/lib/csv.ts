/**
 * Small dependency-free parser for lead / contact list uploads. Accepts CSV
 * (with or without a header row) or a JSON array, and maps common column names
 * onto the fields the campaign APIs expect.
 */

export interface ParsedLead {
  phone?: string;
  email?: string;
  name?: string;
}

export interface ParseResult {
  rows: ParsedLead[];
  detected: 'csv' | 'json';
  skipped: number;
}

const PHONE_KEYS = ['phone', 'number', 'phonenumber', 'phone_number', 'mobile', 'tel'];
const EMAIL_KEYS = ['email', 'e-mail', 'email_address', 'mail'];
const NAME_KEYS = ['name', 'fullname', 'full_name', 'contact', 'firstname', 'first_name'];

function pick(row: Record<string, string>, keys: string[]): string | undefined {
  for (const key of Object.keys(row)) {
    if (keys.includes(key.trim().toLowerCase())) {
      const value = row[key]?.trim();
      if (value) return value;
    }
  }
  return undefined;
}

/** Split a single CSV line honoring double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

const HEADER_TOKENS = [...PHONE_KEYS, ...EMAIL_KEYS, ...NAME_KEYS];

function looksLikeHeader(cells: string[]): boolean {
  return cells.some((c) => HEADER_TOKENS.includes(c.trim().toLowerCase()));
}

export function parseLeadFile(content: string): ParseResult {
  const trimmed = content.trim();
  if (trimmed.length === 0) return { rows: [], detected: 'csv', skipped: 0 };

  // JSON array of objects.
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const rows: ParsedLead[] = [];
      let skipped = 0;
      for (const entry of arr) {
        if (entry && typeof entry === 'object') {
          const record = Object.fromEntries(
            Object.entries(entry as Record<string, unknown>).map(([k, v]) => [k, String(v ?? '')]),
          );
          const row: ParsedLead = {
            phone: pick(record, PHONE_KEYS),
            email: pick(record, EMAIL_KEYS),
            name: pick(record, NAME_KEYS),
          };
          if (row.phone || row.email) rows.push(row);
          else skipped += 1;
        } else {
          skipped += 1;
        }
      }
      return { rows, detected: 'json', skipped };
    } catch {
      // Fall through to CSV parsing.
    }
  }

  const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], detected: 'csv', skipped: 0 };

  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = looksLikeHeader(firstCells);
  const header = hasHeader
    ? firstCells.map((c) => c.toLowerCase())
    : firstCells.map((_, i) => `col${i}`);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const rows: ParsedLead[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cells[i] ?? '';
    });

    let row: ParsedLead;
    if (hasHeader) {
      row = {
        phone: pick(record, PHONE_KEYS),
        email: pick(record, EMAIL_KEYS),
        name: pick(record, NAME_KEYS),
      };
    } else {
      // Headerless: infer by content — an @ means email, digits mean phone.
      row = {};
      for (const cell of cells) {
        const value = cell.trim();
        if (!value) continue;
        if (value.includes('@')) row.email = value;
        else if (/[\d+]/.test(value) && value.replace(/\D/g, '').length >= 7) row.phone = value;
        else if (!row.name) row.name = value;
      }
    }

    if (row.phone || row.email) rows.push(row);
    else skipped += 1;
  }

  return { rows, detected: 'csv', skipped };
}

/** Normalize a phone string toward E.164-ish (keep leading +, strip the rest). */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const plus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return plus ? `+${digits}` : digits;
}
