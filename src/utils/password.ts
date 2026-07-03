import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Hash a password with a per-user random salt using scrypt (no dependency). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

/** Constant-time verification of a password against a stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, key] = stored.split(':');
  if (!salt || !key) return false;
  const derived = (await scryptAsync(password, salt, KEYLEN)) as Buffer;
  const keyBuffer = Buffer.from(key, 'hex');
  if (keyBuffer.length !== derived.length) return false;
  return timingSafeEqual(keyBuffer, derived);
}
