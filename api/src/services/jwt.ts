import type { JWTPayload } from '../types';

const ALGORITHM = 'HS256';
const EXPIRES_IN = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Base64URL encode - handles both strings and binary data correctly
 */
function base64UrlEncode(data: Uint8Array | string): string {
  let base64: string;

  if (typeof data === 'string') {
    // For strings, use btoa directly (works for ASCII/Latin1)
    base64 = btoa(data);
  } else {
    // For binary data (Uint8Array), convert bytes to Latin1 string first
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    base64 = btoa(binary);
  }

  // Convert to base64url format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Base64URL decode - returns string
 */
function base64UrlDecode(str: string): string {
  // Add padding
  const padded = str + '='.repeat((4 - (str.length % 4)) % 4);
  // Convert from base64url to base64
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  return atob(base64);
}

async function createSignature(
  header: string,
  payload: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(
  header: string,
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await createSignature(header, payload, secret);
  return signature === expectedSignature;
}

export async function signJWT(
  payload: Omit<JWTPayload, 'exp' | 'iat'>,
  secret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(
    JSON.stringify({ alg: ALGORITHM, typ: 'JWT' })
  );

  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + EXPIRES_IN,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await createSignature(header, encodedPayload, secret);

  return `${header}.${encodedPayload}.${signature}`;
}

export async function verifyJWT(
  token: string,
  secret: string
): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;

    const isValid = await verifySignature(header, payload, signature, secret);
    if (!isValid) return null;

    const decoded = JSON.parse(base64UrlDecode(payload)) as JWTPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    return decoded;
  } catch {
    return null;
  }
}
