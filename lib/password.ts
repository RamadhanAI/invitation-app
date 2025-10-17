// lib/password.ts
import * as crypto from 'node:crypto';


// Scheme tag (lets you rotate later if needed)
const ALG = 'scrypt2';

// scrypt params (server-friendly)
const N = 1 << 15; // 32768
const r = 8;
const p = 1;
const KEYLEN = 32;  // bytes
const SALT_LEN = 16;

// Make a Uint8Array view from a Buffer (no copies)
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
function scryptU8(password: string, salt: Uint8Array, keylen = KEYLEN): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, { N, r, p }, (err, dk) => {
      if (err) return reject(err);
      resolve(u8(dk as Buffer));
    });
  });
}

/**
 * Hash a secret with scrypt and return a compact string:
 *   "scrypt2$<base64url(version||salt||derived)>"
 * where version is 1 byte = 0x01
 */
export async function hashSecret(secret: string): Promise<string> {
  const saltBuf = crypto.randomBytes(SALT_LEN); // Buffer from Node
  const salt = u8(saltBuf);                     // Uint8Array view

  const derived = await scryptU8(secret, salt, KEYLEN); // Uint8Array

  // Build payload as Uint8Array only (no Buffer APIs)
  const out = new Uint8Array(1 + SALT_LEN + KEYLEN);
  out[0] = 1; // version
  out.set(salt, 1);
  out.set(derived, 1 + SALT_LEN);

  return `${ALG}$${b64urlEncode(out)}`;
}

/**
 * Verify a secret; returns true/false.
 * Only accepts hashes produced by this module (prefix "scrypt2$").
 */
export async function verifySecret(secret: string, stored?: string | null): Promise<boolean> {
  if (!stored || !stored.startsWith(`${ALG}$`)) return false;

  const payload = stored.slice(ALG.length + 1); // after "scrypt2$"
  let bytes: Uint8Array;
  try {
    bytes = b64urlDecode(payload); // Uint8Array
  } catch {
    return false;
  }

  if (bytes.length !== 1 + SALT_LEN + KEYLEN) return false;
  if (bytes[0] !== 1) return false; // version

  const salt = bytes.subarray(1, 1 + SALT_LEN);                     // Uint8Array
  const expected = bytes.subarray(1 + SALT_LEN, 1 + SALT_LEN + KEYLEN);

  const derived = await scryptU8(secret, salt, KEYLEN);             // Uint8Array

  if (derived.byteLength !== expected.byteLength) return false;
  // timingSafeEqual accepts ArrayBufferView; Uint8Array is perfect
  return crypto.timingSafeEqual(derived, expected);
}
