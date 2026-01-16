import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  getTransactionById,
  getTransactionsByCompany,
  updateTransaction,
  deleteTransaction,
} from '../db/queries';

const transactions = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
transactions.use('*', authMiddleware);

// GET /api/transactions - List transactions
transactions.get('/', async (c) => {
  try {
    const user = c.get('user');
    const { status, limit, offset } = c.req.query();

    // Clients can only see their company's transactions
    // Admins need to specify company_id in query
    let companyId = user.company_id;

    if (user.role === 'admin') {
      const queryCompanyId = c.req.query('company_id');
      if (!queryCompanyId) {
        return c.json({ error: 'company_id is required for admin' }, 400);
      }
      companyId = queryCompanyId;
    }

    if (!companyId) {
      return c.json({ error: 'Company not found' }, 400);
    }

    const transactions = await getTransactionsByCompany(c.env.DB, companyId, {
      status: status || undefined,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });

    return c.json({ data: transactions });
  } catch (error) {
    console.error('List transactions error:', error);
    return c.json({ error: '取引一覧の取得に失敗しました' }, 500);
  }
});

// GET /api/transactions/:id - Get single transaction
transactions.get('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (user.role !== 'admin' && transaction.company_id !== user.company_id) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }

    return c.json({ data: transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    return c.json({ error: '取引の取得に失敗しました' }, 500);
  }
});

// PUT /api/transactions/:id - Update transaction
transactions.put('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (user.role !== 'admin' && transaction.company_id !== user.company_id) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }

    // Clients cannot modify confirmed transactions
    if (user.role !== 'admin' && transaction.status === 'confirmed') {
      return c.json({ error: '確認済みの取引は変更できません' }, 403);
    }

    // Update allowed fields (only admin can change status)
    const updateData: Record<string, unknown> = {
      transaction_date: body.transaction_date,
      amount: body.amount,
      vendor_name: body.vendor_name,
      account_debit: body.account_debit,
      account_credit: body.account_credit,
      tax_category: body.tax_category,
    };

    // Only admin can change status
    if (user.role === 'admin' && body.status) {
      updateData.status = body.status;
    }

    await updateTransaction(c.env.DB, id, updateData);

    const updated = await getTransactionById(c.env.DB, id);
    return c.json({ data: updated });
  } catch (error) {
    console.error('Update transaction error:', error);
    return c.json({ error: '取引の更新に失敗しました' }, 500);
  }
});

// PUT /api/transactions/:id/confirm - Confirm transaction (Admin only)
transactions.put('/:id/confirm', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    // Only admin can confirm transactions
    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが確認できます' }, 403);
    }

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    if (transaction.status === 'confirmed') {
      return c.json({ error: 'すでに確認済みです' }, 400);
    }

    await updateTransaction(c.env.DB, id, { status: 'confirmed' });

    return c.json({ message: '確認しました' });
  } catch (error) {
    console.error('Confirm transaction error:', error);
    return c.json({ error: '取引の確認に失敗しました' }, 500);
  }
});

// DELETE /api/transactions/:id - Delete transaction
transactions.delete('/:id', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (user.role !== 'admin' && transaction.company_id !== user.company_id) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }

    // Also delete from R2
    try {
      await c.env.BUCKET.delete(transaction.image_key);
    } catch (e) {
      console.error('Failed to delete image from R2:', e);
    }

    await deleteTransaction(c.env.DB, id);

    return c.json({ message: '削除しました' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    return c.json({ error: '取引の削除に失敗しました' }, 500);
  }
});

export default transactions;
