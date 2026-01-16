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

      {/* New Company Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right">
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
                <button
                  onClick={() => handleExport(company.id)}
                  disabled={exporting === company.id}
                  className="text-primary-600 text-sm"
                >
                  CSV出力
                </button>
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

      {/* Company Detail Modal */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
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
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
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
                              onClick={() => handleConfirmTransaction(txn.id)}
                              disabled={confirmingTxn === txn.id}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded-md disabled:opacity-50"
                            >
                              {confirmingTxn === txn.id ? '処理中...' : '確認'}
                            </button>
                          )}
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
    </div>
  );
}
