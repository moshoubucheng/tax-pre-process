import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../services/password';
import { extractReceiptData, validateImageType, TransactionType } from '../services/ai-ocr';
import { createTransaction, getTransactionById } from '../db/queries';
import { verifyJWT } from '../services/jwt';

const upload = new Hono<{ Bindings: Env }>();

// Apply auth middleware to non-image routes
upload.use('*', async (c, next) => {
  // Skip auth middleware for image routes (they handle auth via query param)
  if (c.req.path.includes('/image')) {
    return next();
  }
  return authMiddleware(c, next);
});

// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Generate R2 key with timestamp for 電子帳簿保存法 compliance
 * Format: receipts/{year}/{month}/{timestamp}_{uuid}.{ext}
 */
function generateR2Key(mimeType: string): { key: string; timestamp: string } {
  const now = new Date();
  const timestamp = now.toISOString();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const uuid = generateId();

  const ext = mimeType === 'image/png' ? 'png' :
              mimeType === 'image/gif' ? 'gif' :
              mimeType === 'image/webp' ? 'webp' : 'jpg';

  const key = `receipts/${year}/${month}/${timestamp.replace(/[:.]/g, '-')}_${uuid}.${ext}`;

  return { key, timestamp };
}

// POST /api/upload - Upload receipt/invoice image with AI OCR
upload.post('/', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');
    const typeEntry = formData.get('type') as string | null;

    // Validate and get transaction type (default: expense)
    const transactionType: TransactionType =
      typeEntry === 'income' ? 'income' : 'expense';

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'ファイルが見つかりません' }, 400);
    }

    const file = fileEntry as File;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'ファイルサイズは10MB以下にしてください' }, 400);
    }

    // Validate mime type
    const mimeType = validateImageType(file.type);
    if (!mimeType) {
      return c.json({ error: '対応していないファイル形式です (JPEG, PNG, GIF, WebP のみ)' }, 400);
    }

    // Read file data
    const arrayBuffer = await file.arrayBuffer();

    // Generate R2 key with timestamp
    const { key, timestamp } = generateR2Key(mimeType);

    // Upload to R2
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        uploadedAt: timestamp,
        uploadedBy: user.sub,
        originalName: file.name,
        transactionType: transactionType,
      },
    });

    // Extract receipt/invoice data using Claude (with type-specific prompt)
    const aiResult = await extractReceiptData(
      c.env.CLAUDE_API_KEY,
      arrayBuffer,
      mimeType,
      transactionType
    );

    // Create transaction record
    const transactionId = generateId('txn');
    await createTransaction(c.env.DB, {
      id: transactionId,
      company_id: user.company_id,
      uploaded_by: user.sub,
      image_key: key,
      image_uploaded_at: timestamp,
      type: transactionType,
      transaction_date: aiResult.transaction_date,
      amount: aiResult.amount,
      vendor_name: aiResult.vendor_name,
      account_debit: aiResult.account_debit,
      account_credit: aiResult.account_credit || (transactionType === 'income' ? '売上高' : '現金'),
      tax_category: aiResult.tax_category,
      tax_rate: aiResult.tax_rate,
      invoice_number: aiResult.invoice_number,
      ai_confidence: aiResult.confidence,
      ai_raw_response: aiResult.raw_response || null,
      description: null,
      admin_note: null,
      status: 'pending', // Always pending, user must confirm
    });

    return c.json({
      transaction_id: transactionId,
      image_key: key,
      type: transactionType,
      ai_result: {
        transaction_date: aiResult.transaction_date,
        amount: aiResult.amount,
        vendor_name: aiResult.vendor_name,
        account_debit: aiResult.account_debit,
        account_credit: aiResult.account_credit,
        tax_category: aiResult.tax_category,
        tax_rate: aiResult.tax_rate,
        invoice_number: aiResult.invoice_number,
        confidence: aiResult.confidence,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'アップロードに失敗しました' }, 500);
  }
});

// POST /api/upload/manual - Create transaction manually with image (no AI)
upload.post('/manual', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: '画像ファイルは必須です' }, 400);
    }

    const file = fileEntry as File;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'ファイルサイズは10MB以下にしてください' }, 400);
    }

    // Validate mime type
    const mimeType = validateImageType(file.type);
    if (!mimeType) {
      return c.json({ error: '対応していないファイル形式です (JPEG, PNG, GIF, WebP のみ)' }, 400);
    }

    // Get form fields
    const typeEntry = formData.get('type') as string | null;
    const transactionType: TransactionType =
      typeEntry === 'income' ? 'income' : 'expense';
    const transaction_date = formData.get('transaction_date') as string;
    const amount = formData.get('amount') as string;
    const vendor_name = formData.get('vendor_name') as string;
    const account_debit = formData.get('account_debit') as string;
    const account_credit = formData.get('account_credit') as string;
    const tax_category = formData.get('tax_category') as string;
    const tax_rate_str = formData.get('tax_rate') as string;
    const invoice_number = formData.get('invoice_number') as string;

    // Validate required fields
    if (!transaction_date || !amount) {
      return c.json({ error: '日付と金額は必須です' }, 400);
    }

    // Validate amount: must be positive integer within reasonable range
    const amountNum = parseInt(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return c.json({ error: '金額は1円以上の正の整数を入力してください' }, 400);
    }
    if (amountNum > 999999999) {
      return c.json({ error: '金額が大きすぎます（上限: 999,999,999円）' }, 400);
    }

    // Validate transaction date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(transaction_date)) {
      return c.json({ error: '日付の形式が正しくありません (YYYY-MM-DD)' }, 400);
    }

    // Parse tax_rate (default 10)
    const tax_rate = tax_rate_str ? parseInt(tax_rate_str) : 10;

    // Read file data
    const arrayBuffer = await file.arrayBuffer();

    // Generate R2 key with timestamp
    const { key, timestamp } = generateR2Key(mimeType);

    // Upload to R2
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: mimeType,
      },
      customMetadata: {
        uploadedAt: timestamp,
        uploadedBy: user.sub,
        originalName: file.name,
        inputMode: 'manual',
        transactionType: transactionType,
      },
    });

    const transactionId = generateId('txn');

    // Set default accounts based on type
    const defaultAccountDebit = transactionType === 'income' ? '売掛金' : null;
    const defaultAccountCredit = transactionType === 'income' ? '売上高' : '現金';

    await createTransaction(c.env.DB, {
      id: transactionId,
      company_id: user.company_id,
      uploaded_by: user.sub,
      image_key: key,
      image_uploaded_at: timestamp,
      type: transactionType,
      transaction_date: transaction_date,
      amount: amountNum,
      vendor_name: vendor_name || null,
      account_debit: account_debit || defaultAccountDebit,
      account_credit: account_credit || defaultAccountCredit,
      tax_category: tax_category || null,
      tax_rate: tax_rate,
      invoice_number: invoice_number || null,
      ai_confidence: null, // No AI for manual input
      ai_raw_response: null,
      description: null,
      admin_note: null,
      status: 'pending',
    });

    return c.json({
      transaction_id: transactionId,
      type: transactionType,
      message: '手動入力で保存しました',
    });
  } catch (error) {
    console.error('Manual input error:', error);
    return c.json({ error: '保存に失敗しました' }, 500);
  }
});

// GET /api/upload/image/:key - Get image from R2
upload.get('/image/*', async (c) => {
  try {
    // Get token from query param (for img src) or Authorization header
    const queryToken = c.req.query('token');
    const authHeader = c.req.header('Authorization');
    const token = queryToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      return c.json({ error: '認証が必要です' }, 401);
    }

    // Verify token
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: 'トークンが無効または期限切れです' }, 401);
    }

    // Get the full path after /image/
    const key = c.req.path.replace('/api/upload/image/', '');

    if (!key) {
      return c.json({ error: 'キーが指定されていません' }, 400);
    }

    // Get object from R2
    const object = await c.env.BUCKET.get(key);

    if (!object) {
      return c.json({ error: '画像が見つかりません' }, 404);
    }

    // For security, verify user has access to this image
    // Check if there's a transaction with this image_key that belongs to user's company
    // (Skip this check for admins)
    if (payload.role !== 'admin') {
      const result = await c.env.DB
        .prepare('SELECT company_id FROM transactions WHERE image_key = ?')
        .bind(key)
        .first<{ company_id: string }>();

      if (!result || result.company_id !== payload.company_id) {
        return c.json({ error: 'アクセス権限がありません' }, 403);
      }
    }

    // Return image with proper headers
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Get image error:', error);
    return c.json({ error: '画像の取得に失敗しました' }, 500);
  }
});

// GET /api/upload/transaction/:id/image - Get image by transaction ID
upload.get('/transaction/:id/image', async (c) => {
  try {
    // Get token from query param (for img src) or Authorization header
    const queryToken = c.req.query('token');
    const authHeader = c.req.header('Authorization');
    const token = queryToken || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

    if (!token) {
      return c.json({ error: '認証が必要です' }, 401);
    }

    // Verify token
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (!payload) {
      return c.json({ error: 'トークンが無効または期限切れです' }, 401);
    }

    const transactionId = c.req.param('id');

    // Get transaction
    const transaction = await getTransactionById(c.env.DB, transactionId);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (payload.role !== 'admin' && transaction.company_id !== payload.company_id) {
      return c.json({ error: 'アクセス権限がありません' }, 403);
    }

    // Get object from R2
    const object = await c.env.BUCKET.get(transaction.image_key);

    if (!object) {
      return c.json({ error: '画像が見つかりません' }, 404);
    }

    // Return image
    const headers = new Headers();
    headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    headers.set('Cache-Control', 'private, max-age=3600');

    return new Response(object.body, { headers });
  } catch (error) {
    console.error('Get transaction image error:', error);
    return c.json({ error: '画像の取得に失敗しました' }, 500);
  }
});

export default upload;
