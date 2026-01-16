import type { Company, User, Transaction } from '../types';

// User queries
export async function getUserByEmail(db: D1Database, email: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(email)
    .first<User>();
  return result;
}

export async function getUserById(db: D1Database, id: string): Promise<User | null> {
  const result = await db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(id)
    .first<User>();
  return result;
}

export async function createUser(
  db: D1Database,
  user: Omit<User, 'created_at'>
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO users (id, email, password_hash, name, role, company_id) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(user.id, user.email, user.password_hash, user.name, user.role, user.company_id)
    .run();
}

// Company queries
export async function getCompanyById(db: D1Database, id: string): Promise<Company | null> {
  const result = await db
    .prepare('SELECT * FROM companies WHERE id = ?')
    .bind(id)
    .first<Company>();
  return result;
}

export async function getAllCompanies(db: D1Database): Promise<Company[]> {
  const result = await db
    .prepare('SELECT * FROM companies ORDER BY name')
    .all<Company>();
  return result.results;
}

export async function createCompany(
  db: D1Database,
  company: Omit<Company, 'created_at'>
): Promise<void> {
  await db
    .prepare('INSERT INTO companies (id, name) VALUES (?, ?)')
    .bind(company.id, company.name)
    .run();
}

// Transaction queries
export async function getTransactionById(
  db: D1Database,
  id: string
): Promise<Transaction | null> {
  const result = await db
    .prepare('SELECT * FROM transactions WHERE id = ?')
    .bind(id)
    .first<Transaction>();
  return result;
}

export async function getTransactionsByCompany(
  db: D1Database,
  companyId: string,
  options: { status?: string; limit?: number; offset?: number } = {}
): Promise<Transaction[]> {
  let query = 'SELECT * FROM transactions WHERE company_id = ?';
  const params: (string | number)[] = [companyId];

  if (options.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY created_at DESC';

  if (options.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  if (options.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<Transaction>();
  return result.results;
}

export async function createTransaction(
  db: D1Database,
  txn: Omit<Transaction, 'created_at'>
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO transactions
       (id, company_id, uploaded_by, image_key, image_uploaded_at, transaction_date,
        amount, vendor_name, account_debit, account_credit, tax_category,
        ai_confidence, ai_raw_response, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      txn.account_credit,
      txn.tax_category,
      txn.ai_confidence,
      txn.ai_raw_response,
      txn.status
    )
    .run();
}

export async function updateTransaction(
  db: D1Database,
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (updates.transaction_date !== undefined) {
    fields.push('transaction_date = ?');
    values.push(updates.transaction_date);
  }
  if (updates.amount !== undefined) {
    fields.push('amount = ?');
    values.push(updates.amount);
  }
  if (updates.vendor_name !== undefined) {
    fields.push('vendor_name = ?');
    values.push(updates.vendor_name);
  }
  if (updates.account_debit !== undefined) {
    fields.push('account_debit = ?');
    values.push(updates.account_debit);
  }
  if (updates.account_credit !== undefined) {
    fields.push('account_credit = ?');
    values.push(updates.account_credit);
  }
  if (updates.tax_category !== undefined) {
    fields.push('tax_category = ?');
    values.push(updates.tax_category);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }

  if (fields.length === 0) return;

  values.push(id);
  await db
    .prepare(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function deleteTransaction(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM transactions WHERE id = ?').bind(id).run();
}

// Stats queries
export async function getMonthlyTotal(
  db: D1Database,
  companyId: string,
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

  const result = await db
    .prepare(
      `SELECT COALESCE(SUM(amount), 0) as total
       FROM transactions
       WHERE company_id = ?
       AND transaction_date >= ?
       AND transaction_date < ?`
    )
    .bind(companyId, startDate, endDate)
    .first<{ total: number }>();

  return result?.total || 0;
}

export async function getStatusCounts(
  db: D1Database,
  companyId: string
): Promise<{ pending: number; confirmed: number }> {
  const result = await db
    .prepare(
      `SELECT status, COUNT(*) as count
       FROM transactions
       WHERE company_id = ?
       GROUP BY status`
    )
    .bind(companyId)
    .all<{ status: string; count: number }>();

  const counts = { pending: 0, confirmed: 0 };
  for (const row of result.results) {
    if (row.status === 'pending') counts.pending = row.count;
    if (row.status === 'confirmed') counts.confirmed = row.count;
  }
  return counts;
}

export async function getMonthlyChartData(
  db: D1Database,
  companyId: string,
  months: number = 6
): Promise<{ month: string; amount: number }[]> {
  const result = await db
    .prepare(
      `SELECT
         strftime('%Y-%m', transaction_date) as month,
         SUM(amount) as amount
       FROM transactions
       WHERE company_id = ?
       AND transaction_date >= date('now', '-' || ? || ' months')
       GROUP BY strftime('%Y-%m', transaction_date)
       ORDER BY month`
    )
    .bind(companyId, months)
    .all<{ month: string; amount: number }>();

  return result.results;
}

// Admin queries
export async function getCompaniesWithStats(db: D1Database): Promise<
  (Company & { pending_count: number; confirmed_count: number; monthly_total: number })[]
> {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const result = await db
    .prepare(
      `SELECT
         c.*,
         COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
         COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_count,
         COALESCE(SUM(CASE WHEN t.transaction_date >= ? THEN t.amount ELSE 0 END), 0) as monthly_total
       FROM companies c
       LEFT JOIN transactions t ON c.id = t.company_id
       WHERE c.id != 'comp_admin'
       GROUP BY c.id
       ORDER BY c.name`
    )
    .bind(startDate)
    .all();

  return result.results as unknown as (Company & {
    pending_count: number;
    confirmed_count: number;
    monthly_total: number;
  })[];
}

export async function getConfirmedTransactionsForExport(
  db: D1Database,
  companyId: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  let query = `SELECT * FROM transactions WHERE company_id = ? AND status = 'confirmed'`;
  const params: string[] = [companyId];

  if (startDate) {
    query += ' AND transaction_date >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND transaction_date <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY transaction_date';

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<Transaction>();

  return result.results;
}
