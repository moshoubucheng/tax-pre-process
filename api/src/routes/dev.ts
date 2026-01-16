import { Hono } from 'hono';
import type { Env } from '../types';
import { hashPassword, generateId } from '../services/password';

/**
 * Development-only routes
 * These should NOT be enabled in production
 */
const dev = new Hono<{ Bindings: Env }>();

// POST /api/dev/init - Initialize database with test data
dev.post('/init', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'This endpoint is only available in development' }, 403);
  }

  try {
    const db = c.env.DB;

    // Create admin company
    await db
      .prepare('INSERT OR IGNORE INTO companies (id, name) VALUES (?, ?)')
      .bind('comp_admin', '山田税理士事務所')
      .run();

    // Create test client company
    await db
      .prepare('INSERT OR IGNORE INTO companies (id, name) VALUES (?, ?)')
      .bind('comp_test', '株式会社テスト商事')
      .run();

    // Create admin user (password: admin123)
    const adminHash = await hashPassword('admin123');
    await db
      .prepare(
        `INSERT OR REPLACE INTO users (id, email, password_hash, name, role, company_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind('user_admin', 'admin@example.com', adminHash, '山田太郎', 'admin', 'comp_admin')
      .run();

    // Create client user (password: client123)
    const clientHash = await hashPassword('client123');
    await db
      .prepare(
        `INSERT OR REPLACE INTO users (id, email, password_hash, name, role, company_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind('user_client', 'client@example.com', clientHash, '田中花子', 'client', 'comp_test')
      .run();

    // Create sample transactions
    const transactions = [
      {
        id: 'txn_001',
        company_id: 'comp_test',
        uploaded_by: 'user_client',
        image_key: 'receipts/2024/01/sample1.jpg',
        image_uploaded_at: '2024-01-15T10:30:00Z',
        transaction_date: '2024-01-15',
        amount: 1500,
        vendor_name: 'JR東日本',
        account_debit: '旅費交通費',
        tax_category: '課対仕入内10%',
        ai_confidence: 95,
        status: 'confirmed',
      },
      {
        id: 'txn_002',
        company_id: 'comp_test',
        uploaded_by: 'user_client',
        image_key: 'receipts/2024/01/sample2.jpg',
        image_uploaded_at: '2024-01-16T14:20:00Z',
        transaction_date: '2024-01-16',
        amount: 3200,
        vendor_name: 'スターバックス',
        account_debit: '会議費',
        tax_category: '課対仕入内10%',
        ai_confidence: 88,
        status: 'confirmed',
      },
      {
        id: 'txn_003',
        company_id: 'comp_test',
        uploaded_by: 'user_client',
        image_key: 'receipts/2024/01/sample3.jpg',
        image_uploaded_at: '2024-01-17T09:15:00Z',
        transaction_date: '2024-01-17',
        amount: 12800,
        vendor_name: '文具店',
        account_debit: '消耗品費',
        tax_category: '課対仕入内10%',
        ai_confidence: 62,
        status: 'pending',
      },
    ];

    for (const txn of transactions) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO transactions
           (id, company_id, uploaded_by, image_key, image_uploaded_at, transaction_date,
            amount, vendor_name, account_debit, account_credit, tax_category, ai_confidence, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          txn.id,
          txn.company_id,
          txn.uploaded_by,
          txn.image_key,
          txn.image_uploaded_at,
          txn.transaction_date,
          txn.amount,
          txn.vendor_name,
          txn.account_debit,
          '現金',
          txn.tax_category,
          txn.ai_confidence,
          txn.status
        )
        .run();
    }

    return c.json({
      message: 'Database initialized with test data',
      users: [
        { email: 'admin@example.com', password: 'admin123', role: 'admin' },
        { email: 'client@example.com', password: 'client123', role: 'client' },
      ],
    });
  } catch (error) {
    console.error('Init error:', error);
    return c.json({ error: 'Failed to initialize database' }, 500);
  }
});

// GET /api/dev/hash/:password - Generate password hash (for testing)
dev.get('/hash/:password', async (c) => {
  if (c.env.ENVIRONMENT !== 'development') {
    return c.json({ error: 'This endpoint is only available in development' }, 403);
  }

  const password = c.req.param('password');
  const hash = await hashPassword(password);
  return c.json({ password, hash });
});

export default dev;
