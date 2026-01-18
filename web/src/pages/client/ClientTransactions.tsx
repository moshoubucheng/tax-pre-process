import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useClientContext } from '../../hooks/useClientContext';
import ImageLightbox from '../../components/ImageLightbox';
import ConfirmRevertModal from '../../components/ConfirmRevertModal';

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
}

export default function ClientTransactions() {
  const navigate = useNavigate();
  const { selectedClient, setSelectedClient } = useClientContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Selection for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedConfirmedIds, setSelectedConfirmedIds] = useState<Set<string>>(new Set());
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [batchReverting, setBatchReverting] = useState(false);

  // Revert modals
  const [singleRevertTxnId, setSingleRevertTxnId] = useState<string | null>(null);
  const [showBatchRevertModal, setShowBatchRevertModal] = useState(false);
  const [revertingTxn, setRevertingTxn] = useState<string | null>(null);

  // Transaction detail
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmingTxn, setConfirmingTxn] = useState<string | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'confirmed'>('all');

  useEffect(() => {
    if (!selectedClient) {
      navigate('/clients');
      return;
    }
    loadTransactions();
  }, [selectedClient]);

  async function loadTransactions() {
    if (!selectedClient) return;
    try {
      const res = await api.get<{ data: Transaction[] }>(`/admin/companies/${selectedClient.id}/transactions`);
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  async function openTransactionDetail(txnId: string) {
    setLoadingDetail(true);
    try {
      const res = await api.get<{ data: TransactionDetail }>(`/transactions/${txnId}`);
      setSelectedTxn(res.data);
    } catch (err) {
      console.error('Failed to load transaction:', err);
      alert('取引情報の取得に失敗しました');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleConfirmTransaction(txnId: string) {
    setConfirmingTxn(txnId);
    try {
      await api.put(`/transactions/${txnId}/confirm`, {});
      setTransactions(transactions.map(t =>
        t.id === txnId ? { ...t, status: 'confirmed' } : t
      ));
      if (selectedTxn?.id === txnId) {
        setSelectedTxn({ ...selectedTxn, status: 'confirmed' });
      }
      // Update client context
      if (selectedClient) {
        setSelectedClient({
          ...selectedClient,
          pending_count: selectedClient.pending_count - 1,
          confirmed_count: selectedClient.confirmed_count + 1,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirmingTxn(null);
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

  function toggleSelectAllPending() {
    const pendingIds = filteredTransactions.filter(t => t.status === 'pending').map(t => t.id);
    const allSelected = pendingIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  }

  function toggleConfirmedSelection(id: string) {
    setSelectedConfirmedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAllConfirmed() {
    const confirmedIds = filteredTransactions.filter(t => t.status === 'confirmed').map(t => t.id);
    const allSelected = confirmedIds.every(id => selectedConfirmedIds.has(id));
    if (allSelected) {
      setSelectedConfirmedIds(new Set());
    } else {
      setSelectedConfirmedIds(new Set(confirmedIds));
    }
  }

  async function handleBatchConfirm() {
    if (selectedIds.size === 0) return;
    setBatchConfirming(true);
    try {
      const res = await api.put<{ confirmed_count: number }>('/transactions/batch-confirm', {
        ids: Array.from(selectedIds),
      });
      setTransactions(transactions.map(t =>
        selectedIds.has(t.id) ? { ...t, status: 'confirmed' } : t
      ));
      // Update client context
      if (selectedClient) {
        const confirmedCount = res.confirmed_count || selectedIds.size;
        setSelectedClient({
          ...selectedClient,
          pending_count: selectedClient.pending_count - confirmedCount,
          confirmed_count: selectedClient.confirmed_count + confirmedCount,
        });
      }
      setSelectedIds(new Set());
      alert(`${selectedIds.size}件を確認しました`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括確認に失敗しました');
    } finally {
      setBatchConfirming(false);
    }
  }

  // Single transaction revert
  async function handleSingleRevert() {
    if (!singleRevertTxnId) return;
    setRevertingTxn(singleRevertTxnId);
    try {
      await api.put(`/transactions/${singleRevertTxnId}/unlock`, {});
      setTransactions(transactions.map(t =>
        t.id === singleRevertTxnId ? { ...t, status: 'pending' } : t
      ));
      if (selectedTxn?.id === singleRevertTxnId) {
        setSelectedTxn({ ...selectedTxn, status: 'pending' });
      }
      // Update client context
      if (selectedClient) {
        setSelectedClient({
          ...selectedClient,
          pending_count: selectedClient.pending_count + 1,
          confirmed_count: selectedClient.confirmed_count - 1,
        });
      }
      setSingleRevertTxnId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認解除に失敗しました');
    } finally {
      setRevertingTxn(null);
    }
  }

  // Batch revert
  async function handleBatchRevert() {
    if (selectedConfirmedIds.size === 0) return;
    setBatchReverting(true);
    try {
      const res = await api.put<{ unlocked_count: number }>('/transactions/batch-unlock', {
        ids: Array.from(selectedConfirmedIds),
      });
      setTransactions(transactions.map(t =>
        selectedConfirmedIds.has(t.id) ? { ...t, status: 'pending' } : t
      ));
      // Update client context
      if (selectedClient) {
        const unlockedCount = res.unlocked_count || selectedConfirmedIds.size;
        setSelectedClient({
          ...selectedClient,
          pending_count: selectedClient.pending_count + unlockedCount,
          confirmed_count: selectedClient.confirmed_count - unlockedCount,
        });
      }
      setSelectedConfirmedIds(new Set());
      setShowBatchRevertModal(false);
      alert(`${selectedConfirmedIds.size}件の確認を解除しました`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括解除に失敗しました');
    } finally {
      setBatchReverting(false);
    }
  }

  async function handleExport() {
    if (!selectedClient) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/admin/export/${selectedClient.id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${selectedClient.id}_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('エクスポートに失敗しました');
    } finally {
      setExporting(false);
    }
  }

  if (!selectedClient) return null;

  const filteredTransactions = transactions.filter(t => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  const pendingCount = transactions.filter(t => t.status === 'pending').length;

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
        <div className="flex items-center gap-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'pending' | 'confirmed')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">すべて ({transactions.length})</option>
            <option value="pending">要確認 ({pendingCount})</option>
            <option value="confirmed">確認済 ({transactions.length - pendingCount})</option>
          </select>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
        >
          {exporting ? 'エクスポート中...' : '弥生CSV出力'}
        </button>
      </div>

      {/* Batch Actions - Pending */}
      {pendingCount > 0 && filterStatus !== 'confirmed' && (
        <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filteredTransactions.filter(t => t.status === 'pending').length > 0 &&
                filteredTransactions.filter(t => t.status === 'pending').every(t => selectedIds.has(t.id))
              }
              onChange={toggleSelectAllPending}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-600">
              要確認を全選択
            </span>
          </label>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBatchConfirm}
              disabled={batchConfirming}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded-md disabled:opacity-50"
            >
              {batchConfirming ? '処理中...' : `${selectedIds.size}件を一括確認`}
            </button>
          )}
        </div>
      )}

      {/* Batch Actions - Confirmed (for reverting) */}
      {filterStatus === 'confirmed' && filteredTransactions.length > 0 && (
        <div className="flex items-center justify-between py-2 px-3 bg-orange-50 rounded-lg">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={
                filteredTransactions.length > 0 &&
                filteredTransactions.every(t => selectedConfirmedIds.has(t.id))
              }
              onChange={toggleSelectAllConfirmed}
              className="w-4 h-4 text-orange-600 rounded"
            />
            <span className="text-sm text-gray-600">
              確認済を全選択
            </span>
          </label>
          {selectedConfirmedIds.size > 0 && (
            <button
              onClick={() => setShowBatchRevertModal(true)}
              disabled={batchReverting}
              className="px-3 py-1 bg-orange-600 text-white text-sm rounded-md disabled:opacity-50"
            >
              {batchReverting ? '処理中...' : `${selectedConfirmedIds.size}件を一括解除`}
            </button>
          )}
        </div>
      )}

      {/* Transaction List */}
      <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-100">
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            取引がありません
          </div>
        ) : (
          filteredTransactions.map((txn) => (
            <div
              key={txn.id}
              onClick={() => openTransactionDetail(txn.id)}
              className={`p-4 cursor-pointer hover:bg-gray-50 ${
                selectedIds.has(txn.id) || selectedConfirmedIds.has(txn.id) ? 'bg-primary-50' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  {txn.status === 'pending' && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(txn.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleSelection(txn.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 text-primary-600 rounded"
                    />
                  )}
                  {txn.status === 'confirmed' && filterStatus === 'confirmed' && (
                    <input
                      type="checkbox"
                      checked={selectedConfirmedIds.has(txn.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleConfirmedSelection(txn.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 w-4 h-4 text-orange-600 rounded"
                    />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{txn.vendor || '不明'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {txn.status === 'confirmed' ? '確認済' : '要確認'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span>{txn.date}</span>
                      <span className="mx-2">·</span>
                      <span>{txn.account_category || '未分類'}</span>
                      {txn.confidence < 80 && (
                        <span className="ml-2 text-orange-600">信頼度 {txn.confidence}%</span>
                      )}
                    </div>
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
                      {confirmingTxn === txn.id ? '...' : '確認'}
                    </button>
                  )}
                  {txn.status === 'confirmed' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSingleRevertTxnId(txn.id);
                      }}
                      disabled={revertingTxn === txn.id}
                      className="px-3 py-1 bg-gray-200 text-gray-700 text-xs rounded-md hover:bg-gray-300 disabled:opacity-50"
                    >
                      {revertingTxn === txn.id ? '...' : '編集'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Transaction Detail Modal */}
      {(selectedTxn || loadingDetail) && (
        <div className="fixed inset-0 bg-black/50 md:flex md:items-center md:justify-center md:p-4 z-50">
          <div className="bg-white w-full h-full md:h-auto md:rounded-lg md:max-w-2xl md:max-h-[90vh] overflow-hidden flex flex-col">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : selectedTxn ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">取引詳細</h2>
                  <button
                    onClick={() => setSelectedTxn(null)}
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
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">ステータス</span>
                      <span className={`px-2 py-1 rounded-full ${
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
                      onClick={() => handleConfirmTransaction(selectedTxn.id)}
                      disabled={confirmingTxn === selectedTxn.id}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      {confirmingTxn === selectedTxn.id ? '処理中...' : '確認する'}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedTxn(null)}
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

      {/* Image Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="領収書"
          onClose={() => setLightboxSrc(null)}
        />
      )}

      {/* Single Revert Confirmation Modal */}
      <ConfirmRevertModal
        isOpen={singleRevertTxnId !== null}
        onClose={() => setSingleRevertTxnId(null)}
        onConfirm={handleSingleRevert}
        mode="single"
        processing={revertingTxn !== null}
      />

      {/* Batch Revert Confirmation Modal */}
      <ConfirmRevertModal
        isOpen={showBatchRevertModal}
        onClose={() => setShowBatchRevertModal(false)}
        onConfirm={handleBatchRevert}
        mode="batch"
        companyName={selectedClient?.name || ''}
        count={selectedConfirmedIds.size}
        processing={batchReverting}
      />
    </div>
  );
}
