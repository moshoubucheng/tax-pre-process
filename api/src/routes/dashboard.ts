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
      on_hold_count: counts.on_hold,
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

// GET /api/dashboard/on-hold - Get on_hold transactions (need client response)
dashboard.get('/on-hold', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const transactions = await getTransactionsByCompany(
      c.env.DB,
      user.company_id,
      {
        status: 'on_hold',
        limit: 100,
      }
    );

    // Return fields needed for on_hold list
    const onHoldList = transactions.map((t) => ({
      id: t.id,
      transaction_date: t.transaction_date,
      amount: t.amount,
      vendor_name: t.vendor_name,
      ai_confidence: t.ai_confidence,
      description: t.description,
    }));

    return c.json({ data: onHoldList });
  } catch (error) {
    console.error('On-hold transactions error:', error);
    return c.json({ error: '確認依頼リストの取得に失敗しました' }, 500);
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

// GET /api/dashboard/financial-summary - Get financial summary for BI dashboard
dashboard.get('/financial-summary', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const { year: yearParam, month: monthParam } = c.req.query();
    const now = new Date();
    const year = yearParam ? parseInt(yearParam) : now.getFullYear();
    const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;

    // Current month date range
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    // Get current month totals by type (only confirmed transactions for accurate reporting)
    const monthlyTotals = await c.env.DB
      .prepare(`
        SELECT
          type,
          COALESCE(SUM(amount), 0) as total,
          COALESCE(SUM(CASE
            WHEN tax_rate = 8 THEN amount * 8 / 108
            WHEN tax_rate = 10 THEN amount * 10 / 110
            ELSE 0
          END), 0) as tax_total
        FROM transactions
        WHERE company_id = ?
        AND transaction_date >= ?
        AND transaction_date < ?
        AND status = 'confirmed'
        GROUP BY type
      `)
      .bind(user.company_id, startDate, endDate)
      .all<{ type: string; total: number; tax_total: number }>();

    let totalIncome = 0;
    let totalExpense = 0;
    let incomeTax = 0;
    let expenseTax = 0;

    for (const row of monthlyTotals.results) {
      if (row.type === 'income') {
        totalIncome = row.total;
        incomeTax = Math.floor(row.tax_total);
      } else {
        totalExpense = row.total;
        expenseTax = Math.floor(row.tax_total);
      }
    }

    // Pending amounts (separate for transparency)
    const pendingTotals = await c.env.DB
      .prepare(`
        SELECT
          type,
          COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE company_id = ?
        AND transaction_date >= ?
        AND transaction_date < ?
        AND status IN ('pending', 'on_hold')
        GROUP BY type
      `)
      .bind(user.company_id, startDate, endDate)
      .all<{ type: string; total: number }>();

    let pendingIncome = 0;
    let pendingExpense = 0;

    for (const row of pendingTotals.results) {
      if (row.type === 'income') {
        pendingIncome = row.total;
      } else {
        pendingExpense = row.total;
      }
    }

    // Last 6 months trend (income vs expense)
    const sixMonthsAgo = new Date(year, month - 7, 1);
    const trendStartDate = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`;

    const monthlyTrend = await c.env.DB
      .prepare(`
        SELECT
          strftime('%Y-%m', transaction_date) as month,
          type,
          COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE company_id = ?
        AND transaction_date >= ?
        AND transaction_date < ?
        AND status = 'confirmed'
        GROUP BY strftime('%Y-%m', transaction_date), type
        ORDER BY month
      `)
      .bind(user.company_id, trendStartDate, endDate)
      .all<{ month: string; type: string; total: number }>();

    // Transform trend data into { month, income, expense } format
    const trendMap = new Map<string, { month: string; income: number; expense: number }>();
    for (const row of monthlyTrend.results) {
      if (!trendMap.has(row.month)) {
        trendMap.set(row.month, { month: row.month, income: 0, expense: 0 });
      }
      const entry = trendMap.get(row.month)!;
      if (row.type === 'income') {
        entry.income = row.total;
      } else {
        entry.expense = row.total;
      }
    }
    const trend = Array.from(trendMap.values());

    // Expense breakdown by category (current month, top 5)
    const expenseByCategory = await c.env.DB
      .prepare(`
        SELECT
          COALESCE(account_debit, '未分類') as category,
          COALESCE(SUM(amount), 0) as total
        FROM transactions
        WHERE company_id = ?
        AND transaction_date >= ?
        AND transaction_date < ?
        AND type = 'expense'
        AND status = 'confirmed'
        GROUP BY account_debit
        ORDER BY total DESC
        LIMIT 5
      `)
      .bind(user.company_id, startDate, endDate)
      .all<{ category: string; total: number }>();

    const expenseBreakdown = expenseByCategory.results.map((row) => ({
      name: row.category,
      value: row.total,
    }));

    // Calculate profit and estimated tax payable
    const profit = totalIncome - totalExpense;
    // 消費税 = 売上の税額 - 仕入の税額 (簡易計算)
    const taxEstimate = Math.max(0, incomeTax - expenseTax);

    return c.json({
      year,
      month,
      // Confirmed amounts
      confirmed: {
        income: totalIncome,
        expense: totalExpense,
        profit,
        income_tax: incomeTax,
        expense_tax: expenseTax,
        tax_estimate: taxEstimate,
      },
      // Pending amounts (for reference)
      pending: {
        income: pendingIncome,
        expense: pendingExpense,
      },
      // Charts data
      monthly_trend: trend,
      expense_breakdown: expenseBreakdown,
    });
  } catch (error) {
    console.error('Financial summary error:', error);
    return c.json({ error: '財務サマリーの取得に失敗しました' }, 500);
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
