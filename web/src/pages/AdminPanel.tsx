import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import ImageLightbox from '../components/ImageLightbox';

interface Company {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
  on_hold_count: number;
  monthly_total: number;
  settlement_color: 'normal' | 'yellow' | 'red';
  business_year_end: string | null;
  settlement_confirmed: number;
}

interface Transaction {
  id: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  status: string;
  ai_confidence: number | null;
  created_at: string;
  company_name?: string;
  company_id?: string;
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


export default function AdminPanel() {
  const navigate = useNavigate();
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

  // Settlement confirmation modal
  const [settlementModal, setSettlementModal] = useState<{ company: Company } | null>(null);
  const [settlementInput, setSettlementInput] = useState('');
  const [confirmingSettlement, setConfirmingSettlement] = useState(false);
  const [resettingSettlement, setResettingSettlement] = useState(false);

  // Batch selection
  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);

  // Image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Transaction status filter
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'confirmed' | 'on_hold'>('all');

  // Global view mode
  const [globalView, setGlobalView] = useState<'none' | 'all_pending' | 'all_on_hold' | 'settlement_alerts'>('none');
  const [globalTransactions, setGlobalTransactions] = useState<Transaction[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(false);

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

  // Global view functions
  async function openGlobalView(viewType: 'all_pending' | 'all_on_hold') {
    setGlobalView(viewType);
    setLoadingGlobal(true);
    setGlobalTransactions([]);

    try {
      // Load transactions from all companies with the specified status
      const status = viewType === 'all_pending' ? 'pending' : 'on_hold';
      const allTxns: Transaction[] = [];

      for (const company of companies) {
        const count = viewType === 'all_pending' ? company.pending_count : company.on_hold_count;
        if (count > 0) {
          const res = await api.get<{ data: Transaction[] }>(`/admin/companies/${company.id}/transactions?status=${status}`);
          const txnsWithCompany = (res.data || []).map(t => ({
            ...t,
            company_name: company.name,
            company_id: company.id,
          }));
          allTxns.push(...txnsWithCompany);
        }
      }

      setGlobalTransactions(allTxns);
    } catch (err) {
      console.error('Failed to load global transactions:', err);
    } finally {
      setLoadingGlobal(false);
    }
  }

  function openSettlementAlerts() {
    setGlobalView('settlement_alerts');
  }

  function closeGlobalView() {
    setGlobalView('none');
    setGlobalTransactions([]);
  }

  function openSettlementModal(company: Company) {
    setSettlementModal({ company });
    setSettlementInput('');
  }

  function closeSettlementModal() {
    setSettlementModal(null);
    setSettlementInput('');
  }

  async function handleConfirmSettlement() {
    if (!settlementModal) return;

    const companyName = settlementModal.company.name.trim();
    const expectedInput = `${companyName}決算完了`;
    const userInput = settlementInput.trim();

    if (userInput !== expectedInput) {
      alert(`入力が一致しません。\n\n入力内容: 「${userInput}」\n期待内容: 「${expectedInput}」`);
      return;
    }

    setConfirmingSettlement(true);
    try {
      await api.put(`/admin/companies/${settlementModal.company.id}/settlement`, {});
      // Update company in list
      setCompanies(companies.map(c =>
        c.id === settlementModal.company.id
          ? { ...c, settlement_color: 'normal' as const, settlement_confirmed: 1 }
          : c
      ));
      closeSettlementModal();
      alert('決算確認完了しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '決算確認に失敗しました');
    } finally {
      setConfirmingSettlement(false);
    }
  }

  async function handleResetSettlement(company: Company) {
    if (!confirm(`${company.name}の決算ステータスをリセットしますか？\n（事業年度終了アラートが再度表示されます）`)) return;

    setResettingSettlement(true);
    try {
      await api.delete(`/admin/companies/${company.id}/settlement`);
      // Reload companies to get updated settlement_color
      await loadCompanies();
      // Update selected company if open
      if (selectedCompany?.id === company.id) {
        setSelectedCompany({ ...selectedCompany, settlement_confirmed: 0 });
      }
      alert('決算ステータスをリセットしました');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'リセットに失敗しました');
    } finally {
      setResettingSettlement(false);
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

  async function openCompanyDetail(company: Company, filter?: 'pending' | 'confirmed' | 'on_hold') {
    setSelectedCompany(company);
    setStatusFilter(filter || 'all');
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
    setSelectedTxnIds(new Set());
    setStatusFilter('all');
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

  // Batch selection functions
  function toggleTxnSelection(txnId: string) {
    setSelectedTxnIds(prev => {
      const next = new Set(prev);
      if (next.has(txnId)) {
        next.delete(txnId);
      } else {
        next.add(txnId);
      }
      return next;
    });
  }

  function toggleSelectAllPending() {
    const pendingTxnIds = transactions.filter(t => t.status === 'pending').map(t => t.id);
    const allSelected = pendingTxnIds.every(id => selectedTxnIds.has(id));

    if (allSelected) {
      // Deselect all
      setSelectedTxnIds(new Set());
    } else {
      // Select all pending
      setSelectedTxnIds(new Set(pendingTxnIds));
    }
  }

  async function handleBatchConfirm() {
    if (selectedTxnIds.size === 0) return;

    setBatchConfirming(true);
    try {
      const res = await api.put<{ confirmed_count: number; message: string }>('/transactions/batch-confirm', {
        ids: Array.from(selectedTxnIds),
      });

      // Update local state
      setTransactions(transactions.map(t =>
        selectedTxnIds.has(t.id) ? { ...t, status: 'confirmed' } : t
      ));

      // Update company stats
      if (selectedCompany) {
        const confirmedCount = res.confirmed_count || selectedTxnIds.size;
        setSelectedCompany({
          ...selectedCompany,
          pending_count: selectedCompany.pending_count - confirmedCount,
          confirmed_count: selectedCompany.confirmed_count + confirmedCount,
        });
        setCompanies(companies.map(c =>
          c.id === selectedCompany.id
            ? { ...c, pending_count: c.pending_count - confirmedCount, confirmed_count: c.confirmed_count + confirmedCount }
            : c
        ));
      }

      // Clear selection
      setSelectedTxnIds(new Set());
      alert(res.message || `${selectedTxnIds.size}件を確認しました`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括確認に失敗しました');
    } finally {
      setBatchConfirming(false);
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

  // Helper function to get company name style based on settlement color
  function getCompanyNameStyle(color: 'normal' | 'yellow' | 'red') {
    switch (color) {
      case 'yellow':
        return 'text-yellow-600 font-semibold';
      case 'red':
        return 'text-red-600 font-bold';
      default:
        return 'text-primary-600';
    }
  }

  // Computed totals
  const totalPending = companies.reduce((sum, c) => sum + c.pending_count, 0);
  const totalOnHold = companies.reduce((sum, c) => sum + c.on_hold_count, 0);
  const settlementAlertCompanies = companies.filter(c => c.settlement_color !== 'normal');

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

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => totalPending > 0 && openGlobalView('all_pending')}
          className={`bg-white rounded-lg shadow-sm p-4 text-left ${totalPending > 0 ? 'hover:bg-orange-50 cursor-pointer' : ''}`}
        >
          <div className="text-sm text-gray-500">未処理残数</div>
          <div className={`text-2xl font-bold ${totalPending > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            {totalPending}件
          </div>
        </button>
        <button
          onClick={() => totalOnHold > 0 && openGlobalView('all_on_hold')}
          className={`bg-white rounded-lg shadow-sm p-4 text-left ${totalOnHold > 0 ? 'hover:bg-yellow-50 cursor-pointer' : ''}`}
        >
          <div className="text-sm text-gray-500">確認待ち</div>
          <div className={`text-2xl font-bold ${totalOnHold > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
            {totalOnHold}件
          </div>
        </button>
        <button
          onClick={() => settlementAlertCompanies.length > 0 && openSettlementAlerts()}
          className={`bg-white rounded-lg shadow-sm p-4 text-left ${settlementAlertCompanies.length > 0 ? 'hover:bg-red-50 cursor-pointer' : ''}`}
        >
          <div className="text-sm text-gray-500">決算アラート</div>
          <div className={`text-2xl font-bold ${settlementAlertCompanies.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {settlementAlertCompanies.length}社
          </div>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  確認待ち
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  アクション
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {companies.map((company) => (
                <tr key={company.id}>
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openCompanyDetail(company)}
                        className={`${getCompanyNameStyle(company.settlement_color)} hover:underline`}
                      >
                        {company.name}
                      </button>
                      {company.settlement_color !== 'normal' && (
                        <button
                          onClick={() => openSettlementModal(company)}
                          className={`px-2 py-0.5 text-xs rounded ${
                            company.settlement_color === 'red'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                          }`}
                        >
                          決算確認
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    ¥{company.monthly_total.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openCompanyDetail(company, 'confirmed')}
                      className="text-green-600 hover:underline"
                    >
                      {company.confirmed_count}件
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openCompanyDetail(company, 'pending')}
                      className="text-orange-600 hover:underline"
                    >
                      {company.pending_count}件
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => openCompanyDetail(company, 'on_hold')}
                      className="text-yellow-600 hover:underline"
                    >
                      {company.on_hold_count}件
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-3">
                    {company.pending_count > 0 && (
                      <button
                        onClick={() => navigate(`/review/${company.id}`)}
                        className="text-green-600 hover:text-green-800 text-sm"
                      >
                        審核モード
                      </button>
                    )}
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
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openCompanyDetail(company)}
                    className={`font-medium ${getCompanyNameStyle(company.settlement_color)} hover:underline`}
                  >
                    {company.name}
                  </button>
                  {company.settlement_color !== 'normal' && (
                    <button
                      onClick={() => openSettlementModal(company)}
                      className={`px-2 py-0.5 text-xs rounded ${
                        company.settlement_color === 'red'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      決算
                    </button>
                  )}
                </div>
                <span className="text-gray-600">¥{company.monthly_total.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => openCompanyDetail(company, 'confirmed')}
                    className="text-green-600 hover:underline"
                  >
                    確認済: {company.confirmed_count}
                  </button>
                  <button
                    onClick={() => openCompanyDetail(company, 'pending')}
                    className="text-orange-600 hover:underline"
                  >
                    要確認: {company.pending_count}
                  </button>
                  <button
                    onClick={() => openCompanyDetail(company, 'on_hold')}
                    className="text-yellow-600 hover:underline"
                  >
                    確認待ち: {company.on_hold_count}
                  </button>
                </div>
                <div className="flex gap-3">
                  {company.pending_count > 0 && (
                    <button
                      onClick={() => navigate(`/review/${company.id}`)}
                      className="text-green-600 text-sm"
                    >
                      審核
                    </button>
                  )}
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
                <div className="flex gap-4 mt-1 text-sm text-gray-600 flex-wrap">
                  <span>今月合計: ¥{selectedCompany.monthly_total.toLocaleString()}</span>
                  <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`${statusFilter === 'confirmed' ? 'underline font-medium' : ''} text-green-600 hover:underline`}
                  >
                    確認済: {selectedCompany.confirmed_count}件
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`${statusFilter === 'pending' ? 'underline font-medium' : ''} text-orange-600 hover:underline`}
                  >
                    要確認: {selectedCompany.pending_count}件
                  </button>
                  <button
                    onClick={() => setStatusFilter('on_hold')}
                    className={`${statusFilter === 'on_hold' ? 'underline font-medium' : ''} text-yellow-600 hover:underline`}
                  >
                    確認待ち: {selectedCompany.on_hold_count}件
                  </button>
                  {statusFilter !== 'all' && (
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="text-gray-500 hover:underline"
                    >
                      全て表示
                    </button>
                  )}
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
              ) : transactions.filter(t => statusFilter === 'all' || t.status === statusFilter).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {statusFilter === 'confirmed' && '確認済の取引はありません'}
                  {statusFilter === 'pending' && '要確認の取引はありません'}
                  {statusFilter === 'on_hold' && '確認待ちの取引はありません'}
                  <button
                    onClick={() => setStatusFilter('all')}
                    className="block mx-auto mt-2 text-primary-600 hover:underline text-sm"
                  >
                    全て表示
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Batch selection header */}
                  {transactions.some(t => t.status === 'pending') && statusFilter !== 'confirmed' && statusFilter !== 'on_hold' && (
                    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            transactions.filter(t => t.status === 'pending').length > 0 &&
                            transactions.filter(t => t.status === 'pending').every(t => selectedTxnIds.has(t.id))
                          }
                          onChange={toggleSelectAllPending}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-sm text-gray-600">
                          要確認を全選択 ({transactions.filter(t => t.status === 'pending').length}件)
                        </span>
                      </label>
                      {selectedTxnIds.size > 0 && (
                        <span className="text-sm text-primary-600">
                          {selectedTxnIds.size}件選択中
                        </span>
                      )}
                    </div>
                  )}

                  {transactions
                    .filter(t => statusFilter === 'all' || t.status === statusFilter)
                    .map((txn) => (
                    <div
                      key={txn.id}
                      className={`border rounded-lg p-4 hover:bg-gray-50 cursor-pointer ${
                        selectedTxnIds.has(txn.id) ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                      }`}
                      onClick={() => openTransactionDetail(txn.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {txn.status === 'pending' && (
                            <input
                              type="checkbox"
                              checked={selectedTxnIds.has(txn.id)}
                              onChange={(e) => {
                                e.stopPropagation();
                                toggleTxnSelection(txn.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1 w-4 h-4 text-primary-600 rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{txn.vendor_name || '不明'}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                txn.status === 'confirmed'
                                  ? 'bg-green-100 text-green-700'
                                  : txn.status === 'on_hold'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {txn.status === 'confirmed' ? '確認済' : txn.status === 'on_hold' ? '確認待ち' : '要確認'}
                              </span>
                              {(txn.ai_confidence ?? 100) < 80 && (
                                <span className="text-xs text-orange-600">
                                  信頼度: {txn.ai_confidence}%
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600">
                              <span>{txn.transaction_date || '不明'}</span>
                              <span className="mx-2">·</span>
                              <span>{txn.account_debit || '未分類'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-semibold">¥{(txn.amount ?? 0).toLocaleString()}</span>
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

            <div className="p-4 border-t border-gray-200 flex justify-between">
              <div className="flex gap-2">
                {selectedCompany.settlement_confirmed === 1 && (
                  <button
                    onClick={() => handleResetSettlement(selectedCompany)}
                    disabled={resettingSettlement}
                    className="px-4 py-2 bg-orange-100 text-orange-700 rounded-md text-sm hover:bg-orange-200 disabled:opacity-50"
                  >
                    {resettingSettlement ? 'リセット中...' : '決算リセット'}
                  </button>
                )}
                {selectedTxnIds.size > 0 && (
                  <button
                    onClick={handleBatchConfirm}
                    disabled={batchConfirming}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                  >
                    {batchConfirming ? '処理中...' : `選択した${selectedTxnIds.size}件を一括確認`}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                {selectedCompany.pending_count > 0 && (
                  <button
                    onClick={() => navigate(`/review/${selectedCompany.id}`)}
                    className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
                  >
                    審核モード
                  </button>
                )}
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
                  <div
                    className="bg-gray-100 rounded-lg overflow-hidden cursor-pointer relative group"
                    onClick={() => setLightboxSrc(getImageUrl(selectedTxn.id))}
                  >
                    <img
                      src={getImageUrl(selectedTxn.id)}
                      alt="領収書"
                      className="w-full h-auto max-h-64 object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                        クリックで拡大
                      </span>
                    </div>
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

      {/* Settlement Confirmation Modal */}
      {settlementModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-semibold mb-4">決算完了確認</h2>
            <p className="text-gray-600 mb-4">
              <span className={settlementModal.company.settlement_color === 'red' ? 'text-red-600 font-bold' : 'text-yellow-600 font-semibold'}>
                {settlementModal.company.name.trim()}
              </span>
              の決算を完了するには、以下を入力してください：
            </p>
            <p className="text-sm text-gray-500 mb-2">
              「<span className="font-medium text-gray-900">{settlementModal.company.name.trim()}決算完了</span>」と入力
            </p>
            <input
              type="text"
              value={settlementInput}
              onChange={(e) => setSettlementInput(e.target.value)}
              placeholder={`${settlementModal.company.name.trim()}決算完了`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={closeSettlementModal}
                className="flex-1 py-2 border border-gray-300 rounded-md"
              >
                キャンセル
              </button>
              <button
                onClick={handleConfirmSettlement}
                disabled={confirmingSettlement}
                className="flex-1 py-2 bg-green-600 text-white rounded-md disabled:opacity-50"
              >
                {confirmingSettlement ? '処理中...' : '確認完了'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global View Modal - Pending/On Hold Transactions */}
      {(globalView === 'all_pending' || globalView === 'all_on_hold') && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-4xl md:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {globalView === 'all_pending' ? '全ての未処理残数' : '全ての確認待ち'}
                </h2>
                <div className="text-sm text-gray-600 mt-1">
                  {globalTransactions.length}件
                </div>
              </div>
              <button
                onClick={closeGlobalView}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingGlobal ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                </div>
              ) : globalTransactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  {globalView === 'all_pending' ? '未処理の取引はありません' : '確認待ちの取引はありません'}
                </div>
              ) : (
                <div className="space-y-3">
                  {globalTransactions.map((txn) => (
                    <div
                      key={txn.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        closeGlobalView();
                        const company = companies.find(c => c.id === txn.company_id);
                        if (company) {
                          openCompanyDetail(company, globalView === 'all_pending' ? 'pending' : 'on_hold');
                        }
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                              {txn.company_name}
                            </span>
                            <span className="font-medium">{txn.vendor_name || '不明'}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              txn.status === 'on_hold'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {txn.status === 'on_hold' ? '確認待ち' : '要確認'}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600">
                            <span>{txn.transaction_date || '不明'}</span>
                            <span className="mx-2">·</span>
                            <span>{txn.account_debit || '未分類'}</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <span className="font-semibold">¥{(txn.amount ?? 0).toLocaleString()}</span>
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

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeGlobalView}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global View Modal - Settlement Alerts */}
      {globalView === 'settlement_alerts' && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-2xl md:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">決算アラート</h2>
                <div className="text-sm text-gray-600 mt-1">
                  {settlementAlertCompanies.length}社
                </div>
              </div>
              <button
                onClick={closeGlobalView}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {settlementAlertCompanies.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  決算アラートはありません
                </div>
              ) : (
                <div className="space-y-3">
                  {settlementAlertCompanies.map((company) => (
                    <div
                      key={company.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`font-medium ${getCompanyNameStyle(company.settlement_color)}`}>
                            {company.name}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            company.settlement_color === 'red'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {company.settlement_color === 'red' ? '期限超過' : '期限間近'}
                          </span>
                          {company.business_year_end && (
                            <span className="text-sm text-gray-500">
                              事業年度末: {company.business_year_end}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            closeGlobalView();
                            openSettlementModal(company);
                          }}
                          className={`px-3 py-1 text-sm rounded ${
                            company.settlement_color === 'red'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-yellow-500 text-white hover:bg-yellow-600'
                          }`}
                        >
                          決算確認
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeGlobalView}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="領収書"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
