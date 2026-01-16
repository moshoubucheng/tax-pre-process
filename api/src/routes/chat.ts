import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { handleTaxChat, getQuickAnswer } from '../services/ai-chat';

const chat = new Hono<{ Bindings: Env }>();

// Apply auth middleware
chat.use('*', authMiddleware);

// POST /api/chat - AI chat for tax questions
chat.post('/', async (c) => {
  try {
    const body = await c.req.json<{ message: string }>();

    if (!body.message || body.message.trim().length === 0) {
      return c.json({ error: 'メッセージを入力してください' }, 400);
    }

    const userMessage = body.message.trim();

    // Check for quick answers first (saves API calls)
    const quickAnswer = getQuickAnswer(userMessage);
    if (quickAnswer) {
      return c.json({ message: quickAnswer });
    }

    // Call Claude API
    const response = await handleTaxChat(c.env.CLAUDE_API_KEY, userMessage);

    return c.json({ message: response });
  } catch (error) {
    console.error('Chat error:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'チャット処理中にエラーが発生しました' },
      500
    );
  }
});

export default chat;
