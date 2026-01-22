import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';
import { generateId } from '../services/password';
import {
  getCompanyDocuments,
  createCompanyDocuments,
  updateCompanyDocuments,
  getCompanyById,
} from '../db/queries';

const documents = new Hono<{ Bindings: Env }>();

// Apply auth middleware to all routes
documents.use('*', authMiddleware);

// PDF field names mapping
const PDF_FIELDS = [
  'tohon', 'teikan', 'zairyu_card', 'juminhyo', 'kaigyo_doc'
] as const;

const PDF_FIELD_LABELS: Record<string, string> = {
  tohon: '謄本',
  teikan: '定款',
  zairyu_card: '社長・家族在留カード',
  juminhyo: '住民票',
  kaigyo_doc: '開業届出書類',
};

// Helper to create notification
async function createNotification(
  db: D1Database,
  data: {
    company_id: string;
    company_name: string;
    type: 'submitted' | 'file_uploaded';
    field_name?: string;
    message: string;
  }
) {
  const id = generateId('notif');
  await db.prepare(
    `INSERT INTO document_notifications (id, company_id, company_name, type, field_name, message)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(id, data.company_id, data.company_name, data.type, data.field_name || null, data.message).run();
}

// GET /api/documents - Get company documents
documents.get('/', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    let docs = await getCompanyDocuments(c.env.DB, user.company_id);

    // If no record exists, create one
    if (!docs) {
      const id = generateId('doc');
      await createCompanyDocuments(c.env.DB, { id, company_id: user.company_id });
      docs = await getCompanyDocuments(c.env.DB, user.company_id);
    }

    return c.json({ data: docs });
  } catch (error) {
    console.error('Get documents error:', error);
    return c.json({ error: '書類情報の取得に失敗しました' }, 500);
  }
});

// PUT /api/documents - Update company documents (text fields)
documents.put('/', async (c) => {
  try {
    const user = c.get('user');
    const body = await c.req.json();

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    // Get current document
    let docs = await getCompanyDocuments(c.env.DB, user.company_id);

    if (!docs) {
      const id = generateId('doc');
      await createCompanyDocuments(c.env.DB, { id, company_id: user.company_id });
      docs = await getCompanyDocuments(c.env.DB, user.company_id);
    }

    // Check if confirmed (only admin can update confirmed docs)
    if (docs?.status === 'confirmed' && user.role !== 'admin') {
      return c.json({ error: '確認済みの書類は変更できません' }, 403);
    }

    // Update text fields
    await updateCompanyDocuments(c.env.DB, user.company_id, {
      shacho_phone: body.shacho_phone,
      shacho_name_reading: body.shacho_name_reading,
      kazoku_info: body.kazoku_info,
      shacho_income: body.shacho_income,
      kazoku_income: body.kazoku_income,
      salary_start_date: body.salary_start_date,
      kousei_nenkin: body.kousei_nenkin,
      kokuzei_info: body.kokuzei_info,
      chihouzei_info: body.chihouzei_info,
      business_year_start: body.business_year_start,
      business_year_end: body.business_year_end,
    });

    const updated = await getCompanyDocuments(c.env.DB, user.company_id);
    return c.json({ data: updated });
  } catch (error) {
    console.error('Update documents error:', error);
    return c.json({ error: '書類情報の更新に失敗しました' }, 500);
  }
});

// POST /api/documents/upload/:field - Upload PDF
documents.post('/upload/:field', async (c) => {
  try {
    const user = c.get('user');
    const field = c.req.param('field') as typeof PDF_FIELDS[number];

    if (!PDF_FIELDS.includes(field)) {
      return c.json({ error: '無効なフィールドです' }, 400);
    }

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    // Get current document
    let docs = await getCompanyDocuments(c.env.DB, user.company_id);

    if (!docs) {
      const id = generateId('doc');
      await createCompanyDocuments(c.env.DB, { id, company_id: user.company_id });
      docs = await getCompanyDocuments(c.env.DB, user.company_id);
    }

    // Check if confirmed (only admin can update confirmed docs)
    if (docs?.status === 'confirmed' && user.role !== 'admin') {
      return c.json({ error: '確認済みの書類は変更できません' }, 403);
    }

    // Parse form data
    const formData = await c.req.formData();
    const fileEntry = formData.get('file');

    if (!fileEntry || typeof fileEntry === 'string') {
      return c.json({ error: 'ファイルが見つかりません' }, 400);
    }

    const file = fileEntry as File;

    // Validate file type
    if (file.type !== 'application/pdf') {
      return c.json({ error: 'PDFファイルのみアップロードできます' }, 400);
    }

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      return c.json({ error: 'ファイルサイズは10MB以下にしてください' }, 400);
    }

    // Generate R2 key
    const timestamp = new Date().toISOString();
    const key = `documents/${user.company_id}/${field}_${Date.now()}.pdf`;

    // Delete old file if exists
    const oldKeyField = `${field}_key` as keyof typeof docs;
    const oldKey = docs?.[oldKeyField];
    if (oldKey && typeof oldKey === 'string') {
      try {
        await c.env.BUCKET.delete(oldKey);
      } catch (e) {
        console.error('Failed to delete old file:', e);
      }
    }

    // Upload to R2
    const arrayBuffer = await file.arrayBuffer();
    await c.env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: 'application/pdf',
      },
      customMetadata: {
        uploadedAt: timestamp,
        uploadedBy: user.sub,
        originalName: file.name,
      },
    });

    // Update database
    const updateData: Record<string, string> = {};
    updateData[`${field}_key`] = key;
    await updateCompanyDocuments(c.env.DB, user.company_id, updateData);

    // Create notification for admin (only for client uploads)
    if (user.role !== 'admin') {
      const company = await getCompanyById(c.env.DB, user.company_id);
      if (company) {
        const fieldLabel = PDF_FIELD_LABELS[field] || field;
        await createNotification(c.env.DB, {
          company_id: user.company_id,
          company_name: company.name,
          type: 'file_uploaded',
          field_name: field,
          message: `${company.name}が「${fieldLabel}」をアップロードしました`,
        });
      }
    }

    return c.json({ key, message: 'アップロードしました' });
  } catch (error) {
    console.error('Upload PDF error:', error);
    return c.json({ error: 'アップロードに失敗しました' }, 500);
  }
});

// GET /api/documents/file/:field - Get PDF file
documents.get('/file/:field', async (c) => {
  try {
    const user = c.get('user');
    const field = c.req.param('field') as typeof PDF_FIELDS[number];

    if (!PDF_FIELDS.includes(field)) {
      return c.json({ error: '無効なフィールドです' }, 400);
    }

    // Allow admin to view any company's files
    let companyId = user.company_id;
    if (user.role === 'admin') {
      const queryCompanyId = c.req.query('company_id');
      if (queryCompanyId) {
        companyId = queryCompanyId;
      }
    }

    if (!companyId) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const docs = await getCompanyDocuments(c.env.DB, companyId);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    const keyField = `${field}_key` as keyof typeof docs;
    const key = docs[keyField];

    if (!key || typeof key !== 'string') {
      return c.json({ error: 'ファイルが見つかりません' }, 404);
    }

    const object = await c.env.BUCKET.get(key);
    if (!object) {
      return c.json({ error: 'ファイルが見つかりません' }, 404);
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${field}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Get PDF error:', error);
    return c.json({ error: 'ファイルの取得に失敗しました' }, 500);
  }
});

// PUT /api/documents/submit - Submit documents for review
documents.put('/submit', async (c) => {
  try {
    const user = c.get('user');

    if (!user.company_id) {
      return c.json({ error: '会社情報が見つかりません' }, 400);
    }

    const docs = await getCompanyDocuments(c.env.DB, user.company_id);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    if (docs.status === 'confirmed') {
      return c.json({ error: 'すでに確認済みです' }, 400);
    }

    await updateCompanyDocuments(c.env.DB, user.company_id, {
      status: 'submitted',
    });

    // Create notification for admin
    const company = await getCompanyById(c.env.DB, user.company_id);
    if (company) {
      await createNotification(c.env.DB, {
        company_id: user.company_id,
        company_name: company.name,
        type: 'submitted',
        message: `${company.name}が基礎資料を提出しました`,
      });
    }

    return c.json({ message: '提出しました' });
  } catch (error) {
    console.error('Submit documents error:', error);
    return c.json({ error: '提出に失敗しました' }, 500);
  }
});

// PUT /api/documents/confirm/:companyId - Confirm documents (Admin only)
documents.put('/confirm/:companyId', async (c) => {
  try {
    const user = c.get('user');
    const companyId = c.req.param('companyId');

    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが確認できます' }, 403);
    }

    const docs = await getCompanyDocuments(c.env.DB, companyId);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    await updateCompanyDocuments(c.env.DB, companyId, {
      status: 'confirmed',
      confirmed_by: user.sub,
      confirmed_at: new Date().toISOString(),
    });

    return c.json({ message: '確認しました' });
  } catch (error) {
    console.error('Confirm documents error:', error);
    return c.json({ error: '確認に失敗しました' }, 500);
  }
});

// PUT /api/documents/unlock/:companyId - Unlock documents for editing (Admin only)
documents.put('/unlock/:companyId', async (c) => {
  try {
    const user = c.get('user');
    const companyId = c.req.param('companyId');

    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが解除できます' }, 403);
    }

    const docs = await getCompanyDocuments(c.env.DB, companyId);
    if (!docs) {
      return c.json({ error: '書類が見つかりません' }, 404);
    }

    await updateCompanyDocuments(c.env.DB, companyId, {
      status: 'submitted',
      confirmed_by: null,
      confirmed_at: null,
    });

    return c.json({ message: '編集を許可しました' });
  } catch (error) {
    console.error('Unlock documents error:', error);
    return c.json({ error: '解除に失敗しました' }, 500);
  }
});

// GET /api/documents/:companyId - Get company documents (Admin)
documents.get('/:companyId', async (c) => {
  try {
    const user = c.get('user');
    const companyId = c.req.param('companyId');

    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみがアクセスできます' }, 403);
    }

    const docs = await getCompanyDocuments(c.env.DB, companyId);
    return c.json({ data: docs });
  } catch (error) {
    console.error('Get company documents error:', error);
    return c.json({ error: '書類情報の取得に失敗しました' }, 500);
  }
});

// PUT /api/documents/batch-confirm - Batch confirm documents (Admin only)
documents.put('/batch-confirm', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが実行できます' }, 403);
    }

    const { company_ids } = await c.req.json<{ company_ids: string[] }>();

    if (!company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
      return c.json({ error: '確認する会社を選択してください' }, 400);
    }

    const now = new Date().toISOString();
    let successCount = 0;

    for (const companyId of company_ids) {
      const docs = await getCompanyDocuments(c.env.DB, companyId);
      if (docs && docs.status !== 'confirmed') {
        await updateCompanyDocuments(c.env.DB, companyId, {
          status: 'confirmed',
          confirmed_by: user.sub,
          confirmed_at: now,
        });
        successCount++;
      }
    }

    return c.json({ message: `${successCount}件の資料を確認しました` });
  } catch (error) {
    console.error('Batch confirm error:', error);
    return c.json({ error: '一括確認に失敗しました' }, 500);
  }
});

// PUT /api/documents/batch-unlock - Batch unlock documents (Admin only)
documents.put('/batch-unlock', async (c) => {
  try {
    const user = c.get('user');

    if (user.role !== 'admin') {
      return c.json({ error: '管理者のみが実行できます' }, 403);
    }

    const { company_ids } = await c.req.json<{ company_ids: string[] }>();

    if (!company_ids || !Array.isArray(company_ids) || company_ids.length === 0) {
      return c.json({ error: '解除する会社を選択してください' }, 400);
    }

    let successCount = 0;

    for (const companyId of company_ids) {
      const docs = await getCompanyDocuments(c.env.DB, companyId);
      if (docs && docs.status === 'confirmed') {
        await updateCompanyDocuments(c.env.DB, companyId, {
          status: 'submitted',
          confirmed_by: null,
          confirmed_at: null,
        });
        successCount++;
      }
    }

    return c.json({ message: `${successCount}件の資料を解除しました` });
  } catch (error) {
    console.error('Batch unlock error:', error);
    return c.json({ error: '一括解除に失敗しました' }, 500);
  }
});

export default documents;

// Note: Admin edit route is mounted at /api/admin/documents/:companyId in admin.ts
