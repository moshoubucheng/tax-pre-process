import { useState } from 'react';

export interface TransactionItem {
  id: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  ai_confidence: number | null;
  status: 'pending' | 'confirmed';
}

interface ConfidenceGroupProps {
  title: string;
  transactions: TransactionItem[];
  isHighConfidence: boolean;
  selectedId: string | null;
  batchConfirming: boolean;
  onSelect: (id: string) => void;
  onBatchConfirm?: (ids: string[]) => void;
}

export default function ConfidenceGroup({
  title,
  transactions,
  isHighConfidence,
  selectedId,
  batchConfirming,
  onSelect,
  onBatchConfirm,
}: ConfidenceGroupProps) {
  const [isExpanded, setIsExpanded] = useState(!isHighConfidence);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const pendingTransactions = transactions.filter((t) => t.status === 'pending');
  const pendingCount = pendingTransactions.length;
  const confirmedCount = transactions.filter((t) => t.status === 'confirmed').length;

  function toggleSelection(id: string, e: React.MouseEvent) {
    e.stopPropagation();
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

  function handleSelectAll() {
    if (selectedIds.size === pendingCount) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTransactions.map((t) => t.id)));
    }
  }

  function handleBatchConfirm() {
    if (onBatchConfirm && selectedIds.size > 0) {
      onBatchConfirm(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  }

  if (transactions.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Group Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-3 text-left ${
          isHighConfidence ? 'bg-green-50' : 'bg-orange-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className={`font-medium ${isHighConfidence ? 'text-green-700' : 'text-orange-700'}`}>
            {title}
          </span>
          <span className="text-sm text-gray-500">
            ({pendingCount}件要確認 / {confirmedCount}件確認済)
          </span>
        </div>
        {!isHighConfidence && pendingCount > 0 && (
          <span className="text-orange-500">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </span>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="divide-y divide-gray-100">
          {/* Batch Actions (only for high confidence) */}
          {isHighConfidence && pendingCount > 0 && onBatchConfirm && (
            <div className="p-2 bg-gray-50 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === pendingCount && pendingCount > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary-600 rounded"
                />
                <span className="text-sm text-gray-600">
                  全選択 ({selectedIds.size}/{pendingCount})
                </span>
              </label>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleBatchConfirm}
                  disabled={batchConfirming}
                  className="px-3 py-1 bg-green-600 text-white text-xs rounded-md disabled:opacity-50"
                >
                  {batchConfirming ? '処理中...' : `${selectedIds.size}件を一括確認`}
                </button>
              )}
            </div>
          )}

          {/* Transaction List */}
          {transactions.map((txn) => (
            <div
              key={txn.id}
              onClick={() => onSelect(txn.id)}
              className={`flex items-center p-3 cursor-pointer transition-colors ${
                selectedId === txn.id
                  ? 'bg-primary-100 border-l-4 border-l-primary-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              {isHighConfidence && txn.status === 'pending' && onBatchConfirm && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(txn.id)}
                  onChange={() => {}}
                  onClick={(e) => toggleSelection(txn.id, e)}
                  className="mr-3 w-4 h-4 text-primary-600 rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{txn.vendor_name || '不明'}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    txn.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}>
                    {txn.status === 'confirmed' ? '済' : '未'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 flex gap-2">
                  <span>{txn.transaction_date || '日付不明'}</span>
                  {txn.ai_confidence !== null && (
                    <span className={
                      txn.ai_confidence >= 80 ? 'text-green-600' :
                      txn.ai_confidence >= 60 ? 'text-orange-600' : 'text-red-600'
                    }>
                      {txn.ai_confidence}%
                    </span>
                  )}
                </div>
              </div>
              <span className="font-semibold text-sm">
                ¥{(txn.amount || 0).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
