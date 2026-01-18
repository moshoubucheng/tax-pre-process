import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useClientContext, SelectedClient } from '../hooks/useClientContext';

interface Company {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
  monthly_total: number;
  settlement_color: 'normal' | 'yellow' | 'red';
  business_year_end: string | null;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { setSelectedClient } = useClientContext();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

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

  function handleSelectClient(company: Company) {
    const client: SelectedClient = {
      id: company.id,
      name: company.name,
      pending_count: company.pending_count,
      confirmed_count: company.confirmed_count,
    };
    setSelectedClient(client);
    navigate('/client/dashboard');
  }

  // Filter companies with alerts
  const redAlerts = companies.filter(c => c.settlement_color === 'red');
  const yellowAlerts = companies.filter(c => c.settlement_color === 'yellow');
  const pendingWork = companies.filter(c => c.pending_count > 0).sort((a, b) => b.pending_count - a.pending_count);

  // Stats
  const totalPending = companies.reduce((sum, c) => sum + c.pending_count, 0);
  const totalConfirmed = companies.reduce((sum, c) => sum + c.confirmed_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">顧問先数</p>
          <p className="text-2xl font-bold text-gray-900">{companies.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">要確認合計</p>
          <p className="text-2xl font-bold text-orange-600">{totalPending}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">確認済合計</p>
          <p className="text-2xl font-bold text-green-600">{totalConfirmed}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <p className="text-sm text-gray-500">決算アラート</p>
          <p className={`text-2xl font-bold ${redAlerts.length + yellowAlerts.length > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {redAlerts.length + yellowAlerts.length}
          </p>
        </div>
      </div>

      {/* Red Alerts - Settlement Overdue */}
      {redAlerts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h2 className="font-semibold text-red-800">決算期限超過 ({redAlerts.length}社)</h2>
          </div>
          <div className="space-y-2">
            {redAlerts.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectClient(company)}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-red-100 transition-colors"
              >
                <span className="font-medium text-red-700">{company.name}</span>
                <span className="text-sm text-red-600">決算月: {company.business_year_end}月</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Yellow Alerts - Settlement Approaching */}
      {yellowAlerts.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <h2 className="font-semibold text-yellow-800">決算期限接近 ({yellowAlerts.length}社)</h2>
          </div>
          <div className="space-y-2">
            {yellowAlerts.map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectClient(company)}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg hover:bg-yellow-100 transition-colors"
              >
                <span className="font-medium text-yellow-700">{company.name}</span>
                <span className="text-sm text-yellow-600">決算月: {company.business_year_end}月</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending Work */}
      {pendingWork.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">確認待ちの取引</h2>
            <button
              onClick={() => navigate('/clients')}
              className="text-sm text-primary-600"
            >
              すべて見る →
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingWork.slice(0, 5).map((company) => (
              <button
                key={company.id}
                onClick={() => handleSelectClient(company)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 text-left"
              >
                <div>
                  <p className="font-medium text-gray-900">{company.name}</p>
                  <p className="text-sm text-gray-500">
                    今月: ¥{company.monthly_total.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-orange-600 font-semibold">{company.pending_count}件</p>
                  <p className="text-xs text-gray-500">要確認</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {companies.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="text-gray-500">顧問先がまだ登録されていません</p>
          <button
            onClick={() => navigate('/clients')}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md text-sm"
          >
            顧問先を追加
          </button>
        </div>
      )}

      {/* All clear */}
      {companies.length > 0 && totalPending === 0 && redAlerts.length === 0 && yellowAlerts.length === 0 && (
        <div className="bg-green-50 rounded-lg p-8 text-center">
          <svg className="w-12 h-12 mx-auto text-green-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-green-800 font-semibold">すべて完了しています</p>
          <p className="text-green-600 text-sm mt-1">確認待ちの取引やアラートはありません</p>
        </div>
      )}
    </div>
  );
}
