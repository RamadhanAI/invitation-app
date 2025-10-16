// lib/password.ts
import { scryptSync, randomBytes, timingSafeEqual, type ScryptOptions } from "crypto";

// scrypt params
const N = 16384;
const r = 8;
const p = 1;
const KEYLEN = 64; // bytes

// Convert Buffer → Uint8Array view (TS-friendly for timingSafeEqual)
function toView(buf: Buffer): Uint8Array {
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

/** Hash secret with scrypt.
 * Stored format:  scrypt$N$r$p$base64(salt)$hex(derived)
 */
export function hashSecret(secret: string) {
  const saltB64 = randomBytes(16).toString("base64");   // use string salt (BinaryLike OK)
  const opts: ScryptOptions = { N, r, p };
  const derived = scryptSync(secret, saltB64, KEYLEN, opts); // Buffer
  return `scrypt$${N}$${r}$${p}$${saltB64}$${derived.toString("hex")}`;
}

/** Verify secret against stored hash.
 * Accepts legacy bcrypt hashes ($2…) for backward compatibility.
 */
export async function verifySecret(secret: string, stored: string) {
  // Legacy bcrypt support (lazy import only if needed)
  if (stored.startsWith("$2")) {
    const { default: bcrypt } = await import("bcryptjs");
    return bcrypt.compare(secret, stored);
  }

  // scrypt$N$r$p$saltB64$derivedHex
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const rr = Number(parts[2]);
  const pp = Number(parts[3]);
  const saltB64 = parts[4];
  const expected = Buffer.from(parts[5], "hex");

  const opts: ScryptOptions = { N: n, r: rr, p: pp };
  const derived = scryptSync(secret, saltB64, expected.length, opts); // Buffer

  // TS-safe constant-time compare
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(toView(derived), toView(expected));
}
