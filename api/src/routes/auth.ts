import { Hono } from 'hono';
import type { Env, LoginRequest } from '../types';
import { signJWT } from '../services/jwt';
import { verifyPassword } from '../services/password';
import { getUserByEmail, getUserById } from '../db/queries';
import { authMiddleware } from '../middleware/auth';

const auth = new Hono<{ Bindings: Env }>();

// POST /api/auth/login
auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<LoginRequest>();

    if (!body.email || !body.password) {
      return c.json({ error: 'メールアドレスとパスワードを入力してください' }, 400);
    }

    // Find user by email
    const user = await getUserByEmail(c.env.DB, body.email);

    if (!user) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    // Verify password
    const isValid = await verifyPassword(body.password, user.password_hash);

    if (!isValid) {
      return c.json({ error: 'メールアドレスまたはパスワードが正しくありません' }, 401);
    }

    // Generate JWT
    const token = await signJWT(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
      c.env.JWT_SECRET
    );

    // Return token and user info (without password)
    const { password_hash, ...safeUser } = user;

    return c.json({
      token,
      user: safeUser,
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ error: 'ログイン処理中にエラーが発生しました' }, 500);
  }
});

// POST /api/auth/logout
auth.post('/logout', async (c) => {
  // JWT is stateless, so logout is handled client-side by removing the token
  // This endpoint exists for API consistency and potential future session invalidation
  return c.json({ message: 'ログアウトしました' });
});

// GET /api/auth/me - Get current user
auth.get('/me', authMiddleware, async (c) => {
  try {
    const payload = c.get('user');

    // Fetch fresh user data from database
    const user = await getUserById(c.env.DB, payload.sub);

    if (!user) {
      return c.json({ error: 'ユーザーが見つかりません' }, 404);
    }

    const { password_hash, ...safeUser } = user;

    return c.json({ user: safeUser });
  } catch (error) {
    console.error('Get user error:', error);
    return c.json({ error: 'ユーザー情報の取得に失敗しました' }, 500);
  }
});

export default auth;
