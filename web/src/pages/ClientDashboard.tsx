import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';

interface DashboardStats {
  monthly_total: number;
  pending_count: number;
  confirmed_count: number;
}

interface MonthlyData {
  month: string;
  amount: number;
}

interface PendingTransaction {
  id: string;
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  ai_confidence: number | null;
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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [pendingList, setPendingList] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Transaction detail modal
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsRes, monthlyRes, pendingRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<{ data: MonthlyData[] }>('/dashboard/monthly'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/pending'),
      ]);
      setStats(statsRes);
      setMonthlyData(monthlyRes.data || []);
      setPendingList(pendingRes.data || []);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openTransactionDetail(id: string) {
    setLoadingDetail(true);
    try {
      const res = await api.get<{ data: TransactionDetail }>(`/transactions/${id}`);
      setSelectedTxn(res.data);
    } catch (err) {
      console.error('Failed to load transaction:', err);
      alert('取引情報の取得に失敗しました');
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedTxn(null);
  }

  async function handleConfirm() {
    if (!selectedTxn) return;
    setConfirming(true);
    try {
      await api.put(`/transactions/${selectedTxn.id}/confirm`, {});
      // Update local state
      setSelectedTxn({ ...selectedTxn, status: 'confirmed' });
      setPendingList(pendingList.filter(t => t.id !== selectedTxn.id));
      if (stats) {
        setStats({
          ...stats,
          pending_count: stats.pending_count - 1,
          confirmed_count: stats.confirmed_count + 1,
        });
      }
    } catch (err) {
      console.error('Failed to confirm:', err);
      alert('確定に失敗しました');
    } finally {
      setConfirming(false);
    }
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
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
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">今月の合計</p>
          <p className="text-2xl font-bold text-gray-900">
            ¥{(stats?.monthly_total || 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">確認済み</p>
          <p className="text-2xl font-bold text-green-600">
            {stats?.confirmed_count || 0}件
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">要確認</p>
          <p className="text-2xl font-bold text-orange-600">
            {stats?.pending_count || 0}件
          </p>
        </div>
      </div>

      {/* Quick Upload Button (Mobile) */}
      <button
        onClick={() => navigate('/upload')}
        className="md:hidden w-full bg-primary-600 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        領収書をアップロード
      </button>

      {/* Monthly Chart */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">月別推移</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pending Transactions */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          要確認リスト
          {pendingList.length > 0 && (
            <span className="ml-2 text-sm font-normal text-orange-600">
              ({pendingList.length}件)
            </span>
          )}
        </h2>

        {pendingList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            確認が必要な項目はありません
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {pendingList.map((txn) => (
              <li
                key={txn.id}
                onClick={() => openTransactionDetail(txn.id)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {txn.vendor_name || '不明な店舗'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {txn.transaction_date || '日付不明'}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      ¥{(txn.amount || 0).toLocaleString()}
                    </p>
                    {txn.ai_confidence !== null && txn.ai_confidence < 70 && (
                      <span className="text-xs text-red-600">
                        要確認 ({txn.ai_confidence}%)
                      </span>
                    )}
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transaction Detail Modal */}
      {(selectedTxn || loadingDetail) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {loadingDetail ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : selectedTxn ? (
              <>
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">取引詳細</h2>
                  <button
                    onClick={closeDetail}
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
                      onClick={handleConfirm}
                      disabled={confirming}
                      className="px-4 py-2 bg-green-600 text-white rounded-md text-sm disabled:opacity-50"
                    >
                      {confirming ? '処理中...' : '確定する'}
                    </button>
                  )}
                  <button
                    onClick={closeDetail}
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
    </div>
  );
}
