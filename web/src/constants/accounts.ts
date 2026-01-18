// Transaction types
export type TransactionType = 'expense' | 'income';

// 勘定科目（借方）経費用 - Expense debit account categories
export const EXPENSE_ACCOUNT_DEBIT_OPTIONS = [
  '旅費交通費',
  '通信費',
  '消耗品費',
  '接待交際費',
  '会議費',
  '福利厚生費',
  '広告宣伝費',
  '新聞図書費',
  '水道光熱費',
  '地代家賃',
  '租税公課',
  '支払手数料',
  '保険料',
  '修繕費',
  '雑費',
  '仕入高',
  '外注費',
  '車両費',
  '事務用品費',
  '研修費',
] as const;

// 勘定科目（借方）売上用 - Income debit account categories
export const INCOME_ACCOUNT_DEBIT_OPTIONS = [
  '現金',
  '売掛金',
  '普通預金',
] as const;

// 勘定科目（貸方）売上用 - Income credit account categories
export const INCOME_ACCOUNT_CREDIT_OPTIONS = [
  '売上高',
  '雑収入',
] as const;

// 勘定科目（貸方）経費用 - Expense credit account categories
export const EXPENSE_ACCOUNT_CREDIT_OPTIONS = [
  '現金',
  '買掛金',
  '普通預金',
  '未払金',
] as const;

// Legacy export for backward compatibility
export const ACCOUNT_DEBIT_OPTIONS = EXPENSE_ACCOUNT_DEBIT_OPTIONS;

// 税区分（経費用）- Expense tax categories
export const EXPENSE_TAX_CATEGORY_OPTIONS = [
  '課対仕入内10%',
  '課対仕入内8%(軽)',
  '課対仕入10%',
  '課対仕入8%(軽)',
  '非課税仕入',
  '不課税仕入',
  '対象外',
] as const;

// 税区分（売上用）- Income tax categories
export const INCOME_TAX_CATEGORY_OPTIONS = [
  '課税売上10%',
  '課税売上8%',
  '非課税売上',
  '不課税売上',
  '対象外',
] as const;

// Legacy export for backward compatibility
export const TAX_CATEGORY_OPTIONS = EXPENSE_TAX_CATEGORY_OPTIONS;

// 税率オプション - Tax rate options
export const TAX_RATE_OPTIONS = [
  { value: 10, label: '10%' },
  { value: 8, label: '8%（軽減税率）' },
] as const;

// Helper function to get account options based on type
export function getAccountDebitOptions(type: TransactionType) {
  return type === 'income' ? INCOME_ACCOUNT_DEBIT_OPTIONS : EXPENSE_ACCOUNT_DEBIT_OPTIONS;
}

export function getAccountCreditOptions(type: TransactionType) {
  return type === 'income' ? INCOME_ACCOUNT_CREDIT_OPTIONS : EXPENSE_ACCOUNT_CREDIT_OPTIONS;
}

export function getTaxCategoryOptions(type: TransactionType) {
  return type === 'income' ? INCOME_TAX_CATEGORY_OPTIONS : EXPENSE_TAX_CATEGORY_OPTIONS;
}

// Types
export type ExpenseAccountDebitType = typeof EXPENSE_ACCOUNT_DEBIT_OPTIONS[number];
export type IncomeAccountDebitType = typeof INCOME_ACCOUNT_DEBIT_OPTIONS[number];
export type AccountDebitType = ExpenseAccountDebitType | IncomeAccountDebitType;
export type ExpenseTaxCategoryType = typeof EXPENSE_TAX_CATEGORY_OPTIONS[number];
export type IncomeTaxCategoryType = typeof INCOME_TAX_CATEGORY_OPTIONS[number];
export type TaxCategoryType = ExpenseTaxCategoryType | IncomeTaxCategoryType;
