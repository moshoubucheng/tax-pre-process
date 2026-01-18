import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  settlement_confirmed: number;
}

export default function Clients() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { setSelectedClient } = useClientContext();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);

  // Filter from URL
  const filterType = searchParams.get('filter');

  // New company form
  const [showForm, setShowForm] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', email: '', password: '', userName: '' });
  const [creating, setCreating] = useState(false);

  // Settlement modal
  const [settlementModal, setSettlementModal] = useState<{ company: Company } | null>(null);
  const [settlementInput, setSettlementInput] = useState('');
  const [confirmingSettlement, setConfirmingSettlement] = useState(false);

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

  async function handleExport(companyId: string, e: React.MouseEvent) {
    e.stopPropagation();
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

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const companyRes = await api.post<{ id: string }>('/admin/companies', {
        name: newCompany.name,
      });

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

  // Filter companies based on URL param
  const filteredCompanies = filterType === 'settlement'
    ? companies.filter(c => c.settlement_color === 'red' || c.settlement_color === 'yellow')
    : companies;

  const title = filterType === 'settlement' ? '決算アラート' : '顧問先一覧';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {filterType && (
            <button
              onClick={() => navigate('/clients')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-xl font-bold text-gray-900">{title}</h1>
          <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
            {filteredCompanies.length}社
          </span>
        </div>
        {!filterType && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm"
          >
            新規追加
          </button>
        )}
      </div>

      {/* New Company Form Modal */}
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
        {/* Desktop Table */}
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
              {filteredCompanies.map((company) => (
                <tr
                  key={company.id}
                  onClick={() => handleSelectClient(company)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-medium">
                    <div className="flex items-center gap-2">
                      <span className={getCompanyNameStyle(company.settlement_color)}>
                        {company.name}
                      </span>
                      {company.settlement_color !== 'normal' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openSettlementModal(company);
                          }}
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
                  <td className="px-6 py-4 whitespace-nowrap text-green-600">
                    {company.confirmed_count}件
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-orange-600">
                    {company.pending_count}件
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <button
                      onClick={(e) => handleExport(company.id, e)}
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
          {filteredCompanies.map((company) => (
            <div
              key={company.id}
              onClick={() => handleSelectClient(company)}
              className="p-4 cursor-pointer hover:bg-gray-50"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${getCompanyNameStyle(company.settlement_color)}`}>
                    {company.name}
                  </span>
                  {company.settlement_color !== 'normal' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openSettlementModal(company);
                      }}
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
                <div className="flex gap-4">
                  <span className="text-green-600">確認済: {company.confirmed_count}</span>
                  <span className="text-orange-600">要確認: {company.pending_count}</span>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {filteredCompanies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            {filterType === 'settlement' ? '決算アラートはありません' : '顧問先がまだ登録されていません'}
          </div>
        )}
      </div>

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
    </div>
  );
}
