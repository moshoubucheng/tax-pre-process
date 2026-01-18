import type { Transaction, YayoiCSVRow } from '../types';

/**
 * Yayoi Accounting CSV Export (22-field format)
 * Reference: https://support.yayoi-kk.co.jp/
 */

const CSV_HEADERS = [
  '識別フラグ',
  '伝票No',
  '決算',
  '取引日付',
  '借方勘定科目',
  '借方補助科目',
  '借方部門',
  '借方税区分',
  '借方金額',
  '借方税金額',
  '貸方勘定科目',
  '貸方補助科目',
  '貸方部門',
  '貸方税区分',
  '貸方金額',
  '貸方税金額',
  '摘要',
  '番号',
  '期日',
  'タイプ',
  '生成元',
  '仕訳メモ',
];

/**
 * Format date from ISO (YYYY-MM-DD) to Yayoi format (YYYY/MM/DD)
 */
function formatDateForYayoi(isoDate: string | null): string {
  if (!isoDate) return '';
  return isoDate.replace(/-/g, '/');
}

/**
 * Calculate tax amount based on tax rate
 * 8%: amount * 8 / 108 (税込金額から税額を逆算)
 * 10%: amount * 10 / 110
 */
function calculateTaxAmount(amount: number, taxRate: number | null): number {
  if (!taxRate || amount === 0) return 0;

  if (taxRate === 8) {
    return Math.floor((amount * 8) / 108);
  }
  if (taxRate === 10) {
    return Math.floor((amount * 10) / 110);
  }

  return 0;
}

/**
 * Get tax category string for Yayoi export
 * Based on transaction type and tax rate
 */
function getTaxCategoryForExport(
  type: 'expense' | 'income',
  taxRate: number | null,
  originalCategory: string | null
): string {
  // If original category exists, use it
  if (originalCategory) return originalCategory;

  // Generate based on type and rate
  if (type === 'expense') {
    if (taxRate === 8) return '課対仕入内8%(軽)';
    if (taxRate === 10) return '課対仕入内10%';
    return '対象外';
  } else {
    // income
    if (taxRate === 8) return '課税売上8%';
    if (taxRate === 10) return '課税売上10%';
    return '対象外';
  }
}

/**
 * Convert transaction to Yayoi CSV row
 * Handles different accounting treatment for expense vs income:
 * - EXPENSE: Tax on debit side (借方)
 * - INCOME: Tax on credit side (貸方)
 */
function transactionToYayoiRow(
  transaction: Transaction,
  rowNumber: number
): YayoiCSVRow {
  const amount = transaction.amount || 0;
  const taxRate = transaction.tax_rate;
  const taxAmount = calculateTaxAmount(amount, taxRate);
  const isIncome = transaction.type === 'income';

  // Get appropriate tax category
  const taxCategory = getTaxCategoryForExport(
    transaction.type || 'expense',
    taxRate,
    transaction.tax_category
  );

  if (isIncome) {
    // INCOME: Tax category and amount on CREDIT side (貸方)
    return {
      識別フラグ: '2111',
      伝票No: String(rowNumber),
      決算: '',
      取引日付: formatDateForYayoi(transaction.transaction_date),
      借方勘定科目: transaction.account_debit || '売掛金',
      借方補助科目: '',
      借方部門: '',
      借方税区分: '対象外',
      借方金額: String(amount),
      借方税金額: '',
      貸方勘定科目: transaction.account_credit || '売上高',
      貸方補助科目: '',
      貸方部門: '',
      貸方税区分: taxCategory,
      貸方金額: String(amount),
      貸方税金額: String(taxAmount),
      摘要: transaction.vendor_name || '',
      番号: '',
      期日: '',
      タイプ: '',
      生成元: 'Tax-Pre-Process',
      仕訳メモ: '',
    };
  } else {
    // EXPENSE: Tax category and amount on DEBIT side (借方)
    return {
      識別フラグ: '2111',
      伝票No: String(rowNumber),
      決算: '',
      取引日付: formatDateForYayoi(transaction.transaction_date),
      借方勘定科目: transaction.account_debit || '',
      借方補助科目: '',
      借方部門: '',
      借方税区分: taxCategory,
      借方金額: String(amount),
      借方税金額: String(taxAmount),
      貸方勘定科目: transaction.account_credit || '現金',
      貸方補助科目: '',
      貸方部門: '',
      貸方税区分: '対象外',
      貸方金額: String(amount),
      貸方税金額: '',
      摘要: transaction.vendor_name || '',
      番号: '',
      期日: '',
      タイプ: '',
      生成元: 'Tax-Pre-Process',
      仕訳メモ: '',
    };
  }
}

/**
 * Escape CSV field (handle commas and quotes)
 */
function escapeCSVField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

/**
 * Generate Yayoi CSV from transactions
 * Returns UTF-8 string with BOM for Japanese software compatibility
 */
export function generateYayoiCSV(transactions: Transaction[]): string {
  const lines: string[] = [];

  // Add UTF-8 BOM for Japanese software compatibility (弥生会計等)
  // BOM will be prepended as \uFEFF
  const BOM = '\uFEFF';

  // Add header row
  lines.push(CSV_HEADERS.map(escapeCSVField).join(','));

  // Add data rows
  transactions.forEach((txn, index) => {
    const row = transactionToYayoiRow(txn, index + 1);
    const values = CSV_HEADERS.map((header) => {
      const value = row[header as keyof YayoiCSVRow] || '';
      return escapeCSVField(value);
    });
    lines.push(values.join(','));
  });

  // Return with BOM prefix for proper encoding detection
  return BOM + lines.join('\r\n');
}

/**
 * Generate simple CSV for debugging/testing
 */
export function generateSimpleCSV(transactions: Transaction[]): string {
  const headers = ['Date', 'Amount', 'Vendor', 'Category', 'Tax'];
  const lines: string[] = [headers.join(',')];

  transactions.forEach((txn) => {
    const row = [
      txn.transaction_date || '',
      String(txn.amount || 0),
      txn.vendor_name || '',
      txn.account_debit || '',
      txn.tax_category || '',
    ];
    lines.push(row.map(escapeCSVField).join(','));
  });

  return lines.join('\r\n');
}
