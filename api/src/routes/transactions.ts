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

// PUT /api/transactions/batch-unlock - Batch unlock (revert) transactions (Admin only)
// NOTE: This route must be defined before /:id routes to avoid matching issues
transactions.put('/batch-unlock', async (c) => {
  try {
    const user = c.get('user');

    // Only admin can unlock transactions
    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが解除できます' }, 403);
    }

    const body = await c.req.json();
    const ids = body.ids as string[];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: '取引IDを指定してください' }, 400);
    }

    let unlockedCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const transaction = await getTransactionById(c.env.DB, id);

        if (!transaction) {
          errors.push(`${id}: 取引が見つかりません`);
          continue;
        }

        if (transaction.status !== 'confirmed') {
          // Not confirmed, skip
          continue;
        }

        await updateTransaction(c.env.DB, id, { status: 'pending' });
        unlockedCount++;
      } catch (e) {
        errors.push(`${id}: 解除に失敗しました`);
      }
    }

    return c.json({
      message: `${unlockedCount}件の取引を解除しました`,
      unlocked_count: unlockedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch unlock error:', error);
    return c.json({ error: '一括解除に失敗しました' }, 500);
  }
});

// PUT /api/transactions/batch-confirm - Batch confirm transactions (Admin only)
// NOTE: This route must be defined before /:id routes to avoid matching issues
transactions.put('/batch-confirm', async (c) => {
  try {
    const user = c.get('user');

    // Only admin can confirm transactions
    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが確認できます' }, 403);
    }

    const body = await c.req.json();
    const ids = body.ids as string[];

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return c.json({ error: '取引IDを指定してください' }, 400);
    }

    let confirmedCount = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        const transaction = await getTransactionById(c.env.DB, id);

        if (!transaction) {
          errors.push(`${id}: 取引が見つかりません`);
          continue;
        }

        if (transaction.status === 'confirmed') {
          // Already confirmed, skip
          continue;
        }

        await updateTransaction(c.env.DB, id, { status: 'confirmed' });
        confirmedCount++;
      } catch (e) {
        errors.push(`${id}: 確認に失敗しました`);
      }
    }

    return c.json({
      message: `${confirmedCount}件の取引を確認しました`,
      confirmed_count: confirmedCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Batch confirm error:', error);
    return c.json({ error: '一括確認に失敗しました' }, 500);
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

    // Update allowed fields
    const updateData: Record<string, unknown> = {
      transaction_date: body.transaction_date,
      amount: body.amount,
      vendor_name: body.vendor_name,
      account_debit: body.account_debit,
      account_credit: body.account_credit,
      tax_category: body.tax_category,
      description: body.description,
    };

    // Admin can change status and set admin_note
    if (user.role === 'admin') {
      if (body.status) {
        updateData.status = body.status;
      }
      if (body.admin_note !== undefined) {
        updateData.admin_note = body.admin_note;
      }
    }
    // Client can reply to on_hold items (changes status to pending)
    else if (transaction.status === 'on_hold' && body.reply === true) {
      updateData.status = 'pending';
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

// PUT /api/transactions/:id/unlock - Unlock transaction (Admin only)
// Allows reverting confirmed or on_hold status back to pending
transactions.put('/:id/unlock', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');

    // Only admin can unlock transactions
    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが解除できます' }, 403);
    }

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    if (transaction.status !== 'confirmed' && transaction.status !== 'on_hold') {
      return c.json({ error: '確認済みまたは確認待ちではありません' }, 400);
    }

    await updateTransaction(c.env.DB, id, { status: 'pending' });

    return c.json({ message: '編集を許可しました' });
  } catch (error) {
    console.error('Unlock transaction error:', error);
    return c.json({ error: '解除に失敗しました' }, 500);
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

    // Clients cannot delete confirmed transactions
    if (user.role !== 'admin' && transaction.status === 'confirmed') {
      return c.json({ error: '確認済みの取引は削除できません' }, 403);
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
