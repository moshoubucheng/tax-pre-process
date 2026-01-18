import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useClientContext, SelectedClient } from '../hooks/useClientContext';
import ImageLightbox from '../components/ImageLightbox';

interface Company {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
  on_hold_count: number;
}

interface Transaction {
  id: string;
  company_id: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  tax_category: string | null;
  ai_confidence: number | null;
  status: string;
  image_key: string;
  company_name?: string;
}

export default function AdminTransactions() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSelectedClient } = useClientContext();

  const statusFilter = searchParams.get('status') || 'pending';

  const [companies, setCompanies] = useState<Company[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      // First load companies
      const companiesRes = await api.get<{ data: Company[] }>('/admin/companies');
      const allCompanies = companiesRes.data || [];
      setCompanies(allCompanies);

      // Filter companies that have transactions of the specified status
      const relevantCompanies = allCompanies.filter(c => {
        if (statusFilter === 'pending') return c.pending_count > 0;
        if (statusFilter === 'on_hold') return c.on_hold_count > 0;
        return true;
      });

      // Fetch transactions from each company
      const allTransactions: Transaction[] = [];
      for (const company of relevantCompanies) {
        const res = await api.get<{ data: Transaction[] }>(
          `/admin/companies/${company.id}/transactions?status=${statusFilter}`
        );
        const txns = (res.data || []).map(t => ({
          ...t,
          company_name: company.name
        }));
        allTransactions.push(...txns);
      }

      // Sort by date descending
      allTransactions.sort((a, b) => {
        const dateA = a.transaction_date || '';
        const dateB = b.transaction_date || '';
        return dateB.localeCompare(dateA);
      });

      setTransactions(allTransactions);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  function navigateToClient(companyId: string) {
    const company = companies.find(c => c.id === companyId);
    if (company) {
      const client: SelectedClient = {
        id: company.id,
        name: company.name,
        pending_count: company.pending_count,
        confirmed_count: company.confirmed_count,
      };
      setSelectedClient(client);
      navigate(`/client/transactions?status=${statusFilter}`);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map(t => t.id)));
    }
  }

  async function handleConfirmSingle(txnId: string) {
    setConfirmingId(txnId);
    try {
      await api.put(`/transactions/${txnId}/confirm`, {});
      setTransactions(transactions.filter(t => t.id !== txnId));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(txnId);
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleBatchConfirm() {
    if (selectedIds.size === 0) return;

    setBatchConfirming(true);
    try {
      await api.put('/transactions/batch-confirm', {
        ids: Array.from(selectedIds)
      });
      setTransactions(transactions.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括確認に失敗しました');
    } finally {
      setBatchConfirming(false);
    }
  }

  const title = statusFilter === 'pending' ? '全ての未処理取引' : '全ての確認待ち取引';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {transactions.length}件
          </span>
        </div>

        {/* Status Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/admin/transactions?status=pending')}
            className={`px-3 py-1.5 text-sm rounded-md ${
              statusFilter === 'pending'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            未処理
          </button>
          <button
            onClick={() => navigate('/admin/transactions?status=on_hold')}
            className={`px-3 py-1.5 text-sm rounded-md ${
              statusFilter === 'on_hold'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            確認待ち
          </button>
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && statusFilter === 'pending' && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-sm text-primary-700">
            {selectedIds.size}件選択中
          </span>
          <button
            onClick={handleBatchConfirm}
            disabled={batchConfirming}
            className="px-4 py-1.5 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
          >
            {batchConfirming ? '処理中...' : '一括確認'}
          </button>
        </div>
      )}

      {/* Transactions Table */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
          該当する取引がありません
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {statusFilter === 'pending' && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === transactions.length && transactions.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">顧問先</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">店舗名</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">勘定科目</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">信頼度</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">画像</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-gray-50">
                    {statusFilter === 'pending' && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(txn.id)}
                          onChange={() => toggleSelection(txn.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => navigateToClient(txn.company_id)}
                        className="text-sm font-medium text-primary-600 hover:text-primary-800"
                      >
                        {txn.company_name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {txn.transaction_date || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                      {txn.vendor_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">
                      {txn.amount != null ? `¥${txn.amount.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {txn.account_debit || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      {txn.ai_confidence != null ? (
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          txn.ai_confidence >= 80
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {Math.round(txn.ai_confidence)}%
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setLightboxSrc(getImageUrl(txn.id))}
                        className="text-primary-600 hover:text-primary-800"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => navigateToClient(txn.company_id)}
                          className="text-sm text-gray-600 hover:text-gray-800"
                        >
                          編集
                        </button>
                        {statusFilter === 'pending' && (
                          <button
                            onClick={() => handleConfirmSingle(txn.id)}
                            disabled={confirmingId === txn.id}
                            className="text-sm text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            {confirmingId === txn.id ? '...' : '確認'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile List */}
          <div className="md:hidden divide-y divide-gray-100">
            {transactions.map((txn) => (
              <div key={txn.id} className="p-4">
                <div className="flex items-start gap-3">
                  {statusFilter === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(txn.id)}
                      onChange={() => toggleSelection(txn.id)}
                      className="mt-1 rounded border-gray-300"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <button
                        onClick={() => navigateToClient(txn.company_id)}
                        className="text-sm font-medium text-primary-600"
                      >
                        {txn.company_name}
                      </button>
                      <span className="text-sm text-gray-500">{txn.transaction_date || '-'}</span>
                    </div>
                    <p className="text-sm text-gray-900 truncate">{txn.vendor_name || '-'}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-medium">
                        {txn.amount != null ? `¥${txn.amount.toLocaleString()}` : '-'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setLightboxSrc(getImageUrl(txn.id))}
                          className="p-1.5 text-primary-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        {statusFilter === 'pending' && (
                          <button
                            onClick={() => handleConfirmSingle(txn.id)}
                            disabled={confirmingId === txn.id}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded disabled:opacity-50"
                          >
                            {confirmingId === txn.id ? '...' : '確認'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="領収書画像"
          onClose={() => setLightboxSrc(null)}
        />
      )}
    </div>
  );
}
