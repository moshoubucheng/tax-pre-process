import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../services/password';
import { extractReceiptData, validateImageType } from '../services/ai-ocr';
import { createTransaction, getTransactionById } from '../db/queries';

const upload = new Hono<{ Bindings: Env }>();

// Apply auth middleware
upload.use('*', authMiddleware);

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

// POST /api/upload - Upload receipt image
upload.post('/', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    // Parse multipart form data
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return c.json({ error: 'ファイルが見つかりません' }, 400);
    }

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
      },
    });

    // Extract receipt data using Claude
    const aiResult = await extractReceiptData(
      c.env.CLAUDE_API_KEY,
      arrayBuffer,
      mimeType
    );

    // Create transaction record
    const transactionId = generateId('txn');
    await createTransaction(c.env.DB, {
      id: transactionId,
      company_id: user.company_id,
      uploaded_by: user.sub,
      image_key: key,
      image_uploaded_at: timestamp,
      transaction_date: aiResult.transaction_date,
      amount: aiResult.amount,
      vendor_name: aiResult.vendor_name,
      account_debit: aiResult.account_debit,
      account_credit: '現金',
      tax_category: aiResult.tax_category,
      ai_confidence: aiResult.confidence,
      ai_raw_response: aiResult.raw_response || null,
      status: aiResult.confidence >= 70 ? 'pending' : 'pending', // Always pending, user must confirm
    });

    return c.json({
      transaction_id: transactionId,
      image_key: key,
      ai_result: {
        transaction_date: aiResult.transaction_date,
        amount: aiResult.amount,
        vendor_name: aiResult.vendor_name,
        account_debit: aiResult.account_debit,
        tax_category: aiResult.tax_category,
        confidence: aiResult.confidence,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'アップロードに失敗しました' }, 500);
  }
});

// GET /api/upload/image/:key - Get image from R2
upload.get('/image/*', async (c) => {
  try {
    const user = c.get('user');

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
    if (user.role !== 'admin') {
      const result = await c.env.DB
        .prepare('SELECT company_id FROM transactions WHERE image_key = ?')
        .bind(key)
        .first<{ company_id: string }>();

      if (!result || result.company_id !== user.company_id) {
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
    const user = c.get('user');
    const transactionId = c.req.param('id');

    // Get transaction
    const transaction = await getTransactionById(c.env.DB, transactionId);

    if (!transaction) {
      return c.json({ error: '取引が見つかりません' }, 404);
    }

    // Check access permission
    if (user.role !== 'admin' && transaction.company_id !== user.company_id) {
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
