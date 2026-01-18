// 勘定科目（借方）- Debit account categories
export const ACCOUNT_DEBIT_OPTIONS = [
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

// 税区分 - Tax categories
export const TAX_CATEGORY_OPTIONS = [
  '課対仕入内10%',
  '課対仕入内8%（軽）',
  '課対仕入10%',
  '課対仕入8%（軽）',
  '非課税仕入',
  '不課税仕入',
  '対象外',
] as const;

// Types
export type AccountDebitType = typeof ACCOUNT_DEBIT_OPTIONS[number];
export type TaxCategoryType = typeof TAX_CATEGORY_OPTIONS[number];
