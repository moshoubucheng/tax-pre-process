/**
 * Password hashing using Web Crypto API (SHA-256 with salt)
 * Note: For production, consider using Argon2 or bcrypt via a library
 */

const SALT_LENGTH = 16;
const ITERATIONS = 100000;

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  return crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  // Create a copy of the salt buffer to avoid issues with shared ArrayBuffer
  const saltBuffer = salt.slice().buffer;
  const derivedKey = await deriveKey(password, saltBuffer);

  const saltHex = arrayBufferToHex(saltBuffer);
  const keyHex = arrayBufferToHex(derivedKey);

  return `${saltHex}:${keyHex}`;
}

export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const [saltHex, keyHex] = storedHash.split(':');
    if (!saltHex || !keyHex) return false;

    const salt = hexToArrayBuffer(saltHex);
    const derivedKey = await deriveKey(password, salt);
    const derivedKeyHex = arrayBufferToHex(derivedKey);

    return keyHex === derivedKeyHex;
  } catch {
    return false;
  }
}

/**
 * Generate a random ID
 */
export function generateId(prefix: string = ''): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(12));
  const id = arrayBufferToHex(randomBytes.buffer);
  return prefix ? `${prefix}_${id}` : id;
}
