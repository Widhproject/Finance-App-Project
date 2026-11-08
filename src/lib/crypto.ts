const ITER = 210_000
const enc = new TextEncoder()
const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const unb64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256)
}

/** PBKDF2-SHA256 with a random per-device salt. The PIN itself is never stored. */
export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))
  return { pinHash: b64(await derive(pin, salt, ITER)), pinSalt: b64(salt), pinIterations: ITER }
}

export async function verifyPin(pin: string, s: { pinHash?: string; pinSalt?: string; pinIterations?: number }) {
  if (!s.pinHash || !s.pinSalt) return false
  const got = new Uint8Array(await derive(pin, unb64(s.pinSalt), s.pinIterations ?? ITER))
  const want = unb64(s.pinHash)
  if (got.length !== want.length) return false
  let diff = 0
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i] // constant-time compare
  return diff === 0
}
