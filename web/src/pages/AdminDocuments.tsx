import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Company {
  id: string;
  name: string;
}

interface CompanyWithDocs {
  id: string;
  name: string;
  doc_status: 'none' | 'draft' | 'submitted' | 'confirmed';
  has_docs: boolean;
}

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

export default function AdminDocuments() {
  const [companiesWithDocs, setCompaniesWithDocs] = useState<CompanyWithDocs[]>([]);
  const [loading, setLoading] = useState(true);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'confirmed'>('all');

  // Batch selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Selected company
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

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
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const res = await api.get<{ data: CompanyWithDocs[] }>('/admin/companies-with-docs');
      setCompaniesWithDocs(res.data || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter companies by status
  const filteredCompanies = companiesWithDocs.filter((company) => {
    if (statusFilter === 'all') return true;
    return company.doc_status === statusFilter;
  });

  // Toggle selection
  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Select all visible
  function toggleSelectAll() {
    if (selectedIds.size === filteredCompanies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredCompanies.map((c) => c.id)));
    }
  }

  // Batch confirm
  async function handleBatchConfirm() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の資料を一括確認しますか？`)) return;

    setBatchProcessing(true);
    try {
      await api.put('/documents/batch-confirm', { company_ids: Array.from(selectedIds) });
      await loadCompanies();
      setSelectedIds(new Set());
      alert('一括確認が完了しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括確認に失敗しました');
    } finally {
      setBatchProcessing(false);
    }
  }

  // Batch unlock
  async function handleBatchUnlock() {
    if (selectedIds.size === 0) return;
    if (!confirm(`${selectedIds.size}件の資料を一括解除しますか？`)) return;

    setBatchProcessing(true);
    try {
      await api.put('/documents/batch-unlock', { company_ids: Array.from(selectedIds) });
      await loadCompanies();
      setSelectedIds(new Set());
      alert('一括解除が完了しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括解除に失敗しました');
    } finally {
      setBatchProcessing(false);
    }
  }

  async function selectCompany(company: Company) {
    setSelectedCompany(company);
    setLoadingDocs(true);
    setEditing(false);
    try {
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${company.id}`);
      setCompanyDocs(res.data);
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
      setCompanyDocs(null);
    } finally {
      setLoadingDocs(false);
    }
  }

  function closeDetail() {
    setSelectedCompany(null);
    setCompanyDocs(null);
    setEditing(false);
  }

  function getFileUrl(field: string, companyId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api' : '/api');
    return `${baseUrl}/documents/file/${field}?token=${token}&company_id=${companyId}`;
  }

  async function handleSave() {
    if (!selectedCompany) return;
    setSaving(true);
    try {
      await api.put(`/admin/documents/${selectedCompany.id}`, formData);
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${selectedCompany.id}`);
      setCompanyDocs(res.data);
      setEditing(false);
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirm() {
    if (!selectedCompany) return;
    setConfirming(true);
    try {
      await api.put(`/documents/confirm/${selectedCompany.id}`, {});
      setCompanyDocs(companyDocs ? { ...companyDocs, status: 'confirmed' } : null);
      alert('確認しました。クライアントは編集できなくなりました。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirming(false);
    }
  }

  async function handleUnlock() {
    if (!selectedCompany) return;
    setUnlocking(true);
    try {
      await api.put(`/documents/unlock/${selectedCompany.id}`, {});
      setCompanyDocs(companyDocs ? { ...companyDocs, status: 'submitted' } : null);
      alert('編集を許可しました。クライアントが編集できるようになりました。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '解除に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Detail view
  if (selectedCompany) {
    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={closeDetail}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 戻る
            </button>
            <h1 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h1>
          </div>
          {companyDocs && (
            <div className="flex items-center gap-2">
              {companyDocs.status === 'draft' && (
                <span className="text-sm px-2 py-1 bg-gray-100 text-gray-600 rounded">下書き</span>
              )}
              {companyDocs.status === 'submitted' && (
                <span className="text-sm px-2 py-1 bg-orange-100 text-orange-700 rounded">確認待ち</span>
              )}
              {companyDocs.status === 'confirmed' && (
                <span className="text-sm px-2 py-1 bg-green-100 text-green-700 rounded">確認済</span>
              )}
            </div>
          )}
        </div>

        {loadingDocs ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : !companyDocs ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            基礎資料がまだ登録されていません
          </div>
        ) : (
          <>
            {/* PDF Files */}
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
              <h2 className="font-semibold text-gray-900">PDF書類</h2>
              <div className="space-y-3">
                {PDF_FIELDS.map((field) => {
                  const keyField = `${field.key}_key` as keyof CompanyDocuments;
                  const hasFile = companyDocs[keyField];
                  return (
                    <div key={field.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-900">{field.label}</span>
                      {hasFile ? (
                        <div className="flex gap-3">
                          <a
                            href={getFileUrl(field.key, selectedCompany.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary-600 hover:underline"
                          >
                            確認
                          </a>
                          <a
                            href={getFileUrl(field.key, selectedCompany.id)}
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
                  <p className="text-xs text-gray-400 mt-2">例: 4月から翌年3月まで</p>
                </div>
              ) : (
                <div className="text-sm">
                  {companyDocs.business_year_start && companyDocs.business_year_end ? (
                    <span className="font-medium">{companyDocs.business_year_start}月 〜 {companyDocs.business_year_end}月</span>
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
                    <span className="font-medium">{companyDocs.shacho_name_reading || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">社長連絡先電話番号</span>
                    <span className="font-medium">{companyDocs.shacho_phone || '未入力'}</span>
                  </div>
                  <div className="py-2 border-b border-gray-100">
                    <span className="text-gray-500 block mb-1">家族情報</span>
                    <span className="font-medium whitespace-pre-wrap">{companyDocs.kazoku_info || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">社長年収</span>
                    <span className="font-medium">{companyDocs.shacho_income || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">家族年収</span>
                    <span className="font-medium">{companyDocs.kazoku_income || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">給与支給開始時期</span>
                    <span className="font-medium">{companyDocs.salary_start_date || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">厚生年金</span>
                    <span className="font-medium">{companyDocs.kousei_nenkin || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">国税情報</span>
                    <span className="font-medium">{companyDocs.kokuzei_info || '未入力'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">地方税情報</span>
                    <span className="font-medium">{companyDocs.chihouzei_info || '未入力'}</span>
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
                      className="flex-1 py-3 border border-gray-300 rounded-lg font-medium"
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
                    {companyDocs.status !== 'confirmed' ? (
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
          </>
        )}
      </div>
    );
  }

  // Get status badge
  function getStatusBadge(status: string) {
    switch (status) {
      case 'draft':
        return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">下書き</span>;
      case 'submitted':
        return <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">確認待ち</span>;
      case 'confirmed':
        return <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">確認済</span>;
      default:
        return <span className="text-xs px-2 py-1 bg-gray-100 text-gray-400 rounded">未登録</span>;
    }
  }

  // Company list view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">基礎資料管理</h1>
      </div>

      {/* Status Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-600">ステータス:</span>
        <button
          onClick={() => { setStatusFilter('all'); setSelectedIds(new Set()); }}
          className={`px-3 py-1 text-sm rounded-full ${
            statusFilter === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          全て ({companiesWithDocs.length})
        </button>
        <button
          onClick={() => { setStatusFilter('submitted'); setSelectedIds(new Set()); }}
          className={`px-3 py-1 text-sm rounded-full ${
            statusFilter === 'submitted'
              ? 'bg-orange-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          確認待ち ({companiesWithDocs.filter((c) => c.doc_status === 'submitted').length})
        </button>
        <button
          onClick={() => { setStatusFilter('confirmed'); setSelectedIds(new Set()); }}
          className={`px-3 py-1 text-sm rounded-full ${
            statusFilter === 'confirmed'
              ? 'bg-green-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          確認済 ({companiesWithDocs.filter((c) => c.doc_status === 'confirmed').length})
        </button>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <span className="text-sm text-blue-800">{selectedIds.size}件選択中</span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={handleBatchConfirm}
              disabled={batchProcessing}
              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {batchProcessing ? '処理中...' : '一括確認'}
            </button>
            <button
              onClick={handleBatchUnlock}
              disabled={batchProcessing}
              className="px-3 py-1 text-sm bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {batchProcessing ? '処理中...' : '一括解除'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              選択解除
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            {companiesWithDocs.length === 0 ? '顧問先がまだ登録されていません' : '該当する資料がありません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {/* Select All Header */}
            <div className="px-4 py-3 bg-gray-50 flex items-center gap-3">
              <input
                type="checkbox"
                checked={selectedIds.size === filteredCompanies.length && filteredCompanies.length > 0}
                onChange={toggleSelectAll}
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
              <span className="text-sm text-gray-600">全選択</span>
            </div>
            {filteredCompanies.map((company) => (
              <div
                key={company.id}
                className="px-4 py-4 flex items-center gap-3 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(company.id)}
                  onChange={() => toggleSelection(company.id)}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <button
                  onClick={() => selectCompany({ id: company.id, name: company.name })}
                  className="flex-1 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-900">{company.name}</span>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(company.doc_status)}
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
