import { useState } from 'react';
import { api } from '../lib/api';
import ImageLightbox from '../components/ImageLightbox';

interface Transaction {
  id: string;
  type: 'expense' | 'income';
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  account_credit: string | null;
  tax_category: string | null;
  tax_rate: number | null;
  ai_confidence: number | null;
  status: 'pending' | 'confirmed' | 'on_hold';
  description: string | null;
  image_key: string;
  created_at: string;
}

export default function AuditSearch() {
  // Search filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income'>('all');

  // Results
  const [results, setResults] = useState<Transaction[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Detail modal
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  // Lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  async function handleSearch() {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (minAmount) params.append('min_amount', minAmount);
      if (maxAmount) params.append('max_amount', maxAmount);
      if (vendorName) params.append('search', vendorName);
      // Note: type filter is applied client-side since API may not support it directly

      const queryString = params.toString();
      const res = await api.get<{ data: Transaction[] }>(
        `/transactions${queryString ? '?' + queryString : ''}`
      );

      let data = res.data || [];

      // Apply type filter client-side
      if (typeFilter !== 'all') {
        data = data.filter(t => t.type === typeFilter);
      }

      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setMinAmount('');
    setMaxAmount('');
    setVendorName('');
    setTypeFilter('all');
    setResults([]);
    setSearched(false);
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.VITE_API_URL || '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  function getStatusLabel(status: string): { label: string; className: string } {
    switch (status) {
      case 'confirmed':
        return { label: '確認済', className: 'bg-green-100 text-green-700' };
      case 'on_hold':
        return { label: '確認待ち', className: 'bg-yellow-100 text-yellow-700' };
      default:
        return { label: '未処理', className: 'bg-orange-100 text-orange-700' };
    }
  }

  function getTypeLabel(type: string): { label: string; className: string } {
    if (type === 'income') {
      return { label: '売上', className: 'text-green-600' };
    }
    return { label: '経費', className: 'text-red-600' };
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">証憑検索</h1>
          <p className="text-sm text-gray-500 mt-1">
            電子帳簿保存法に準拠した検索機能
          </p>
        </div>
      </div>

      {/* Search Panel */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          検索条件
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Range */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              取引年月日（範囲）
              <span className="ml-1 text-primary-600">*必須</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
              <span className="text-gray-400">〜</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>

          {/* Amount Range */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              取引金額（範囲）
              <span className="ml-1 text-primary-600">*必須</span>
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">¥</span>
                <input
                  type="number"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <span className="text-gray-400">〜</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-2.5 text-gray-400 text-sm">¥</span>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  placeholder="999999"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Vendor Name */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              取引先名（部分一致）
              <span className="ml-1 text-primary-600">*必須</span>
            </label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="例: Amazon, コンビニ"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Type Filter (Optional) */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              種別（任意）
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'expense' | 'income')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="all">すべて</option>
              <option value="expense">経費のみ</option>
              <option value="income">売上のみ</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
          >
            クリア
          </button>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-primary-600 text-white rounded-md text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                検索中...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                検索
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {/* Results Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              検索結果
              <span className="ml-2 text-sm font-normal text-gray-500">
                {results.length}件
              </span>
            </h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : results.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>該当する取引が見つかりませんでした</p>
              <p className="text-sm mt-1">検索条件を変更してお試しください</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">日付</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">種別</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">取引先</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">金額</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">勘定科目</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ステータス</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">画像</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {results.map((txn) => {
                      const status = getStatusLabel(txn.status);
                      const type = getTypeLabel(txn.type);
                      return (
                        <tr
                          key={txn.id}
                          onClick={() => setSelectedTxn(txn)}
                          className="hover:bg-gray-50 cursor-pointer"
                        >
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {txn.transaction_date || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-medium ${type.className}`}>
                              {type.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 max-w-[200px] truncate">
                            {txn.vendor_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-medium">
                            <span className={txn.type === 'income' ? 'text-green-600' : 'text-gray-900'}>
                              {txn.type === 'income' ? '+' : ''}¥{(txn.amount || 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {txn.account_debit || '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-1 text-xs rounded-full ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxSrc(getImageUrl(txn.id));
                              }}
                              className="text-primary-600 hover:text-primary-800"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile List */}
              <div className="md:hidden divide-y divide-gray-100">
                {results.map((txn) => {
                  const status = getStatusLabel(txn.status);
                  const type = getTypeLabel(txn.type);
                  return (
                    <div
                      key={txn.id}
                      onClick={() => setSelectedTxn(txn)}
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-medium ${type.className}`}>
                              {type.label}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${status.className}`}>
                              {status.label}
                            </span>
                          </div>
                          <p className="font-medium text-gray-900 truncate">
                            {txn.vendor_name || '不明'}
                          </p>
                          <p className="text-sm text-gray-500">
                            {txn.transaction_date || '日付不明'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`font-semibold ${txn.type === 'income' ? 'text-green-600' : 'text-gray-900'}`}>
                            {txn.type === 'income' ? '+' : ''}¥{(txn.amount || 0).toLocaleString()}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLightboxSrc(getImageUrl(txn.id));
                            }}
                            className="p-1 text-primary-600"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col">
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
                className="bg-gray-100 rounded-lg overflow-hidden cursor-pointer"
                onClick={() => setLightboxSrc(getImageUrl(selectedTxn.id))}
              >
                <img
                  src={getImageUrl(selectedTxn.id)}
                  alt="領収書"
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">ステータス</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusLabel(selectedTxn.status).className}`}>
                    {getStatusLabel(selectedTxn.status).label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">種別</span>
                  <span className={`font-medium ${getTypeLabel(selectedTxn.type).className}`}>
                    {getTypeLabel(selectedTxn.type).label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">取引先</span>
                  <span className="font-medium">{selectedTxn.vendor_name || '不明'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">日付</span>
                  <span className="font-medium">{selectedTxn.transaction_date || '不明'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">金額</span>
                  <span className={`font-medium text-lg ${selectedTxn.type === 'income' ? 'text-green-600' : ''}`}>
                    {selectedTxn.type === 'income' ? '+' : ''}¥{(selectedTxn.amount || 0).toLocaleString()}
                  </span>
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
                {selectedTxn.tax_rate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">税率</span>
                    <span className="font-medium">{selectedTxn.tax_rate}%</span>
                  </div>
                )}
                {selectedTxn.description && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">備考</span>
                    <span className="font-medium">{selectedTxn.description}</span>
                  </div>
                )}
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

            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setSelectedTxn(null)}
                className="w-full py-2 border border-gray-300 rounded-md text-sm"
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
