import Anthropic from '@anthropic-ai/sdk';
import type { AIExtractionResult } from '../types';

/**
 * Transaction type
 */
export type TransactionType = 'expense' | 'income';

/**
 * Common Japanese expense account titles (勘定科目 - 経費)
 */
const EXPENSE_ACCOUNT_TITLES = [
  '旅費交通費',
  '接待交際費',
  '会議費',
  '消耗品費',
  '通信費',
  '事務用品費',
  '水道光熱費',
  '広告宣伝費',
  '外注費',
  '新聞図書費',
  '租税公課',
  '保険料',
  '修繕費',
  '車両費',
  '福利厚生費',
  '仕入高',
  '雑費',
];

/**
 * Common Japanese income account titles (勘定科目 - 売上)
 */
const INCOME_ACCOUNT_TITLES = [
  '売上高',
  '雑収入',
];

/**
 * System prompt for EXPENSE (領収書/レシート) OCR
 */
const EXPENSE_OCR_PROMPT = `あなたは日本の領収書・レシートを解析するアシスタントです。
画像から以下の情報を正確に抽出してください：

1. 取引日付 (YYYY-MM-DD形式)
2. 金額 (数字のみ、カンマや円記号なし)
3. 店名・取引先名
4. 推測される勘定科目 (借方科目、以下から選択):
   ${EXPENSE_ACCOUNT_TITLES.join(', ')}
5. 税率の判定 (重要):
   - 飲食料品（テイクアウト・お弁当・飲料等）: 8
   - 新聞（定期購読）: 8
   - その他の商品・サービス: 10
   - 電車・バス等の交通費: 10
6. 税区分:
   - 8%の場合: 課対仕入内8%(軽)
   - 10%の場合: 課対仕入内10%
7. インボイス番号 (適格請求書発行事業者登録番号):
   - "T"で始まる13桁の数字 (例: T1234567890123)
   - 領収書やレシートに「登録番号」「T-」などの記載を探す
   - 見つからない場合はnull

JSONで回答してください。読み取れない項目はnullにしてください。
信頼度(confidence)は0-100で、全体の読み取り精度を示してください。

回答例:
{
  "transaction_date": "2024-01-15",
  "amount": 1500,
  "vendor_name": "セブンイレブン",
  "account_debit": "消耗品費",
  "account_credit": "現金",
  "tax_rate": 8,
  "tax_category": "課対仕入内8%(軽)",
  "invoice_number": "T1234567890123",
  "confidence": 85
}`;

/**
 * System prompt for INCOME (請求書/売上) OCR
 */
const INCOME_OCR_PROMPT = `あなたは日本の請求書・売上伝票を解析するアシスタントです。
画像から以下の情報を正確に抽出してください：

1. 請求日付/売上日付 (YYYY-MM-DD形式)
2. 請求金額/売上金額 (数字のみ、カンマや円記号なし)
3. 取引先名（請求先/顧客名）
4. 推測される勘定科目 (貸方科目、以下から選択):
   ${INCOME_ACCOUNT_TITLES.join(', ')}
5. 税率の判定:
   - 飲食料品（テイクアウト等）の売上: 8
   - その他の商品・サービスの売上: 10
6. 税区分:
   - 8%の場合: 課税売上8%
   - 10%の場合: 課税売上10%

JSONで回答してください。読み取れない項目はnullにしてください。
信頼度(confidence)は0-100で、全体の読み取り精度を示してください。

回答例:
{
  "transaction_date": "2024-01-15",
  "amount": 50000,
  "vendor_name": "株式会社ABC",
  "account_debit": "売掛金",
  "account_credit": "売上高",
  "tax_rate": 10,
  "tax_category": "課税売上10%",
  "invoice_number": null,
  "confidence": 90
}`;

/**
 * Extract receipt/invoice data using Claude Vision API
 */
export async function extractReceiptData(
  apiKey: string,
  imageData: ArrayBuffer,
  mimeType: string,
  type: TransactionType = 'expense'
): Promise<AIExtractionResult> {
  const client = new Anthropic({ apiKey });

  // Convert ArrayBuffer to base64
  const base64 = arrayBufferToBase64(imageData);

  // Select appropriate prompt based on type
  const systemPrompt = type === 'income' ? INCOME_OCR_PROMPT : EXPENSE_OCR_PROMPT;
  const userMessage = type === 'income'
    ? 'この請求書/売上伝票の情報を抽出してください。'
    : 'この領収書/レシートの情報を抽出してください。';

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64,
              },
            },
            {
              type: 'text',
              text: userMessage,
            },
          ],
        },
      ],
      system: systemPrompt,
    });

    // Extract text content from response
    const textContent = response.content.find((c) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    const rawResponse = textContent.text;

    // Parse JSON from response
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Set default values based on type
    const defaultAccountDebit = type === 'income' ? '売掛金' : null;
    const defaultAccountCredit = type === 'income' ? '売上高' : '現金';
    const defaultTaxRate = parsed.tax_rate || 10;

    return {
      transaction_date: parsed.transaction_date || null,
      amount: parsed.amount ? Number(parsed.amount) : null,
      vendor_name: parsed.vendor_name || null,
      account_debit: parsed.account_debit || defaultAccountDebit,
      account_credit: parsed.account_credit || defaultAccountCredit,
      tax_category: parsed.tax_category || null,
      tax_rate: defaultTaxRate,
      invoice_number: parsed.invoice_number || null,
      confidence: parsed.confidence || 50,
      raw_response: rawResponse,
    };
  } catch (error) {
    console.error('Claude OCR error:', error);

    // Return empty result with low confidence on error
    return {
      transaction_date: null,
      amount: null,
      vendor_name: null,
      account_debit: null,
      account_credit: null,
      tax_category: null,
      tax_rate: null,
      invoice_number: null,
      confidence: 0,
      raw_response: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Validate and normalize mime type
 */
export function validateImageType(mimeType: string): string | null {
  const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const normalized = mimeType.toLowerCase();

  if (validTypes.includes(normalized)) {
    return normalized;
  }

  // Handle common variations
  if (normalized === 'image/jpg') {
    return 'image/jpeg';
  }

  return null;
}
