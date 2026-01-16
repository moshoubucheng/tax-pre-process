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
 * Calculate tax amount based on tax category
 * 8%: amount * 8 / 108
 * 10%: amount * 10 / 110
 */
function calculateTaxAmount(amount: number, taxCategory: string | null): number {
  if (!taxCategory || amount === 0) return 0;

  if (taxCategory.includes('8%')) {
    return Math.floor((amount * 8) / 108);
  }
  if (taxCategory.includes('10%')) {
    return Math.floor((amount * 10) / 110);
  }

  return 0;
}

/**
 * Convert transaction to Yayoi CSV row
 */
function transactionToYayoiRow(
  transaction: Transaction,
  rowNumber: number
): YayoiCSVRow {
  const taxAmount = calculateTaxAmount(
    transaction.amount || 0,
    transaction.tax_category
  );

  return {
    識別フラグ: '2111', // Normal transaction
    伝票No: String(rowNumber),
    決算: '',
    取引日付: formatDateForYayoi(transaction.transaction_date),
    借方勘定科目: transaction.account_debit || '',
    借方補助科目: '',
    借方部門: '',
    借方税区分: transaction.tax_category || '',
    借方金額: String(transaction.amount || 0),
    借方税金額: String(taxAmount),
    貸方勘定科目: transaction.account_credit || '現金',
    貸方補助科目: '',
    貸方部門: '',
    貸方税区分: '対象外',
    貸方金額: String(transaction.amount || 0),
    貸方税金額: '',
    摘要: transaction.vendor_name || '',
    番号: '',
    期日: '',
    タイプ: '',
    生成元: 'Tax-Pre-Process',
    仕訳メモ: '',
  };
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
 */
export function generateYayoiCSV(transactions: Transaction[]): string {
  const lines: string[] = [];

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

  return lines.join('\r\n');
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
