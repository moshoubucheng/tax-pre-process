/**
 * Script to create initial admin user
 * Run with: npx wrangler d1 execute tax-db --local --command "..."
 *
 * Or use the API after deployment:
 * 1. Temporarily remove admin check from POST /api/admin/users
 * 2. Create first admin user
 * 3. Restore admin check
 *
 * This file provides the SQL for manual insertion.
 */

// To generate password hash, run this in browser console or Node.js:
/*
async function hashPassword(password: string): Promise<string> {
  const SALT_LENGTH = 16;
  const ITERATIONS = 100000;

  function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedKey = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt.buffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  const saltHex = arrayBufferToHex(salt.buffer);
  const keyHex = arrayBufferToHex(derivedKey);

  return `${saltHex}:${keyHex}`;
}

// Example usage:
hashPassword('your-secure-password').then(console.log);
*/

// Example SQL to insert admin user (replace PASSWORD_HASH with generated hash):
const EXAMPLE_SQL = `
-- Create admin company
INSERT INTO companies (id, name) VALUES ('comp_admin', '山田税理士事務所');

-- Create admin user
-- Password: admin123 (CHANGE THIS!)
-- Generate hash using the function above
INSERT INTO users (id, email, password_hash, name, role, company_id)
VALUES (
  'user_admin',
  'admin@example.com',
  'YOUR_PASSWORD_HASH_HERE',
  '山田太郎',
  'admin',
  'comp_admin'
);
`;

console.log('Example SQL for creating admin user:');
console.log(EXAMPLE_SQL);
console.log('\nTo generate password hash, use the hashPassword function in browser console.');
