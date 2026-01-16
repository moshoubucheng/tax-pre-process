import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';

interface CompanyDocuments {
  id: string;
  company_id: string;
  tohon_key: string | null;
  teikan_key: string | null;
  zairyu_card_key: string | null;
  juminhyo_key: string | null;
  kaigyo_doc1_key: string | null;
  kaigyo_doc2_key: string | null;
  kaigyo_doc3_key: string | null;
  kaigyo_doc4_key: string | null;
  kaigyo_doc5_key: string | null;
  kaigyo_doc6_key: string | null;
  shacho_phone: string | null;
  shacho_name_reading: string | null;
  kazoku_name_reading: string | null;
  kazoku_info: string | null;
  shacho_income: string | null;
  kazoku_income: string | null;
  salary_start_date: string | null;
  kousei_nenkin: string | null;
  kokuzei_info: string | null;
  chihouzei_info: string | null;
  status: 'draft' | 'submitted' | 'confirmed';
  confirmed_at: string | null;
}

const PDF_FIELDS = [
  { key: 'tohon', label: '謄本', required: true },
  { key: 'teikan', label: '定款', required: true },
  { key: 'zairyu_card', label: '社長・家族在留カード', required: true },
  { key: 'juminhyo', label: '住民票（マイナンバー記載）', required: true },
  { key: 'kaigyo_doc', label: '開業届出書類', required: false },
] as const;

export default function Documents() {
  const [docs, setDocs] = useState<CompanyDocuments | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    shacho_name_reading: '',
    shacho_phone: '',
    kazoku_info: '',
    shacho_income: '',
    kazoku_income: '',
    salary_start_date: '',
    kousei_nenkin: '',
    kokuzei_info: '',
    chihouzei_info: '',
  });

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    try {
      const res = await api.get<{ data: CompanyDocuments }>('/documents');
      if (res.data) {
        setDocs(res.data);
        setFormData({
          shacho_name_reading: res.data.shacho_name_reading || '',
          shacho_phone: res.data.shacho_phone || '',
          kazoku_info: res.data.kazoku_info || '',
          shacho_income: res.data.shacho_income || '',
          kazoku_income: res.data.kazoku_income || '',
          salary_start_date: res.data.salary_start_date || '',
          kousei_nenkin: res.data.kousei_nenkin || '',
          kokuzei_info: res.data.kokuzei_info || '',
          chihouzei_info: res.data.chihouzei_info || '',
        });
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.put('/documents', formData);
      await loadDocuments();
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(field: string, file: File) {
    setUploading(field);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.PROD
        ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
        : '/api';

      const res = await fetch(`${baseUrl}/documents/upload/${field}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'アップロードに失敗しました');
      }

      await loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(null);
    }
  }

  async function handleSubmit() {
    if (!confirm('提出してよろしいですか？')) return;

    setSubmitting(true);
    try {
      // Save first
      await api.put('/documents', formData);
      // Then submit
      await api.put('/documents/submit', {});
      await loadDocuments();
      alert('提出しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '提出に失敗しました');
    } finally {
      setSubmitting(false);
    }
  }

  function getFileUrl(field: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/documents/file/${field}?token=${token}`;
  }

  const isLocked = docs?.status === 'confirmed';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">会社書類</h1>
        <div className="flex items-center gap-2">
          {docs?.status === 'draft' && (
            <span className="text-sm px-2 py-1 bg-gray-100 text-gray-600 rounded">下書き</span>
          )}
          {docs?.status === 'submitted' && (
            <span className="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded">確認待ち</span>
          )}
          {docs?.status === 'confirmed' && (
            <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">確認済</span>
          )}
        </div>
      </div>

      {isLocked && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
          管理者により確認済みです。変更が必要な場合は管理者にご連絡ください。
        </div>
      )}

      {/* PDF Uploads */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">書類アップロード（PDF）</h2>

        <div className="space-y-3">
          {PDF_FIELDS.map((field) => {
            const keyField = `${field.key}_key` as keyof CompanyDocuments;
            const hasFile = docs && docs[keyField];

            return (
              <div key={field.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-900">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                  {hasFile && (
                    <a
                      href={getFileUrl(field.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-primary-600 hover:underline"
                    >
                      確認する
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {hasFile ? (
                    <span className="text-xs text-green-600">アップロード済</span>
                  ) : (
                    <span className="text-xs text-gray-400">未アップロード</span>
                  )}
                  <input
                    ref={(el) => fileInputRefs.current[field.key] = el}
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={isLocked}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(field.key, file);
                    }}
                  />
                  <button
                    onClick={() => fileInputRefs.current[field.key]?.click()}
                    disabled={isLocked || uploading === field.key}
                    className="px-3 py-1 text-sm bg-primary-600 text-white rounded disabled:opacity-50"
                  >
                    {uploading === field.key ? '...' : hasFile ? '変更' : '選択'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Text Fields */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">その他の情報</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              社長名（フリガナ）
            </label>
            <input
              type="text"
              value={formData.shacho_name_reading}
              onChange={(e) => setFormData({ ...formData, shacho_name_reading: e.target.value })}
              disabled={isLocked}
              placeholder="例: ヤマダ タロウ"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              社長連絡先電話番号
            </label>
            <input
              type="tel"
              value={formData.shacho_phone}
              onChange={(e) => setFormData({ ...formData, shacho_phone: e.target.value })}
              disabled={isLocked}
              placeholder="例: 090-1234-5678"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              家族情報（名前、読み、収入有無）
            </label>
            <textarea
              value={formData.kazoku_info}
              onChange={(e) => setFormData({ ...formData, kazoku_info: e.target.value })}
              disabled={isLocked}
              placeholder="例: 山田花子（ヤマダ ハナコ）、収入あり（パート月10万円）"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                社長年収
              </label>
              <input
                type="text"
                value={formData.shacho_income}
                onChange={(e) => setFormData({ ...formData, shacho_income: e.target.value })}
                disabled={isLocked}
                placeholder="例: 500万円"
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                家族年収
              </label>
              <input
                type="text"
                value={formData.kazoku_income}
                onChange={(e) => setFormData({ ...formData, kazoku_income: e.target.value })}
                disabled={isLocked}
                placeholder="例: 120万円"
                className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              給与支給開始時期
            </label>
            <input
              type="text"
              value={formData.salary_start_date}
              onChange={(e) => setFormData({ ...formData, salary_start_date: e.target.value })}
              disabled={isLocked}
              placeholder="例: 2024年4月から"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              厚生年金
            </label>
            <input
              type="text"
              value={formData.kousei_nenkin}
              onChange={(e) => setFormData({ ...formData, kousei_nenkin: e.target.value })}
              disabled={isLocked}
              placeholder="例: 2024年4月から加入 / まだ加入していない"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              国税情報（ID・パスワード）
            </label>
            <input
              type="text"
              value={formData.kokuzei_info}
              onChange={(e) => setFormData({ ...formData, kokuzei_info: e.target.value })}
              disabled={isLocked}
              placeholder="例: ID: xxxxx / PW: xxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地方税情報（ID・パスワード）
            </label>
            <input
              type="text"
              value={formData.chihouzei_info}
              onChange={(e) => setFormData({ ...formData, chihouzei_info: e.target.value })}
              disabled={isLocked}
              placeholder="例: ID: xxxxx / PW: xxxxx"
              className="w-full px-3 py-2 border border-gray-300 rounded-md disabled:bg-gray-100"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isLocked && (
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4">
          <div className="max-w-7xl mx-auto flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? '保存中...' : '一時保存'}
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || docs?.status === 'submitted'}
              className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {submitting ? '提出中...' : docs?.status === 'submitted' ? '提出済み' : '提出する'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
