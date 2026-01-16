import { Context, Next } from 'hono';
import type { Env } from '../types';

/**
 * Role-based access control middleware
 * Must be used after authMiddleware
 */
export function requireRole(...allowedRoles: ('admin' | 'client')[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: '認証が必要です' }, 401);
    }

    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'この操作を行う権限がありません' }, 403);
    }

    await next();
  };
}

/**
 * Admin only middleware
 */
export const adminOnly = requireRole('admin');

/**
 * Client only middleware (rarely needed, but available)
 */
export const clientOnly = requireRole('client');
