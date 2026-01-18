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
  getTransactionsByCompany,
  getCompanyDocuments,
  updateCompanyDocuments,
  getUsersByCompany,
  getUserById,
  updateUserPassword,
} from '../db/queries';
import { generateYayoiCSV } from '../services/export';

const admin = new Hono<{ Bindings: Env }>();

// Apply auth middleware and admin role check to all routes
admin.use('*', authMiddleware);
admin.use('*', adminOnly);

// GET /api/admin/stats - Get global admin stats
admin.get('/stats', async (c) => {
  try {
    // Get pending count (exclude admin company)
    const pendingResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'pending' AND company_id != 'comp_admin'`
    ).first<{ count: number }>();

    // Get on_hold count (exclude admin company)
    const onHoldResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM transactions WHERE status = 'on_hold' AND company_id != 'comp_admin'`
    ).first<{ count: number }>();

    // Get settlement alerts count
    const companies = await getCompaniesWithStats(c.env.DB);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    let settlementAlerts = 0;
    for (const company of companies) {
      const docs = await getCompanyDocuments(c.env.DB, company.id);
      if (docs && docs.business_year_end && docs.settlement_confirmed !== 1) {
        const endMonth = parseInt(docs.business_year_end);
        let monthsSinceEnd = 0;

        if (currentMonth === endMonth && currentDay >= 15) {
          monthsSinceEnd = 1;
        } else if (currentMonth > endMonth || (currentMonth < endMonth && currentMonth + 12 - endMonth <= 2)) {
          if (currentMonth > endMonth) {
            monthsSinceEnd = currentMonth - endMonth;
          } else {
            monthsSinceEnd = currentMonth + 12 - endMonth;
          }
          if (monthsSinceEnd > 2) monthsSinceEnd = 0;
        }

        if (monthsSinceEnd >= 1) {
          settlementAlerts++;
        }
      }
    }

    return c.json({
      pending_count: pendingResult?.count || 0,
      on_hold_count: onHoldResult?.count || 0,
      settlement_alerts: settlementAlerts,
    });
  } catch (error) {
    console.error('Get admin stats error:', error);
    return c.json({ error: '統計の取得に失敗しました' }, 500);
  }
});

// GET /api/admin/companies - List all companies with stats
admin.get('/companies', async (c) => {
  try {
    const companies = await getCompaniesWithStats(c.env.DB);
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Enrich companies with settlement status
    const enrichedCompanies = await Promise.all(
      companies.map(async (company) => {
        const docs = await getCompanyDocuments(c.env.DB, company.id);
        let settlementColor: 'normal' | 'yellow' | 'red' = 'normal';

        if (docs && docs.business_year_end && docs.settlement_confirmed !== 1) {
          const endMonth = parseInt(docs.business_year_end);
          // Calculate months since business year ended
          let monthsSinceEnd = 0;

          if (currentMonth === endMonth && currentDay >= 15) {
            // First month (from 15th of ending month)
            monthsSinceEnd = 1;
          } else if (currentMonth > endMonth || (currentMonth < endMonth && currentMonth + 12 - endMonth <= 2)) {
            // After the ending month
            if (currentMonth > endMonth) {
              monthsSinceEnd = currentMonth - endMonth;
            } else {
              // Wrapped around year (e.g., end month is December, current is January)
              monthsSinceEnd = currentMonth + 12 - endMonth;
            }
            // Only count if within 2-month settlement period
            if (monthsSinceEnd > 2) monthsSinceEnd = 0;
          }

          if (monthsSinceEnd === 1) {
            settlementColor = 'yellow';
          } else if (monthsSinceEnd >= 2) {
            settlementColor = 'red';
          }
        }

        return {
          ...company,
          settlement_color: settlementColor,
          business_year_end: docs?.business_year_end || null,
          settlement_confirmed: docs?.settlement_confirmed || 0,
        };
      })
    );

    return c.json({ data: enrichedCompanies });
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

// GET /api/admin/companies/:id/transactions - Get company transactions
admin.get('/companies/:id/transactions', async (c) => {
  try {
    const id = c.req.param('id');
    const { status, limit, offset, search, start_date, end_date, min_amount, max_amount } = c.req.query();

    const company = await getCompanyById(c.env.DB, id);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    const transactions = await getTransactionsByCompany(c.env.DB, id, {
      status: status || undefined,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
      search: search || undefined,
      startDate: start_date || undefined,
      endDate: end_date || undefined,
      minAmount: min_amount ? parseInt(min_amount) : undefined,
      maxAmount: max_amount ? parseInt(max_amount) : undefined,
    });

    return c.json({ data: transactions });
  } catch (error) {
    console.error('Get company transactions error:', error);
    return c.json({ error: '取引一覧の取得に失敗しました' }, 500);
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

// PUT /api/admin/documents/:companyId - Update company documents (Admin)
admin.put('/documents/:companyId', async (c) => {
  try {
    const companyId = c.req.param('companyId');
    const body = await c.req.json();

    // Verify company exists
    const company = await getCompanyById(c.env.DB, companyId);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    // Check if documents exist
    const docs = await getCompanyDocuments(c.env.DB, companyId);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    // Update text fields
    await updateCompanyDocuments(c.env.DB, companyId, {
      shacho_phone: body.shacho_phone,
      shacho_name_reading: body.shacho_name_reading,
      kazoku_info: body.kazoku_info,
      shacho_income: body.shacho_income,
      kazoku_income: body.kazoku_income,
      salary_start_date: body.salary_start_date,
      kousei_nenkin: body.kousei_nenkin,
      kokuzei_info: body.kokuzei_info,
      chihouzei_info: body.chihouzei_info,
      business_year_start: body.business_year_start,
      business_year_end: body.business_year_end,
    });

    const updated = await getCompanyDocuments(c.env.DB, companyId);
    return c.json({ data: updated });
  } catch (error) {
    console.error('Admin update documents error:', error);
    return c.json({ error: '書類情報の更新に失敗しました' }, 500);
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
        'Content-Type': 'text/csv; charset=UTF-8',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return c.json({ error: 'エクスポートに失敗しました' }, 500);
  }
});

// GET /api/admin/business-year-alerts - Get companies with ending business year
admin.get('/business-year-alerts', async (c) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    // Only show alerts from 15th of the month
    if (currentDay < 15) {
      return c.json({ alerts: [] });
    }

    // Get all companies with their documents
    const companies = await getCompaniesWithStats(c.env.DB);
    const alerts = [];

    for (const company of companies) {
      const docs = await getCompanyDocuments(c.env.DB, company.id);
      if (docs && docs.business_year_end) {
        // Skip if settlement already confirmed
        if (docs.settlement_confirmed === 1) {
          continue;
        }
        const endMonth = parseInt(docs.business_year_end);
        if (currentMonth === endMonth) {
          alerts.push({
            company_id: company.id,
            company_name: company.name,
            end_month: endMonth,
            message: `${company.name}の事業年度が今月末で終了します。`,
          });
        }
      }
    }

    return c.json({ alerts });
  } catch (error) {
    console.error('Business year alerts error:', error);
    return c.json({ alerts: [] });
  }
});

// PUT /api/admin/companies/:id/settlement - Confirm settlement
admin.put('/companies/:id/settlement', async (c) => {
  try {
    const user = c.get('user');
    const companyId = c.req.param('id');

    const company = await getCompanyById(c.env.DB, companyId);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    const docs = await getCompanyDocuments(c.env.DB, companyId);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    // Confirm settlement
    await updateCompanyDocuments(c.env.DB, companyId, {
      settlement_confirmed: 1,
      settlement_confirmed_at: new Date().toISOString(),
      settlement_confirmed_by: user.sub,
    });

    return c.json({ message: '決算確認完了しました' });
  } catch (error) {
    console.error('Settlement confirm error:', error);
    return c.json({ error: '決算確認に失敗しました' }, 500);
  }
});

// DELETE /api/admin/companies/:id/settlement - Reset settlement for new year
admin.delete('/companies/:id/settlement', async (c) => {
  try {
    const companyId = c.req.param('id');

    const company = await getCompanyById(c.env.DB, companyId);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    // Reset settlement
    await updateCompanyDocuments(c.env.DB, companyId, {
      settlement_confirmed: 0,
      settlement_confirmed_at: null,
      settlement_confirmed_by: null,
    });

    return c.json({ message: '決算ステータスをリセットしました' });
  } catch (error) {
    console.error('Settlement reset error:', error);
    return c.json({ error: 'リセットに失敗しました' }, 500);
  }
});

// GET /api/admin/companies/:id/users - Get company users
admin.get('/companies/:id/users', async (c) => {
  try {
    const companyId = c.req.param('id');

    const company = await getCompanyById(c.env.DB, companyId);
    if (!company) {
      return c.json({ error: '顧問先が見つかりません' }, 404);
    }

    const users = await getUsersByCompany(c.env.DB, companyId);
    return c.json({ data: users });
  } catch (error) {
    console.error('Get company users error:', error);
    return c.json({ error: 'ユーザー一覧の取得に失敗しました' }, 500);
  }
});

// PUT /api/admin/users/:id/password - Reset user password (Admin only)
admin.put('/users/:id/password', async (c) => {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();

    const { new_password } = body;

    if (!new_password) {
      return c.json({ error: '新しいパスワードを入力してください' }, 400);
    }

    if (new_password.length < 8) {
      return c.json({ error: 'パスワードは8文字以上で入力してください' }, 400);
    }

    // Verify user exists
    const user = await getUserById(c.env.DB, userId);
    if (!user) {
      return c.json({ error: 'ユーザーが見つかりません' }, 404);
    }

    // Prevent admin from being reset (security measure)
    if (user.role === 'admin') {
      return c.json({ error: '管理者のパスワードはこの方法でリセットできません' }, 403);
    }

    // Hash and update password
    const passwordHash = await hashPassword(new_password);
    await updateUserPassword(c.env.DB, userId, passwordHash);

    return c.json({ message: 'パスワードをリセットしました' });
  } catch (error) {
    console.error('Reset user password error:', error);
    return c.json({ error: 'パスワードのリセットに失敗しました' }, 500);
  }
});

export default admin;
