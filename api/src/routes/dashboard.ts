import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  getMonthlyTotal,
  getStatusCounts,
  getMonthlyChartData,
  getTransactionsByCompany,
  getCompanyDocuments,
  getCompanyById,
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

    const { search, start_date, end_date, min_amount, max_amount } = c.req.query();

    const transactions = await getTransactionsByCompany(
      c.env.DB,
      user.company_id,
      {
        status: 'pending',
        limit: 100,
        search: search || undefined,
        startDate: start_date || undefined,
        endDate: end_date || undefined,
        minAmount: min_amount ? parseInt(min_amount) : undefined,
        maxAmount: max_amount ? parseInt(max_amount) : undefined,
      }
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

    const { search, start_date, end_date, min_amount, max_amount } = c.req.query();

    const transactions = await getTransactionsByCompany(
      c.env.DB,
      user.company_id,
      {
        status: 'confirmed',
        limit: 100,
        search: search || undefined,
        startDate: start_date || undefined,
        endDate: end_date || undefined,
        minAmount: min_amount ? parseInt(min_amount) : undefined,
        maxAmount: max_amount ? parseInt(max_amount) : undefined,
      }
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

// GET /api/dashboard/business-year-alert - Check if business year is ending
dashboard.get('/business-year-alert', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ alert: false });
    }

    const docs = await getCompanyDocuments(c.env.DB, user.company_id);
    if (!docs || !docs.business_year_end) {
      return c.json({ alert: false });
    }

    // If settlement already confirmed, no alert
    if (docs.settlement_confirmed === 1) {
      return c.json({ alert: false });
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const endMonth = parseInt(docs.business_year_end);

    // Calculate months since business year ended
    let monthsSinceEnd = 0;
    let alertColor: 'yellow' | 'red' | null = null;

    if (currentMonth === endMonth && currentDay >= 15) {
      // First month (from 15th of ending month)
      monthsSinceEnd = 1;
      alertColor = 'yellow';
    } else if (currentMonth > endMonth || (currentMonth < endMonth && currentMonth + 12 - endMonth <= 2)) {
      // After the ending month
      if (currentMonth > endMonth) {
        monthsSinceEnd = currentMonth - endMonth;
      } else {
        // Wrapped around year (e.g., end month is December, current is January)
        monthsSinceEnd = currentMonth + 12 - endMonth;
      }
      // Only count if within 2-month settlement period
      if (monthsSinceEnd <= 2) {
        alertColor = monthsSinceEnd === 1 ? 'yellow' : 'red';
      }
    }

    if (alertColor) {
      const company = await getCompanyById(c.env.DB, user.company_id);
      const message = alertColor === 'yellow'
        ? '事業年度が今月末で終了します。決算の準備をお願いします。'
        : '事業年度が終了しました。至急、決算の準備をお願いします。';

      return c.json({
        alert: true,
        color: alertColor,
        message,
        company_name: company?.name || '',
        end_month: endMonth,
      });
    }

    return c.json({ alert: false });
  } catch (error) {
    console.error('Business year alert error:', error);
    return c.json({ alert: false });
  }
});

export default dashboard;
