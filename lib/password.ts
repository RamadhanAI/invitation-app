// lib/password.ts
import * as crypto from 'node:crypto';

/**
 * GOALS:
 * - Hash station secrets (scanner keys) in a way that's safe but cheap enough
 *   that Vercel/serverless doesn't scream.
 * - Be able to verify old hashes (bcrypt, older scrypt formats) so existing
 *   scanners in the field don't break.
 *
 * FORMAT WE WRITE NOW:
 *   scrypt2$<base64url(version||salt||derived)>
 *
 * version: 1 byte (0x01)
 * salt:    16 bytes random
 * derived: 32-byte scrypt output
 *
 * PARAMS:
 *   N = 16384 (2**14)
 *   r = 8
 *   p = 1
 *
 * We explicitly pass maxmem to scrypt so prod doesn't explode with:
 * "Invalid scrypt params ... memory limit exceeded".
 */

// --- Tunable parameters for new hashes ---
const ALG = 'scrypt2';
const VERSION = 1;

const N = 1 << 14; // 16384
const r = 8;
const p = 1;

const KEYLEN = 32;   // derived key length (bytes)
const SALT_LEN = 16; // bytes
const MAXMEM = 32 * 1024 * 1024; // 32 MB cap so serverless is happy

// Make a Uint8Array view from a Buffer without copying
function u8(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

// Base64url encode/decode helpers for Uint8Array
function b64urlEncode(u: Uint8Array): string {
  return Buffer.from(u.buffer, u.byteOffset, u.byteLength).toString('base64url');
}
function b64urlDecode(s: string): Uint8Array {
  const b = Buffer.from(s, 'base64url');
  return u8(b);
}

// Promise wrapper for crypto.scrypt that returns Uint8Array
function scryptDerive(
  password: string,
  salt: Uint8Array,
  keylen = KEYLEN,
  params?: { N?: number; r?: number; p?: number; maxmem?: number }
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      salt,
      keylen,
      {
        N: params?.N ?? N,
        r: params?.r ?? r,
        p: params?.p ?? p,
        maxmem: params?.maxmem ?? MAXMEM,
      },
      (err, dk) => {
        if (err) return reject(err);
        resolve(u8(dk as Buffer));
      }
    );
  });
}

/**
 * hashSecret(secretPlain)
 * Produces "scrypt2$<base64url(...)>".
 */
export async function hashSecret(secretPlain: string): Promise<string> {
  // random salt
  const saltBuf = crypto.randomBytes(SALT_LEN);
  const salt = u8(saltBuf);

  // derive key with our chosen params
  const derived = await scryptDerive(secretPlain, salt);

  // Build payload bytes: [version (1 byte)] [salt (16 bytes)] [derived (32 bytes)]
  const out = new Uint8Array(1 + SALT_LEN + KEYLEN);
  out[0] = VERSION;
  out.set(salt, 1);
  out.set(derived, 1 + SALT_LEN);

  return `${ALG}$${b64urlEncode(out)}`;
}

/**
 * verifySecret(secretPlain, storedHash)
 *
 * Returns true if the provided secret matches the stored hash.
 *
 * Supports:
 *   - "scrypt2$..." (our new format)
 *   - "scrypt$..."  (legacy scrypt-with-params format if you had one before)
 *   - bcrypt hashes starting with "$2"
 *
 * Anything else -> false (and authenticateStationScanner will then try plaintext fallback).
 */
export async function verifySecret(
  secretPlain: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  if (!storedHash) return false;

  // 1. New format: scrypt2$
  if (storedHash.startsWith('scrypt2$')) {
    const payloadB64 = storedHash.slice('scrypt2$'.length);
    let bytes: Uint8Array;
    try {
      bytes = b64urlDecode(payloadB64);
    } catch {
      return false;
    }

    // bytes = [version (1 byte)] [salt (16)] [derived (32)]
    if (bytes.length !== 1 + SALT_LEN + KEYLEN) return false;
    if (bytes[0] !== VERSION) return false;

    const salt = bytes.subarray(1, 1 + SALT_LEN);
    const expected = bytes.subarray(1 + SALT_LEN, 1 + SALT_LEN + KEYLEN);

    const derived = await scryptDerive(secretPlain, salt, KEYLEN, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    });

    if (derived.byteLength !== expected.byteLength) return false;
    return crypto.timingSafeEqual(derived, expected);
  }

  // 2. Older format: scrypt$N$r$p$saltB64$keyB64
  // We keep this so we don't break any stations created before today's deployment.
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    // ["scrypt", N, r, p, saltB64, keyB64]
    if (parts.length !== 6) return false;
    const oldN = parseInt(parts[1], 10);
    const oldR = parseInt(parts[2], 10);
    const oldP = parseInt(parts[3], 10);
    const saltB64 = parts[4];
    const keyB64 = parts[5];

    if (
      !Number.isFinite(oldN) ||
      !Number.isFinite(oldR) ||
      !Number.isFinite(oldP)
    ) {
      return false;
    }

    let saltBytes: Uint8Array;
    try {
      saltBytes = b64urlDecode(saltB64);
    } catch {
      return false;
    }

    const derived = await scryptDerive(secretPlain, saltBytes, 64, {
      N: oldN,
      r: oldR,
      p: oldP,
      maxmem: MAXMEM,
    });
    const derivedB64 = Buffer.from(
      derived.buffer,
      derived.byteOffset,
      derived.byteLength
    ).toString('base64url');

    const keyBuf = Buffer.from(keyB64, 'utf8');
    const cmpBuf = Buffer.from(derivedB64, 'utf8');
    if (keyBuf.length !== cmpBuf.length) return false;
    return crypto.timingSafeEqual(keyBuf, cmpBuf);
  }

  // 3. bcrypt fallback: "$2a$" / "$2b$" / "$2y$"
  if (storedHash.startsWith('$2')) {
    // Lazy-load bcryptjs so we don't force it into edge/runtime unless needed.
    const bcrypt = await import('bcryptjs');
    try {
      return await bcrypt.compare(secretPlain, storedHash);
    } catch {
      return false;
    }
  }

  // 4. Unknown format.
  // We'll return false and let authenticateStationScanner()
  // do its final plaintext safeEqual fallback for legacy rows.
  return false;
}
// --- Password helpers (OrganizerUser / admin passwords) ---
// We re-use the same strong hashing scheme as scanner secrets.
// Keeps one hashing standard across the whole app.

export async function hashPassword(passwordPlain: string): Promise<string> {
  return hashSecret(passwordPlain);
}

export async function verifyPassword(
  passwordPlain: string,
  storedHash: string | null | undefined
): Promise<boolean> {
  return verifySecret(passwordPlain, storedHash);
}
