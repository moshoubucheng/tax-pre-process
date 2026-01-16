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

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [pendingList, setPendingList] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);

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
              <li key={txn.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">
                    {txn.vendor_name || '不明な店舗'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {txn.transaction_date || '日付不明'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    ¥{(txn.amount || 0).toLocaleString()}
                  </p>
                  {txn.ai_confidence !== null && txn.ai_confidence < 70 && (
                    <span className="text-xs text-red-600">
                      要確認 ({txn.ai_confidence}%)
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
