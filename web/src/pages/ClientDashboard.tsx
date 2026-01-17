import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../lib/api';

interface DashboardStats {
  monthly_total: number;
  pending_count: number;
  confirmed_count: number;
}

interface BusinessYearAlert {
  alert: boolean;
  color?: 'yellow' | 'red';
  message?: string;
  company_name?: string;
  end_month?: number;
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

const ACCOUNT_OPTIONS = [
  '旅費交通費',
  '接待交際費',
  '会議費',
  '消耗品費',
  '通信費',
  '事務用品費',
  '水道光熱費',
  '広告宣伝費',
  '外注費',
  '雑費',
];

const TAX_OPTIONS = [
  '課対仕入内8%',
  '課対仕入内10%',
  '非課税仕入',
  '対象外',
];

export default function ClientDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [pendingList, setPendingList] = useState<PendingTransaction[]>([]);
  const [confirmedList, setConfirmedList] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessYearAlert, setBusinessYearAlert] = useState<BusinessYearAlert | null>(null);

  // Transaction detail modal
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    transaction_date: '',
    amount: '',
    vendor_name: '',
    account_debit: '',
    tax_category: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const [statsRes, monthlyRes, pendingRes, confirmedRes, alertRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<{ data: MonthlyData[] }>('/dashboard/monthly'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/pending'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/confirmed'),
        api.get<BusinessYearAlert>('/dashboard/business-year-alert'),
      ]);
      setStats(statsRes);
      setMonthlyData(monthlyRes.data || []);
      setPendingList(pendingRes.data || []);
      setConfirmedList(confirmedRes.data || []);
      setBusinessYearAlert(alertRes);
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
    setIsEditing(false);
  }

  function startEditing() {
    if (!selectedTxn) return;
    setEditForm({
      transaction_date: selectedTxn.transaction_date || '',
      amount: selectedTxn.amount?.toString() || '',
      vendor_name: selectedTxn.vendor_name || '',
      account_debit: selectedTxn.account_debit || '',
      tax_category: selectedTxn.tax_category || '',
    });
    setIsEditing(true);
  }

  async function handleSaveEdit() {
    if (!selectedTxn) return;

    setSaving(true);
    try {
      await api.put(`/transactions/${selectedTxn.id}`, {
        transaction_date: editForm.transaction_date,
        amount: parseInt(editForm.amount) || 0,
        vendor_name: editForm.vendor_name,
        account_debit: editForm.account_debit,
        tax_category: editForm.tax_category,
      });

      // Update local state
      setSelectedTxn({
        ...selectedTxn,
        transaction_date: editForm.transaction_date,
        amount: parseInt(editForm.amount) || 0,
        vendor_name: editForm.vendor_name,
        account_debit: editForm.account_debit,
        tax_category: editForm.tax_category,
      });

      // Update lists
      const updateList = (list: PendingTransaction[]) =>
        list.map(t => t.id === selectedTxn.id ? {
          ...t,
          transaction_date: editForm.transaction_date,
          amount: parseInt(editForm.amount) || 0,
          vendor_name: editForm.vendor_name,
        } : t);

      setPendingList(updateList(pendingList));
      setConfirmedList(updateList(confirmedList));

      setIsEditing(false);
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selectedTxn) return;

    if (!confirm('この取引を削除しますか？\nこの操作は取り消せません。')) return;

    setDeleting(true);
    try {
      await api.delete(`/transactions/${selectedTxn.id}`);

      // Remove from lists
      setPendingList(pendingList.filter(t => t.id !== selectedTxn.id));
      setConfirmedList(confirmedList.filter(t => t.id !== selectedTxn.id));

      // Update stats
      if (stats && selectedTxn.status === 'pending') {
        setStats({ ...stats, pending_count: stats.pending_count - 1 });
      } else if (stats && selectedTxn.status === 'confirmed') {
        setStats({ ...stats, confirmed_count: stats.confirmed_count - 1 });
      }

      closeDetail();
      alert('削除しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '削除に失敗しました');
    } finally {
      setDeleting(false);
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
      {/* Business Year Alert */}
      {businessYearAlert?.alert && (
        <div className={`rounded-lg p-4 flex items-start gap-3 ${
          businessYearAlert.color === 'red'
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <svg className={`w-6 h-6 flex-shrink-0 mt-0.5 ${
            businessYearAlert.color === 'red' ? 'text-red-600' : 'text-yellow-600'
          }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h3 className={`font-semibold ${
              businessYearAlert.color === 'red' ? 'text-red-800' : 'text-yellow-800'
            }`}>
              {businessYearAlert.color === 'red' ? '事業年度終了 - 至急対応' : '事業年度終了のお知らせ'}
            </h3>
            <p className={`text-sm mt-1 ${
              businessYearAlert.color === 'red' ? 'text-red-700' : 'text-yellow-700'
            }`}>{businessYearAlert.message}</p>
          </div>
        </div>
      )}

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

      {/* Confirmed Transactions */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          確認済リスト
          {confirmedList.length > 0 && (
            <span className="ml-2 text-sm font-normal text-green-600">
              ({confirmedList.length}件)
            </span>
          )}
        </h2>

        {confirmedList.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            確認済みの取引はありません
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {confirmedList.map((txn) => (
              <li
                key={txn.id}
                onClick={() => openTransactionDetail(txn.id)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-4 px-4 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {txn.vendor_name || '不明な店舗'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      確認済
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {txn.transaction_date || '日付不明'}
                  </p>
                </div>
                <div className="text-right flex items-center gap-2">
                  <p className="font-medium text-gray-900">
                    ¥{(txn.amount || 0).toLocaleString()}
                  </p>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Transaction Detail Modal/Full Screen */}
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

                  {/* Edit Form or View Mode */}
                  {isEditing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
                        <input
                          type="date"
                          value={editForm.transaction_date}
                          onChange={(e) => setEditForm({ ...editForm, transaction_date: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">金額</label>
                        <input
                          type="number"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">店名/取引先</label>
                        <input
                          type="text"
                          value={editForm.vendor_name}
                          onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">勘定科目</label>
                        <select
                          value={editForm.account_debit}
                          onChange={(e) => setEditForm({ ...editForm, account_debit: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">選択してください</option>
                          {ACCOUNT_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">税区分</label>
                        <select
                          value={editForm.tax_category}
                          onChange={(e) => setEditForm({ ...editForm, tax_category: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        >
                          <option value="">選択してください</option>
                          {TAX_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
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
                  )}
                </div>

                <div className="p-4 border-t border-gray-200">
                  {isEditing ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsEditing(false)}
                        className="flex-1 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        キャンセル
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={saving}
                        className="flex-1 py-2 bg-primary-600 text-white rounded-md text-sm disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '保存'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        {selectedTxn.status === 'pending' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={startEditing}
                              className="px-3 py-1.5 text-sm text-primary-600 border border-primary-600 rounded-md hover:bg-primary-50"
                            >
                              編集
                            </button>
                            <button
                              onClick={handleDelete}
                              disabled={deleting}
                              className="px-3 py-1.5 text-sm text-red-600 border border-red-600 rounded-md hover:bg-red-50 disabled:opacity-50"
                            >
                              {deleting ? '削除中...' : '削除'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm text-green-600">
                            ✓ 管理者により確認済み
                          </span>
                        )}
                      </div>
                      <button
                        onClick={closeDetail}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm"
                      >
                        閉じる
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
