// Cloudflare Bindings
export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  CLAUDE_API_KEY: string;
  JWT_SECRET: string;
  ENVIRONMENT: string;
}

// Database Models
export interface Company {
  id: string;
  name: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: 'admin' | 'client';
  company_id: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  company_id: string;
  uploaded_by: string;
  image_key: string;
  image_uploaded_at: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  account_credit: string;
  tax_category: string | null;
  ai_confidence: number | null;
  ai_raw_response: string | null;
  status: 'pending' | 'confirmed';
  created_at: string;
}

export interface CompanyDocuments {
  id: string;
  company_id: string;

  // PDF uploads (R2 keys)
  tohon_key: string | null;           // 謄本
  teikan_key: string | null;          // 定款
  zairyu_card_key: string | null;     // 在留カード
  juminhyo_key: string | null;        // 住民票
  kaigyo_doc_key: string | null;      // 開業届出書類

  // Text fields
  shacho_phone: string | null;        // 社长电话
  shacho_name_reading: string | null; // 社长名字读音
  kazoku_info: string | null;         // 家族信息（JSON）
  shacho_income: string | null;       // 社长收入
  kazoku_income: string | null;       // 家族收入
  salary_start_date: string | null;   // 工资开始日期
  kousei_nenkin: string | null;       // 厚生年金
  kokuzei_info: string | null;        // 国税信息
  chihouzei_info: string | null;      // 地方税信息
  business_year_start: string | null; // 事業年度開始月
  business_year_end: string | null;   // 事業年度終了月

  // Status
  status: 'draft' | 'submitted' | 'confirmed';
  confirmed_by: string | null;
  confirmed_at: string | null;

  created_at: string;
  updated_at: string;
}

// API DTOs
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: Omit<User, 'password_hash'>;
}

export interface UploadResponse {
  transaction_id: string;
  image_url: string;
  ai_result: AIExtractionResult;
}

export interface AIExtractionResult {
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  tax_category: string | null;
  confidence: number;
  raw_response?: string;
}

export interface DashboardStats {
  monthly_total: number;
  pending_count: number;
  confirmed_count: number;
}

export interface YayoiCSVRow {
  識別フラグ: string;
  伝票No: string;
  決算: string;
  取引日付: string;
  借方勘定科目: string;
  借方補助科目: string;
  借方部門: string;
  借方税区分: string;
  借方金額: string;
  借方税金額: string;
  貸方勘定科目: string;
  貸方補助科目: string;
  貸方部門: string;
  貸方税区分: string;
  貸方金額: string;
  貸方税金額: string;
  摘要: string;
  番号: string;
  期日: string;
  タイプ: string;
  生成元: string;
  仕訳メモ: string;
}

// JWT Payload
export interface JWTPayload {
  sub: string;       // user id
  email: string;
  role: 'admin' | 'client';
  company_id: string | null;
  exp: number;
  iat: number;
}
