import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Company {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
  monthly_total: number;
}

interface Transaction {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  account_category: string;
  status: string;
  confidence: number;
  created_at: string;
}

interface TransactionDetail {
  id: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  account_credit: string;
  tax_category: string | null;
  ai_confidence: number | null;
  status: 'pending' | 'confirmed';
  image_key: string;
  created_at: string;
}

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
  { key: 'tohon', label: '謄本' },
  { key: 'teikan', label: '定款' },
  { key: 'zairyu_card', label: '社長・家族在留カード' },
  { key: 'juminhyo', label: '住民票（マイナンバー記載）' },
  { key: 'kaigyo_doc', label: '開業届出書類' },
] as const;

export default function AdminPanel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // New company form
  const [showForm, setShowForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', email: '', password: '', userName: '' });
  const [creating, setCreating] = useState(false);

  // Company detail modal
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [confirmingTxn, setConfirmingTxn] = useState<string | null>(null);

  // Transaction detail modal
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [loadingTxnDetail, setLoadingTxnDetail] = useState(false);

  // Documents review modal
  const [docsCompany, setDocsCompany] = useState<Company | null>(null);
  const [companyDocs, setCompanyDocs] = useState<CompanyDocuments | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [editingDocs, setEditingDocs] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [docsFormData, setDocsFormData] = useState({
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

  useEffect(() => {
    loadCompanies();
  }, []);

  async function loadCompanies() {
    try {
      const res = await api.get<{ data: Company[] }>('/admin/companies');
      setCompanies(res.data || []);
    } catch (err) {
      console.error('Failed to load companies:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport(companyId: string) {
    setExporting(companyId);
    try {
      const res = await fetch(`/api/admin/export/${companyId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${companyId}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('エクスポートに失敗しました');
    } finally {
      setExporting(null);
    }
  }

  async function openCompanyDetail(company: Company) {
    setSelectedCompany(company);
    setLoadingTransactions(true);
    try {
      const res = await api.get<{ data: Transaction[] }>(`/admin/companies/${company.id}/transactions`);
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  function closeCompanyDetail() {
    setSelectedCompany(null);
    setTransactions([]);
  }

  async function openTransactionDetail(txnId: string) {
    setLoadingTxnDetail(true);
    try {
      const res = await api.get<{ data: TransactionDetail }>(`/transactions/${txnId}`);
      setSelectedTxn(res.data);
    } catch (err) {
      console.error('Failed to load transaction:', err);
      alert('取引情報の取得に失敗しました');
    } finally {
      setLoadingTxnDetail(false);
    }
  }

  function closeTxnDetail() {
    setSelectedTxn(null);
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  async function handleConfirmTransaction(txnId: string) {
    setConfirmingTxn(txnId);
    try {
      await api.put(`/transactions/${txnId}/confirm`, {});
      // Update local state
      setTransactions(transactions.map(t =>
        t.id === txnId ? { ...t, status: 'confirmed' } : t
      ));
      // Update company stats
      if (selectedCompany) {
        setSelectedCompany({
          ...selectedCompany,
          pending_count: selectedCompany.pending_count - 1,
          confirmed_count: selectedCompany.confirmed_count + 1,
        });
        // Also update in the companies list
        setCompanies(companies.map(c =>
          c.id === selectedCompany.id
            ? { ...c, pending_count: c.pending_count - 1, confirmed_count: c.confirmed_count + 1 }
            : c
        ));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirmingTxn(null);
    }
  }

  async function openDocsReview(company: Company) {
    setDocsCompany(company);
    setLoadingDocs(true);
    setEditingDocs(false);
    try {
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${company.id}`);
      setCompanyDocs(res.data);
      if (res.data) {
        setDocsFormData({
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
      setCompanyDocs(null);
    } finally {
      setLoadingDocs(false);
    }
  }

  function closeDocsReview() {
    setDocsCompany(null);
    setCompanyDocs(null);
    setEditingDocs(false);
  }

  async function handleSaveDocs() {
    if (!docsCompany) return;
    setSavingDocs(true);
    try {
      await api.put(`/admin/documents/${docsCompany.id}`, docsFormData);
      // Reload docs
      const res = await api.get<{ data: CompanyDocuments | null }>(`/documents/${docsCompany.id}`);
      setCompanyDocs(res.data);
      setEditingDocs(false);
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSavingDocs(false);
    }
  }

  function getDocFileUrl(field: string, companyId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/documents/file/${field}?token=${token}&company_id=${companyId}`;
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      // Create company
      const companyRes = await api.post<{ id: string }>('/admin/companies', {
        name: newCompany.name,
      });

      // Create user for this company
      await api.post('/admin/users', {
        email: newCompany.email,
        password: newCompany.password,
        name: newCompany.userName,
        company_id: companyRes.id,
        role: 'client',
      });

      setShowForm(false);
      setNewCompany({ name: '', email: '', password: '', userName: '' });
      loadCompanies();
    } catch (err) {
      alert(err instanceof Error ? err.message : '作成に失敗しました');
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">顧問先管理</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm"
        >
          新規追加
        </button>
      </div>

      {/* New Company Form Modal/Full Screen */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg p-6 md:max-w-md overflow-auto">
            <h2 className="text-lg font-semibold mb-4">新規顧問先追加</h2>
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  会社名
                </label>
                <input
                  type="text"
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  担当者名
                </label>
                <input
                  type="text"
                  value={newCompany.userName}
                  onChange={(e) => setNewCompany({ ...newCompany, userName: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={newCompany.email}
                  onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  初期パスワード
                </label>
                <input
                  type="text"
                  value={newCompany.password}
                  onChange={(e) => setNewCompany({ ...newCompany, password: e.target.value })}
                  required
                  minLength={8}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-md"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
                >
                  {creating ? '作成中...' : '作成'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Companies List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="hidden md:block">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  会社名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  今月合計
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  確認済
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  要確認
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    <button
                      onClick={() => openCompanyDetail(company)}
                      className="text-primary-600 hover:text-primary-800 hover:underline"
                    >
                      {company.name}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    ¥{company.monthly_total.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-green-600">
                    {company.confirmed_count}件
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-orange-600">
                    {company.pending_count}件
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                    <button
                      onClick={() => openDocsReview(company)}
                      className="text-gray-600 hover:text-gray-800 text-sm"
                    >
                      書類
                    </button>
                    <button
                      onClick={() => handleExport(company.id)}
                      disabled={exporting === company.id}
                      className="text-primary-600 hover:text-primary-800 text-sm disabled:opacity-50"
                    >
                      {exporting === company.id ? 'エクスポート中...' : '弥生CSV出力'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile List */}
        <div className="md:hidden divide-y divide-gray-200">
          {companies.map((company) => (
            <div key={company.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={() => openCompanyDetail(company)}
                  className="font-medium text-primary-600 hover:underline"
                >
                  {company.name}
                </button>
                <span className="text-gray-600">¥{company.monthly_total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-4">
                  <span className="text-green-600">確認済: {company.confirmed_count}</span>
                  <span className="text-orange-600">要確認: {company.pending_count}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => openDocsReview(company)}
                    className="text-gray-600 text-sm"
                  >
                    書類
                  </button>
                  <button
                    onClick={() => handleExport(company.id)}
                    disabled={exporting === company.id}
                    className="text-primary-600 text-sm"
                  >
                    CSV出力
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {companies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            顧問先がまだ登録されていません
          </div>
        )}
      </div>

      {/* Company Detail Modal/Full Screen */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">{selectedCompany.name}</h2>
                <div className="flex gap-4 mt-1 text-sm text-gray-600">
                  <span>今月合計: ¥{selectedCompany.monthly_total.toLocaleString()}</span>
                  <span className="text-green-600">確認済: {selectedCompany.confirmed_count}件</span>
                  <span className="text-orange-600">要確認: {selectedCompany.pending_count}件</span>
                </div>
              </div>
              <button
                onClick={closeCompanyDetail}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingTransactions ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  取引データがありません
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => openTransactionDetail(txn.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{txn.vendor || '不明'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              txn.status === 'confirmed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {txn.status === 'confirmed' ? '確認済' : '要確認'}
                            </span>
                            {txn.confidence < 80 && (
                              <span className="text-xs text-orange-600">
                                信頼度: {txn.confidence}%
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>{txn.date}</span>
                            <span className="mx-2">·</span>
                            <span>{txn.account_category || '未分類'}</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-semibold">¥{txn.amount.toLocaleString()}</span>
                          {txn.status === 'pending' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmTransaction(txn.id);
                              }}
                              disabled={confirmingTxn === txn.id}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-md disabled:opacity-50"
                            >
                              {confirmingTxn === txn.id ? '処理中...' : '確認'}
                            </button>
                          )}
                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => handleExport(selectedCompany.id)}
                disabled={exporting === selectedCompany.id}
                className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
              >
                {exporting === selectedCompany.id ? 'エクスポート中...' : '弥生CSV出力'}
              </button>
              <button
                onClick={closeCompanyDetail}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Detail Modal/Full Screen */}
      {(selectedTxn || loadingTxnDetail) && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-[60]">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-2xl md:max-h-[90vh] overflow-hidden flex flex-col">
            {loadingTxnDetail ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : selectedTxn ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">取引詳細</h2>
                  <button
                    onClick={closeTxnDetail}
                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Receipt Image */}
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={getImageUrl(selectedTxn.id)}
                      alt="領収書"
                      className="w-full h-auto max-h-64 object-contain"
                    />
                  </div>

                  {/* Transaction Info */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">ステータス</span>
                      <span className={`px-2 py-1 rounded-full text-sm ${
                        selectedTxn.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {selectedTxn.status === 'confirmed' ? '確認済' : '要確認'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">店舗名</span>
                      <span className="font-medium">{selectedTxn.vendor_name || '不明'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">日付</span>
                      <span className="font-medium">{selectedTxn.transaction_date || '不明'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">金額</span>
                      <span className="font-medium text-lg">¥{(selectedTxn.amount || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">勘定科目（借方）</span>
                      <span className="font-medium">{selectedTxn.account_debit || '未設定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">勘定科目（貸方）</span>
                      <span className="font-medium">{selectedTxn.account_credit || '未設定'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">税区分</span>
                      <span className="font-medium">{selectedTxn.tax_category || '未設定'}</span>
                    </div>
                    {selectedTxn.ai_confidence !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">AI信頼度</span>
                        <span className={`font-medium ${
                          selectedTxn.ai_confidence >= 80 ? 'text-green-600' :
                          selectedTxn.ai_confidence >= 60 ? 'text-orange-600' : 'text-red-600'
                        }`}>
                          {selectedTxn.ai_confidence}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  {selectedTxn.status === 'pending' && (
                    <button
                      onClick={() => {
                        handleConfirmTransaction(selectedTxn.id);
                        setSelectedTxn({ ...selectedTxn, status: 'confirmed' });
                      }}
                      disabled={confirmingTxn === selectedTxn.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      {confirmingTxn === selectedTxn.id ? '処理中...' : '確認する'}
                    </button>
                  )}
                  <button
                    onClick={closeTxnDetail}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                  >
                    閉じる
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* Documents Review Modal/Full Screen */}
      {(docsCompany || loadingDocs) && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-3xl md:max-h-[90vh] overflow-hidden flex flex-col">
            {loadingDocs ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : docsCompany ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{docsCompany.name} - 会社書類</h2>
                  <button
                    onClick={closeDocsReview}
                    className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-4 space-y-6">
                  {!companyDocs ? (
                    <div className="text-center py-12 text-gray-500">
                      書類がまだ登録されていません
                    </div>
                  ) : (
                    <>
                      {/* PDF Files */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">PDF書類</h3>
                        <div className="grid gap-2">
                          {PDF_FIELDS.map((field) => {
                            const keyField = `${field.key}_key` as keyof CompanyDocuments;
                            const hasFile = companyDocs[keyField];
                            return (
                              <div key={field.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <span className="text-sm font-medium text-gray-900">{field.label}</span>
                                {hasFile ? (
                                  <div className="flex gap-3">
                                    <a
                                      href={getDocFileUrl(field.key, docsCompany.id)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-sm text-primary-600 hover:underline"
                                    >
                                      確認
                                    </a>
                                    <a
                                      href={getDocFileUrl(field.key, docsCompany.id)}
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

                      {/* Text Information */}
                      <div className="space-y-3">
                        <h3 className="font-semibold text-gray-900">その他の情報</h3>
                        {editingDocs ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">社長名（フリガナ）</label>
                              <input
                                type="text"
                                value={docsFormData.shacho_name_reading}
                                onChange={(e) => setDocsFormData({ ...docsFormData, shacho_name_reading: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">社長連絡先電話番号</label>
                              <input
                                type="tel"
                                value={docsFormData.shacho_phone}
                                onChange={(e) => setDocsFormData({ ...docsFormData, shacho_phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">家族情報</label>
                              <textarea
                                value={docsFormData.kazoku_info}
                                onChange={(e) => setDocsFormData({ ...docsFormData, kazoku_info: e.target.value })}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">社長年収</label>
                                <input
                                  type="text"
                                  value={docsFormData.shacho_income}
                                  onChange={(e) => setDocsFormData({ ...docsFormData, shacho_income: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">家族年収</label>
                                <input
                                  type="text"
                                  value={docsFormData.kazoku_income}
                                  onChange={(e) => setDocsFormData({ ...docsFormData, kazoku_income: e.target.value })}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">給与支給開始時期</label>
                              <input
                                type="text"
                                value={docsFormData.salary_start_date}
                                onChange={(e) => setDocsFormData({ ...docsFormData, salary_start_date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">厚生年金</label>
                              <input
                                type="text"
                                value={docsFormData.kousei_nenkin}
                                onChange={(e) => setDocsFormData({ ...docsFormData, kousei_nenkin: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">国税情報</label>
                              <input
                                type="text"
                                value={docsFormData.kokuzei_info}
                                onChange={(e) => setDocsFormData({ ...docsFormData, kokuzei_info: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">地方税情報</label>
                              <input
                                type="text"
                                value={docsFormData.chihouzei_info}
                                onChange={(e) => setDocsFormData({ ...docsFormData, chihouzei_info: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
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
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
                  {companyDocs && !editingDocs && (
                    <button
                      onClick={() => setEditingDocs(true)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
                    >
                      編集
                    </button>
                  )}
                  {editingDocs && (
                    <>
                      <button
                        onClick={() => setEditingDocs(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSaveDocs}
                        disabled={savingDocs}
                        className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
                      >
                        {savingDocs ? '保存中...' : '保存'}
                      </button>
                    </>
                  )}
                  {!editingDocs && (
                    <button
                      onClick={closeDocsReview}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      閉じる
                    </button>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
