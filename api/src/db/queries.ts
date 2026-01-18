import type { Company, User, Transaction, CompanyDocuments, TransactionMessage } from '../types';

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

export async function updateUserPassword(
  db: D1Database,
  userId: string,
  passwordHash: string
): Promise<void> {
  await db
    .prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(passwordHash, userId)
    .run();
}

export async function getUsersByCompany(
  db: D1Database,
  companyId: string
): Promise<Omit<User, 'password_hash'>[]> {
  const result = await db
    .prepare('SELECT id, email, name, role, company_id, created_at FROM users WHERE company_id = ?')
    .bind(companyId)
    .all<Omit<User, 'password_hash'>>();
  return result.results;
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
  options: {
    status?: string;
    limit?: number;
    offset?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  } = {}
): Promise<Transaction[]> {
  let query = 'SELECT * FROM transactions WHERE company_id = ?';
  const params: (string | number)[] = [companyId];

  if (options.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  if (options.search) {
    query += ' AND vendor_name LIKE ?';
    params.push(`%${options.search}%`);
  }

  if (options.startDate) {
    query += ' AND transaction_date >= ?';
    params.push(options.startDate);
  }

  if (options.endDate) {
    query += ' AND transaction_date <= ?';
    params.push(options.endDate);
  }

  if (options.minAmount !== undefined) {
    query += ' AND amount >= ?';
    params.push(options.minAmount);
  }

  if (options.maxAmount !== undefined) {
    query += ' AND amount <= ?';
    params.push(options.maxAmount);
  }

  query += ' ORDER BY transaction_date DESC, created_at DESC';

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
        amount, vendor_name, account_debit, account_credit, tax_category, invoice_number,
        ai_confidence, ai_raw_response, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      txn.invoice_number,
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
  if (updates.invoice_number !== undefined) {
    fields.push('invoice_number = ?');
    values.push(updates.invoice_number);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.admin_note !== undefined) {
    fields.push('admin_note = ?');
    values.push(updates.admin_note);
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
): Promise<{ pending: number; confirmed: number; on_hold: number }> {
  const result = await db
    .prepare(
      `SELECT status, COUNT(*) as count
       FROM transactions
       WHERE company_id = ?
       GROUP BY status`
    )
    .bind(companyId)
    .all<{ status: string; count: number }>();

  const counts = { pending: 0, confirmed: 0, on_hold: 0 };
  for (const row of result.results) {
    if (row.status === 'pending') counts.pending = row.count;
    if (row.status === 'confirmed') counts.confirmed = row.count;
    if (row.status === 'on_hold') counts.on_hold = row.count;
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
  (Company & { pending_count: number; confirmed_count: number; on_hold_count: number; monthly_total: number })[]
> {
  const now = new Date();
  const startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

  const result = await db
    .prepare(
      `SELECT
         c.*,
         COALESCE(SUM(CASE WHEN t.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_count,
         COALESCE(SUM(CASE WHEN t.status = 'confirmed' THEN 1 ELSE 0 END), 0) as confirmed_count,
         COALESCE(SUM(CASE WHEN t.status = 'on_hold' THEN 1 ELSE 0 END), 0) as on_hold_count,
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
    on_hold_count: number;
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

// ============== Company Documents ==============

export async function getCompanyDocuments(
  db: D1Database,
  companyId: string
): Promise<CompanyDocuments | null> {
  const result = await db
    .prepare('SELECT * FROM company_documents WHERE company_id = ?')
    .bind(companyId)
    .first<CompanyDocuments>();
  return result;
}

export async function createCompanyDocuments(
  db: D1Database,
  data: { id: string; company_id: string }
): Promise<void> {
  await db
    .prepare('INSERT INTO company_documents (id, company_id) VALUES (?, ?)')
    .bind(data.id, data.company_id)
    .run();
}

export async function updateCompanyDocuments(
  db: D1Database,
  companyId: string,
  data: Partial<Omit<CompanyDocuments, 'id' | 'company_id' | 'created_at'>>
): Promise<void> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  // Build dynamic update query
  const allowedFields = [
    'tohon_key', 'teikan_key', 'zairyu_card_key', 'juminhyo_key',
    'kaigyo_doc_key',
    'shacho_phone', 'shacho_name_reading',
    'kazoku_info', 'shacho_income', 'kazoku_income', 'salary_start_date',
    'kousei_nenkin', 'kokuzei_info', 'chihouzei_info',
    'business_year_start', 'business_year_end',
    'settlement_confirmed', 'settlement_confirmed_at', 'settlement_confirmed_by',
    'status', 'confirmed_by', 'confirmed_at'
  ];

  for (const field of allowedFields) {
    if (field in data) {
      fields.push(`${field} = ?`);
      values.push((data as Record<string, string | number | null>)[field]);
    }
  }

  if (fields.length === 0) return;

  // Always update updated_at
  fields.push("updated_at = datetime('now')");
  values.push(companyId);

  await db
    .prepare(`UPDATE company_documents SET ${fields.join(', ')} WHERE company_id = ?`)
    .bind(...values)
    .run();
}

// Transaction message queries
export async function getMessagesByTransactionId(
  db: D1Database,
  transactionId: string
): Promise<TransactionMessage[]> {
  const result = await db
    .prepare('SELECT * FROM transaction_messages WHERE transaction_id = ? ORDER BY created_at ASC')
    .bind(transactionId)
    .all<TransactionMessage>();
  return result.results;
}

export async function createTransactionMessage(
  db: D1Database,
  data: Omit<TransactionMessage, 'created_at'>
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO transaction_messages (id, transaction_id, user_id, role, message) VALUES (?, ?, ?, ?, ?)'
    )
    .bind(data.id, data.transaction_id, data.user_id, data.role, data.message)
    .run();
}
