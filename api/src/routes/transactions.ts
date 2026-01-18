import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import {
  getTransactionById,
  getTransactionsByCompany,
  updateTransaction,
  deleteTransaction,
  getMessagesByTransactionId,
  createTransactionMessage,
} from '../db/queries';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

const transactions = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
transactions.use('*', authMiddleware);

// GET /api/transactions - List transactions with search/filter support
transactions.get('/', async (c) => {
  try {
    const user = c.get('user');
    const {
      status,
      limit,
      offset,
      search,
      start_date,
      end_date,
      min_amount,
      max_amount,
    } = c.req.query();

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

    // Validate and cap limit to prevent performance issues
    const MAX_LIMIT = 500;
    let parsedLimit = limit ? parseInt(limit) : 100;
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      parsedLimit = 100;
    } else if (parsedLimit > MAX_LIMIT) {
      parsedLimit = MAX_LIMIT;
    }

    const transactions = await getTransactionsByCompany(c.env.DB, companyId, {
      status: status || undefined,
      limit: parsedLimit,
      offset: offset ? parseInt(offset) : 0,
      search: search || undefined,
      startDate: start_date || undefined,
      endDate: end_date || undefined,
      minAmount: min_amount ? parseInt(min_amount) : undefined,
      maxAmount: max_amount ? parseInt(max_amount) : undefined,
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

    // Validate amount if provided
    if (body.amount !== undefined) {
      const amountNum = parseInt(body.amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return c.json({ error: '金額は1円以上の正の整数を入力してください' }, 400);
      }
      if (amountNum > 999999999) {
        return c.json({ error: '金額が大きすぎます（上限: 999,999,999円）' }, 400);
      }
    }

    // Validate transaction_date format if provided
    if (body.transaction_date !== undefined && body.transaction_date !== null) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.transaction_date)) {
        return c.json({ error: '日付の形式が正しくありません (YYYY-MM-DD)' }, 400);
      }
    }

    // Update allowed fields - only include if explicitly provided
    const updateData: Record<string, unknown> = {};

    if (body.transaction_date !== undefined) updateData.transaction_date = body.transaction_date;
    if (body.amount !== undefined) updateData.amount = parseInt(body.amount);
    if (body.vendor_name !== undefined) updateData.vendor_name = body.vendor_name;
    if (body.account_debit !== undefined) updateData.account_debit = body.account_debit;
    if (body.account_credit !== undefined) updateData.account_credit = body.account_credit;
    if (body.tax_category !== undefined) updateData.tax_category = body.tax_category;
    if (body.tax_rate !== undefined) updateData.tax_rate = body.tax_rate;
    if (body.invoice_number !== undefined) updateData.invoice_number = body.invoice_number;
    if (body.description !== undefined) updateData.description = body.description;

    // Admin can change status and set admin_note
    if (user.role === 'admin') {
      if (body.status) {
        updateData.status = body.status;
      }
      if (body.admin_note !== undefined) {
        updateData.admin_note = body.admin_note;
      }
    }
    // Client can confirm on_hold items (agree with admin's edits)
    else if (transaction.status === 'on_hold' && body.status === 'confirmed') {
      updateData.status = 'confirmed';
    }
    // Client can reply to on_hold items (changes status to pending)
    else if (transaction.status === 'on_hold' && body.reply === true) {
      updateData.status = 'pending';
    }

    // Skip update if no fields to update
    if (Object.keys(updateData).length === 0) {
      return c.json({ data: transaction });
    }

    await updateTransaction(c.env.DB, id, updateData);

    const updated = await getTransactionById(c.env.DB, id);
    if (!updated) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }
    return c.json({ data: updated });
  } catch (error) {
    console.error('Update transaction error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: `取引の更新に失敗しました: ${errorMessage}` }, 500);
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

// GET /api/transactions/:id/messages - Get messages for a transaction
transactions.get('/:id/messages', async (c) => {
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

    const messages = await getMessagesByTransactionId(c.env.DB, id);
    return c.json({ data: messages });
  } catch (error) {
    console.error('Get messages error:', error);
    return c.json({ error: 'メッセージの取得に失敗しました' }, 500);
  }
});

// POST /api/transactions/:id/messages - Add message to a transaction
transactions.post('/:id/messages', async (c) => {
  try {
    const user = c.get('user');
    const id = c.req.param('id');
    const body = await c.req.json();

    if (!body.message || typeof body.message !== 'string' || body.message.trim() === '') {
      return c.json({ error: 'メッセージを入力してください' }, 400);
    }

    const transaction = await getTransactionById(c.env.DB, id);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (user.role !== 'admin' && transaction.company_id !== user.company_id) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }

    // Create message
    const messageId = generateId('msg');
    await createTransactionMessage(c.env.DB, {
      id: messageId,
      transaction_id: id,
      user_id: user.sub,
      role: user.role,
      message: body.message.trim(),
    });

    // If client is replying to on_hold, optionally change status to pending
    if (user.role === 'client' && transaction.status === 'on_hold') {
      await updateTransaction(c.env.DB, id, { status: 'pending' });
    }

    // Return all messages
    const messages = await getMessagesByTransactionId(c.env.DB, id);
    return c.json({ data: messages });
  } catch (error) {
    console.error('Add message error:', error);
    return c.json({ error: 'メッセージの送信に失敗しました' }, 500);
  }
});

export default transactions;
