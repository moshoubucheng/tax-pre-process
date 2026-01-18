import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useClientContext } from '../../hooks/useClientContext';

interface CompanyDocuments {
  id: string;
  company_id: string;
  tohon_key: string | null;
  teikan_key: string | null;
  zairyu_card_key: string | null;
  juminhyo_key: string | null;
  kaigyo_doc_key: string | null;
  shacho_phone: string | null;
  shacho_name_reading: string | null;
  kazoku_info: string | null;
  shacho_income: string | null;
  kazoku_income: string | null;
  salary_start_date: string | null;
  kousei_nenkin: string | null;
  kokuzei_info: string | null;
  chihouzei_info: string | null;
  business_year_start: string | null;
  business_year_end: string | null;
  status: 'draft' | 'submitted' | 'confirmed';
  confirmed_at: string | null;
}

const PDF_FIELDS = [
  { key: 'tohon', label: '謄本' },
  { key: 'teikan', label: '定款' },
  { key: 'zairyu_card', label: '社長・家族在留カード' },
  { key: 'juminhyo', label: '住民票（マイナンバー記載）' },
  { key: 'kaigyo_doc', label: '開業届出書類' },
] as const;

export default function ClientDocuments() {
  const navigate = useNavigate();
  const { selectedClient } = useClientContext();
  const [docs, setDocs] = useState<CompanyDocuments | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
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
    business_year_start: '',
    business_year_end: '',
  });

  // Status actions
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    if (!selectedClient) {
      navigate('/clients');
      return;
    }
    loadDocuments();
  }, [selectedClient]);

  async function loadDocuments() {
    if (!selectedClient) return;
    try {
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${selectedClient.id}`);
      setDocs(res.data);
      if (res.data) {
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
          business_year_start: res.data.business_year_start || '',
          business_year_end: res.data.business_year_end || '',
        });
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }

  function getFileUrl(field: string): string {
    if (!selectedClient) return '';
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api' : '/api');
    return `${baseUrl}/documents/file/${field}?token=${token}&company_id=${selectedClient.id}`;
  }

  async function handleSave() {
    if (!selectedClient) return;
    setSaving(true);
    try {
      await api.put(`/admin/documents/${selectedClient.id}`, formData);
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${selectedClient.id}`);
      setDocs(res.data);
      setEditing(false);
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!selectedClient) return;
    setConfirming(true);
    try {
      await api.put(`/documents/confirm/${selectedClient.id}`, {});
      setDocs(docs ? { ...docs, status: 'confirmed' } : null);
      alert('確認しました。クライアントは編集できなくなりました。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirming(false);
    }
  }

  async function handleUnlock() {
    if (!selectedClient) return;
    setUnlocking(true);
    try {
      await api.put(`/documents/unlock/${selectedClient.id}`, {});
      setDocs(docs ? { ...docs, status: 'submitted' } : null);
      alert('編集を許可しました。クライアントが編集できるようになりました。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '解除に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  if (!selectedClient) return null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!docs) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
        基礎資料がまだ登録されていません
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Status Badge */}
      <div className="flex items-center justify-end">
        {docs.status === 'draft' && (
          <span className="text-sm px-2 py-1 bg-gray-100 text-gray-600 rounded">下書き</span>
        )}
        {docs.status === 'submitted' && (
          <span className="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded">確認待ち</span>
        )}
        {docs.status === 'confirmed' && (
          <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">確認済</span>
        )}
      </div>

      {/* PDF Files */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">PDF書類</h2>
        <div className="space-y-3">
          {PDF_FIELDS.map((field) => {
            const keyField = `${field.key}_key` as keyof CompanyDocuments;
            const hasFile = docs[keyField];
            return (
              <div key={field.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-900">{field.label}</span>
                {hasFile ? (
                  <div className="flex gap-3">
                    <a
                      href={getFileUrl(field.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary-600 hover:underline"
                    >
                      確認
                    </a>
                    <a
                      href={getFileUrl(field.key)}
                      download={`${field.label}.pdf`}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      ダウンロード
                    </a>
                  </div>
                ) : (
                  <span className="text-sm text-gray-400">未アップロード</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Business Year */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">事業年度</h2>
        {editing ? (
          <div>
            <div className="flex items-center gap-2">
              <select
                value={formData.business_year_start}
                onChange={(e) => setFormData({ ...formData, business_year_start: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">月を選択</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}月</option>
                ))}
              </select>
              <span className="text-gray-500">から</span>
              <select
                value={formData.business_year_end}
                onChange={(e) => setFormData({ ...formData, business_year_end: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">月を選択</option>
                {[...Array(12)].map((_, i) => (
                  <option key={i + 1} value={String(i + 1)}>{i + 1}月</option>
                ))}
              </select>
              <span className="text-gray-500">まで</span>
            </div>
          </div>
        ) : (
          <div className="text-sm">
            {docs.business_year_start && docs.business_year_end ? (
              <span className="font-medium">{docs.business_year_start}月 〜 {docs.business_year_end}月</span>
            ) : (
              <span className="text-gray-400">未設定</span>
            )}
          </div>
        )}
      </div>

      {/* Text Information */}
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <h2 className="font-semibold text-gray-900">その他の情報</h2>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">社長名（フリガナ）</label>
              <input
                type="text"
                value={formData.shacho_name_reading}
                onChange={(e) => setFormData({ ...formData, shacho_name_reading: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">社長連絡先電話番号</label>
              <input
                type="tel"
                value={formData.shacho_phone}
                onChange={(e) => setFormData({ ...formData, shacho_phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">家族情報</label>
              <textarea
                value={formData.kazoku_info}
                onChange={(e) => setFormData({ ...formData, kazoku_info: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">社長年収</label>
                <input
                  type="text"
                  value={formData.shacho_income}
                  onChange={(e) => setFormData({ ...formData, shacho_income: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">家族年収</label>
                <input
                  type="text"
                  value={formData.kazoku_income}
                  onChange={(e) => setFormData({ ...formData, kazoku_income: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">給与支給開始時期</label>
              <input
                type="text"
                value={formData.salary_start_date}
                onChange={(e) => setFormData({ ...formData, salary_start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">厚生年金</label>
              <input
                type="text"
                value={formData.kousei_nenkin}
                onChange={(e) => setFormData({ ...formData, kousei_nenkin: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">国税情報</label>
              <input
                type="text"
                value={formData.kokuzei_info}
                onChange={(e) => setFormData({ ...formData, kokuzei_info: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">地方税情報</label>
              <input
                type="text"
                value={formData.chihouzei_info}
                onChange={(e) => setFormData({ ...formData, chihouzei_info: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">社長名（フリガナ）</span>
              <span className="font-medium">{docs.shacho_name_reading || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">社長連絡先電話番号</span>
              <span className="font-medium">{docs.shacho_phone || '未入力'}</span>
            </div>
            <div className="py-2 border-b border-gray-100">
              <span className="text-gray-500 block mb-1">家族情報</span>
              <span className="font-medium whitespace-pre-wrap">{docs.kazoku_info || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">社長年収</span>
              <span className="font-medium">{docs.shacho_income || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">家族年収</span>
              <span className="font-medium">{docs.kazoku_income || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">給与支給開始時期</span>
              <span className="font-medium">{docs.salary_start_date || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">厚生年金</span>
              <span className="font-medium">{docs.kousei_nenkin || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-500">国税情報</span>
              <span className="font-medium">{docs.kokuzei_info || '未入力'}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-500">地方税情報</span>
              <span className="font-medium">{docs.chihouzei_info || '未入力'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4">
        <div className="max-w-7xl mx-auto flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium bg-white"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? '保存中...' : '保存'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditing(true)}
                className="flex-1 py-3 bg-gray-600 text-white rounded-lg font-medium"
              >
                編集
              </button>
              {docs.status !== 'confirmed' ? (
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {confirming ? '処理中...' : '確認する'}
                </button>
              ) : (
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
                >
                  {unlocking ? '処理中...' : '編集を許可'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
