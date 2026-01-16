import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { adminOnly } from '../middleware/role';
import { hashPassword, generateId } from '../services/password';
import {
  getCompaniesWithStats,
  getCompanyById,
  createCompany,
  createUser,
  getConfirmedTransactionsForExport,
} from '../db/queries';
import { generateYayoiCSV } from '../services/export';

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware and admin role check to all routes
admin.use('*', authMiddleware);
admin.use('*', adminOnly);

// GET /api/admin/companies - List all companies with stats
admin.get('/companies', async (c) => {
  try {
    const companies = await getCompaniesWithStats(c.env.DB);
    return c.json({ data: companies });
  } catch (error) {
    console.error('List companies error:', error);
    return c.json({ error: '顧問先一覧の取得に失敗しました' }, 500);
  }
});

// GET /api/admin/companies/:id - Get company details
admin.get('/companies/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const company = await getCompanyById(c.env.DB, id);

    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    return c.json({ data: company });
  } catch (error) {
    console.error('Get company error:', error);
    return c.json({ error: '顧問先の取得に失敗しました' }, 500);
  }
});

// POST /api/admin/companies - Create new company
admin.post('/companies', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.name) {
      return c.json({ error: '会社名を入力してください' }, 400);
    }

    const id = generateId('comp');
    await createCompany(c.env.DB, { id, name: body.name });

    return c.json({ id, name: body.name }, 201);
  } catch (error) {
    console.error('Create company error:', error);
    return c.json({ error: '顧問先の作成に失敗しました' }, 500);
  }
});

// POST /api/admin/users - Create new user
admin.post('/users', async (c) => {
  try {
    const body = await c.req.json();

    if (!body.email || !body.password || !body.name) {
      return c.json({ error: '必須項目を入力してください' }, 400);
    }

    if (body.password.length < 8) {
      return c.json({ error: 'パスワードは8文字以上で入力してください' }, 400);
    }

    const id = generateId('user');
    const passwordHash = await hashPassword(body.password);

    await createUser(c.env.DB, {
      id,
      email: body.email,
      password_hash: passwordHash,
      name: body.name,
      role: body.role || 'client',
      company_id: body.company_id || null,
    });

    return c.json({ id, email: body.email, name: body.name }, 201);
  } catch (error: any) {
    console.error('Create user error:', error);

    // Check for unique constraint violation
    if (error.message?.includes('UNIQUE constraint failed')) {
      return c.json({ error: 'このメールアドレスは既に使用されています' }, 400);
    }

    return c.json({ error: 'ユーザーの作成に失敗しました' }, 500);
  }
});

// GET /api/admin/export/:companyId - Export transactions as Yayoi CSV
admin.get('/export/:companyId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const { start_date, end_date } = c.req.query();

    // Verify company exists
    const company = await getCompanyById(c.env.DB, companyId);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    // Get confirmed transactions
    const transactions = await getConfirmedTransactionsForExport(
      c.env.DB,
      companyId,
      start_date,
      end_date
    );

    if (transactions.length === 0) {
      return c.json({ error: 'エクスポートする取引がありません' }, 400);
    }

    // Generate Yayoi CSV
    const csv = generateYayoiCSV(transactions);

    // Return as file download
    const filename = `yayoi_export_${company.name}_${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=Shift_JIS',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'エクスポートに失敗しました' }, 500);
  }
});

export default admin;
