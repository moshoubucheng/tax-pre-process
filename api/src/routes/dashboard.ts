import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  getMonthlyTotal,
  getStatusCounts,
  getMonthlyChartData,
  getTransactionsByCompany,
} from '../db/queries';

const dashboard = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
dashboard.use('*', authMiddleware);

// GET /api/dashboard/stats - Get dashboard statistics
dashboard.get('/stats', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [monthlyTotal, counts] = await Promise.all([
      getMonthlyTotal(c.env.DB, user.company_id, year, month),
      getStatusCounts(c.env.DB, user.company_id),
    ]);

    return c.json({
      monthly_total: monthlyTotal,
      pending_count: counts.pending,
      confirmed_count: counts.confirmed,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({ error: '統計情報の取得に失敗しました' }, 500);
  }
});

// GET /api/dashboard/monthly - Get monthly chart data
dashboard.get('/monthly', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const months = c.req.query('months');
    const chartData = await getMonthlyChartData(
      c.env.DB,
      user.company_id,
      months ? parseInt(months) : 6
    );

    return c.json({ data: chartData });
  } catch (error) {
    console.error('Monthly chart data error:', error);
    return c.json({ error: 'チャートデータの取得に失敗しました' }, 500);
  }
});

// GET /api/dashboard/pending - Get pending transactions
dashboard.get('/pending', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const transactions = await getTransactionsByCompany(
      c.env.DB,
      user.company_id,
      { status: 'pending', limit: 20 }
    );

    // Return only necessary fields for the pending list
    const pendingList = transactions.map((t) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      amount: t.amount,
      vendor_name: t.vendor_name,
      ai_confidence: t.ai_confidence,
    }));

    return c.json({ data: pendingList });
  } catch (error) {
    console.error('Pending transactions error:', error);
    return c.json({ error: '要確認リストの取得に失敗しました' }, 500);
  }
});

// GET /api/dashboard/confirmed - Get confirmed transactions
dashboard.get('/confirmed', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const transactions = await getTransactionsByCompany(
      c.env.DB,
      user.company_id,
      { status: 'confirmed', limit: 50 }
    );

    // Return only necessary fields for the confirmed list
    const confirmedList = transactions.map((t) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      amount: t.amount,
      vendor_name: t.vendor_name,
      ai_confidence: t.ai_confidence,
    }));

    return c.json({ data: confirmedList });
  } catch (error) {
    console.error('Confirmed transactions error:', error);
    return c.json({ error: '確認済リストの取得に失敗しました' }, 500);
  }
});

export default dashboard;
