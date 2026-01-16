import { Context, Next } from 'hono';
import { verifyJWT } from '../services/jwt';
import type { Env, JWTPayload } from '../types';

// Extend Hono's context to include user info
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

/**
 * Authentication middleware
 * Verifies JWT token from Authorization header
 */
export async function authMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '認証が必要です' }, 401);
  }

  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);

  if (!payload) {
    return c.json({ error: 'トークンが無効または期限切れです' }, 401);
  }

  // Set user in context
  c.set('user', payload);

  await next();
}

/**
 * Optional auth middleware
 * Sets user if token exists, but doesn't block if not
 */
export async function optionalAuthMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('user', payload);
    }
  }

  await next();
}
