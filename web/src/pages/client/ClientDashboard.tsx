import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useClientContext } from '../../hooks/useClientContext';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  vendor: string;
  account_category: string;
  status: string;
  confidence: number;
}

export default function ClientDashboard() {
  const navigate = useNavigate();
  const { selectedClient } = useClientContext();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (!selectedClient) {
    return null;
  }

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const confirmedCount = transactions.filter(t => t.status === 'confirmed').length;
  const onHoldCount = transactions.filter(t => t.status === 'on_hold').length;
  const lowConfidenceCount = transactions.filter(t => t.status === 'pending' && (t.confidence ?? 100) < 80).length;
  const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);

  // Recent pending transactions
  const recentPending = transactions
    .filter(t => t.status === 'pending')
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Required Alert */}
      {onHoldCount > 0 && (
        <button
          onClick={() => navigate('/client/transactions?status=on_hold')}
          className="w-full bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 text-left hover:bg-yellow-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-yellow-800">確認依頼 (Action Required)</p>
              <p className="text-sm text-yellow-700">
                {onHoldCount}件の取引について、使途・内容の確認をお願いします
              </p>
            </div>
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">要確認</p>
          <p className="text-2xl font-bold text-orange-600">{pendingCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">確認済</p>
          <p className="text-2xl font-bold text-green-600">{confirmedCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">低信頼度</p>
          <p className="text-2xl font-bold text-red-600">{lowConfidenceCount}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">今月合計</p>
          <p className="text-2xl font-bold text-gray-900">¥{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/client/review')}
          className="bg-green-600 text-white rounded-lg p-4 text-left hover:bg-green-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            <div>
              <p className="font-semibold">審核モード</p>
              <p className="text-sm opacity-75">{pendingCount}件の取引を審核</p>
            </div>
          </div>
        </button>
        <button
          onClick={() => navigate('/client/transactions')}
          className="bg-primary-600 text-white rounded-lg p-4 text-left hover:bg-primary-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <div>
              <p className="font-semibold">取引一覧</p>
              <p className="text-sm opacity-75">全{transactions.length}件の取引</p>
            </div>
          </div>
        </button>
      </div>

      {/* Recent Pending */}
      {recentPending.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">要確認の取引</h2>
            <button
              onClick={() => navigate('/client/review')}
              className="text-sm text-primary-600"
            >
              すべて見る →
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {recentPending.map((txn) => (
              <div key={txn.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{txn.vendor || '不明'}</p>
                  <p className="text-sm text-gray-500">
                    {txn.date} · {txn.account_category || '未分類'}
                    {(txn.confidence ?? 100) < 80 && (
                      <span className="ml-2 text-orange-600">信頼度 {txn.confidence}%</span>
                    )}
                  </p>
                </div>
                <p className="font-semibold">¥{(txn.amount || 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {pendingCount === 0 && (
        <div className="bg-green-50 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-800 font-semibold">すべての取引が確認済みです</p>
          <p className="text-green-600 text-sm mt-1">確認待ちの取引はありません</p>
        </div>
      )}
    </div>
  );
}
