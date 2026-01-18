import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { api } from '../lib/api';
import ImageLightbox from '../components/ImageLightbox';

interface DashboardStats {
  monthly_total: number;
  pending_count: number;
  confirmed_count: number;
  on_hold_count: number;
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
  description: string | null;
  admin_note: string | null;
  status: 'pending' | 'confirmed' | 'on_hold';
  image_key: string;
  created_at: string;
}

interface Message {
  id: string;
  transaction_id: string;
  user_id: string;
  role: 'admin' | 'client';
  message: string;
  created_at: string;
}

interface FinancialSummary {
  year: number;
  month: number;
  confirmed: {
    income: number;
    expense: number;
    profit: number;
    income_tax: number;
    expense_tax: number;
    tax_estimate: number;
  };
  pending: {
    income: number;
    expense: number;
  };
  monthly_trend: { month: string; income: number; expense: number }[];
  expense_breakdown: { name: string; value: number }[];
}

// Colors for pie chart
const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

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
  const [onHoldList, setOnHoldList] = useState<PendingTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [businessYearAlert, setBusinessYearAlert] = useState<BusinessYearAlert | null>(null);
  const [replying, setReplying] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Transaction detail modal
  const [selectedTxn, setSelectedTxn] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    transaction_date: '',
    amount: '',
    vendor_name: '',
    account_debit: '',
    tax_category: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Search/Filter
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
  });

  // Image lightbox
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  // Financial Summary (BI)
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Load financial summary when year/month changes
  useEffect(() => {
    loadFinancialSummary();
  }, [selectedYear, selectedMonth]);

  async function loadDashboard() {
    try {
      const [statsRes, monthlyRes, pendingRes, confirmedRes, onHoldRes, alertRes] = await Promise.all([
        api.get<DashboardStats>('/dashboard/stats'),
        api.get<{ data: MonthlyData[] }>('/dashboard/monthly'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/pending'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/confirmed'),
        api.get<{ data: PendingTransaction[] }>('/dashboard/on-hold'),
        api.get<BusinessYearAlert>('/dashboard/business-year-alert'),
      ]);
      setStats(statsRes);
      setMonthlyData(monthlyRes.data || []);
      setPendingList(pendingRes.data || []);
      setConfirmedList(confirmedRes.data || []);
      setOnHoldList(onHoldRes.data || []);
      setBusinessYearAlert(alertRes);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadFinancialSummary() {
    setLoadingFinancial(true);
    try {
      const res = await api.get<FinancialSummary>(
        `/dashboard/financial-summary?year=${selectedYear}&month=${selectedMonth}`
      );
      setFinancialSummary(res);
    } catch (err) {
      console.error('Failed to load financial summary:', err);
    } finally {
      setLoadingFinancial(false);
    }
  }

  // Format currency
  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('ja-JP', {
      style: 'currency',
      currency: 'JPY',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  // Format month for chart display
  function formatChartMonth(monthStr: string): string {
    const [, month] = monthStr.split('-');
    return `${month}月`;
  }

  async function handleSearch() {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (filters.startDate) params.append('start_date', filters.startDate);
      if (filters.endDate) params.append('end_date', filters.endDate);
      if (filters.minAmount) params.append('min_amount', filters.minAmount);
      if (filters.maxAmount) params.append('max_amount', filters.maxAmount);

      const queryString = params.toString();
      const [pendingRes, confirmedRes] = await Promise.all([
        api.get<{ data: PendingTransaction[] }>(`/dashboard/pending${queryString ? '?' + queryString : ''}`),
        api.get<{ data: PendingTransaction[] }>(`/dashboard/confirmed${queryString ? '?' + queryString : ''}`),
      ]);

      setPendingList(pendingRes.data || []);
      setConfirmedList(confirmedRes.data || []);
    } catch (err) {
      console.error('Search failed:', err);
    }
  }

  function clearFilters() {
    setSearchQuery('');
    setFilters({ startDate: '', endDate: '', minAmount: '', maxAmount: '' });
    loadDashboard();
  }

  async function openTransactionDetail(id: string) {
    setLoadingDetail(true);
    setMessages([]);
    setNewMessage('');
    try {
      const [txnRes, msgRes] = await Promise.all([
        api.get<{ data: TransactionDetail }>(`/transactions/${id}`),
        api.get<{ data: Message[] }>(`/transactions/${id}/messages`),
      ]);
      setSelectedTxn(txnRes.data);
      setMessages(msgRes.data || []);
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
      description: selectedTxn.description || '',
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
        description: editForm.description,
      });

      // Update local state
      setSelectedTxn({
        ...selectedTxn,
        transaction_date: editForm.transaction_date,
        amount: parseInt(editForm.amount) || 0,
        vendor_name: editForm.vendor_name,
        account_debit: editForm.account_debit,
        tax_category: editForm.tax_category,
        description: editForm.description,
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
      setOnHoldList(updateList(onHoldList));

      setIsEditing(false);
      alert('保存しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // Reply to on_hold transaction (sends it back to admin as pending)
  async function handleReply() {
    if (!selectedTxn || selectedTxn.status !== 'on_hold') return;

    setReplying(true);
    try {
      // First update vendor_name if provided
      if (editForm.vendor_name) {
        await api.put(`/transactions/${selectedTxn.id}`, {
          vendor_name: editForm.vendor_name,
        });
      }

      // Send message via API (this also changes status to pending)
      const messageToSend = editForm.description.trim() || newMessage.trim();
      if (messageToSend) {
        await api.post(`/transactions/${selectedTxn.id}/messages`, {
          message: messageToSend,
        });
      }

      // Remove from on_hold list
      setOnHoldList(onHoldList.filter(t => t.id !== selectedTxn.id));

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          on_hold_count: stats.on_hold_count - 1,
          pending_count: stats.pending_count + 1,
        });
      }

      closeDetail();
      alert('回答を送信しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : '送信に失敗しました');
    } finally {
      setReplying(false);
    }
  }

  // Confirm on_hold transaction (client agrees with admin's edits)
  async function handleConfirmApproval() {
    if (!selectedTxn || selectedTxn.status !== 'on_hold') return;

    setConfirming(true);
    try {
      await api.put(`/transactions/${selectedTxn.id}`, {
        status: 'confirmed',
      });

      // Remove from on_hold list and add to confirmed list
      setOnHoldList(onHoldList.filter(t => t.id !== selectedTxn.id));
      setConfirmedList([...confirmedList, {
        id: selectedTxn.id,
        transaction_date: selectedTxn.transaction_date,
        amount: selectedTxn.amount,
        vendor_name: selectedTxn.vendor_name,
        ai_confidence: selectedTxn.ai_confidence,
      }]);

      // Update stats
      if (stats) {
        setStats({
          ...stats,
          on_hold_count: stats.on_hold_count - 1,
          confirmed_count: stats.confirmed_count + 1,
        });
      }

      closeDetail();
      alert('確認しました。処理を完了します。');
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirming(false);
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
      {/* Action Required Alert - On Hold Items */}
      {(stats?.on_hold_count || 0) > 0 && (
        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-yellow-800">確認依頼 (Action Required)</p>
              <p className="text-sm text-yellow-700">
                {stats?.on_hold_count}件の取引について、使途・内容の確認をお願いします
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* ===== Financial Summary Section (BI Dashboard) ===== */}
      <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
        {/* Header with Year/Month Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900">財務サマリー</h2>
          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              {[0, 1, 2].map((offset) => {
                const year = new Date().getFullYear() - offset;
                return <option key={year} value={year}>{year}年</option>;
              })}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>{month}月</option>
              ))}
            </select>
          </div>
        </div>

        {loadingFinancial ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : financialSummary ? (
          <>
            {/* Financial Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
              {/* Income */}
              <div className="bg-green-50 rounded-lg p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-green-600 text-lg">+</span>
                  <p className="text-sm text-gray-600">売上</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-green-600">
                  {formatCurrency(financialSummary.confirmed.income)}
                </p>
                {financialSummary.pending.income > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    (+{formatCurrency(financialSummary.pending.income)} 未確認)
                  </p>
                )}
              </div>

              {/* Expense */}
              <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-red-600 text-lg">▲</span>
                  <p className="text-sm text-gray-600">経費</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-red-600">
                  {formatCurrency(financialSummary.confirmed.expense)}
                </p>
                {financialSummary.pending.expense > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    (+{formatCurrency(financialSummary.pending.expense)} 未確認)
                  </p>
                )}
              </div>

              {/* Profit */}
              <div className={`rounded-lg p-4 border-l-4 ${
                financialSummary.confirmed.profit >= 0
                  ? 'bg-blue-50 border-blue-500'
                  : 'bg-orange-50 border-orange-500'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <svg className={`w-4 h-4 ${financialSummary.confirmed.profit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-600">粗利</p>
                </div>
                <p className={`text-xl md:text-2xl font-bold ${
                  financialSummary.confirmed.profit >= 0 ? 'text-blue-600' : 'text-orange-600'
                }`}>
                  {formatCurrency(financialSummary.confirmed.profit)}
                </p>
              </div>

              {/* Tax Estimate */}
              <div className="bg-gray-50 rounded-lg p-4 border-l-4 border-gray-400">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-gray-600">消費税目安</p>
                </div>
                <p className="text-xl md:text-2xl font-bold text-gray-700">
                  {formatCurrency(financialSummary.confirmed.tax_estimate)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  売上税額 - 仕入税額
                </p>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Monthly Trend Bar Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">月次推移（過去6ヶ月）</h3>
                {financialSummary.monthly_trend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={financialSummary.monthly_trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                      <XAxis
                        dataKey="month"
                        tickFormatter={formatChartMonth}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={(v) => `${Math.floor(v / 10000)}万`}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => `${label.replace('-', '年')}月`}
                      />
                      <Bar dataKey="income" name="売上" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expense" name="経費" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
                    データがありません
                  </div>
                )}
              </div>

              {/* Expense Breakdown Pie Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-4">経費内訳（当月Top5）</h3>
                {financialSummary.expense_breakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={financialSummary.expense_breakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {financialSummary.expense_breakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-gray-500 text-sm">
                    データがありません
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            データの読み込みに失敗しました
          </div>
        )}
      </div>

      {/* ===== Status Cards (Original) ===== */}
      <div className="grid grid-cols-2 gap-4">
        {/* Pending Items */}
        <div
          className={`rounded-lg shadow-sm p-4 border-l-4 ${
            (stats?.pending_count || 0) > 0
              ? 'bg-orange-50 border-orange-500'
              : 'bg-green-50 border-green-500'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {(stats?.pending_count || 0) > 0 ? (
              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            <p className="text-sm text-gray-600 font-medium">未処理残数</p>
          </div>
          <p className={`text-3xl font-bold ${(stats?.pending_count || 0) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {stats?.pending_count || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(stats?.pending_count || 0) > 0 ? '確認待ちの取引' : 'すべて完了'}
          </p>
        </div>

        {/* On Hold Items */}
        <div
          className={`rounded-lg shadow-sm p-4 border-l-4 ${
            (stats?.on_hold_count || 0) > 0
              ? 'bg-yellow-50 border-yellow-500'
              : 'bg-gray-50 border-gray-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            <svg className={`w-5 h-5 ${(stats?.on_hold_count || 0) > 0 ? 'text-yellow-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-gray-600 font-medium">確認待ち</p>
          </div>
          <p className={`text-3xl font-bold ${(stats?.on_hold_count || 0) > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
            {stats?.on_hold_count || 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {(stats?.on_hold_count || 0) > 0 ? '回答が必要です' : '回答待ちなし'}
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

      {/* Search/Filter */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="店名で検索..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 border rounded-md text-sm ${showFilters ? 'border-primary-500 text-primary-600 bg-primary-50' : 'border-gray-300 text-gray-600'}`}
          >
            絞込
          </button>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-md text-sm"
          >
            検索
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1">開始日</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">終了日</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">最小金額</label>
              <input
                type="number"
                value={filters.minAmount}
                onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                placeholder="¥0"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">最大金額</label>
              <input
                type="number"
                value={filters.maxAmount}
                onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                placeholder="¥999999"
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
              />
            </div>
            <div className="col-span-2 md:col-span-4 flex justify-end">
              <button
                onClick={clearFilters}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                フィルターをクリア
              </button>
            </div>
          </div>
        )}
      </div>

      {/* On Hold Transactions - Action Required */}
      {onHoldList.length > 0 && (
        <div className="bg-yellow-50 rounded-lg shadow-sm p-4 border border-yellow-200">
          <h2 className="text-lg font-semibold text-yellow-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            確認依頼
            <span className="text-sm font-normal">({onHoldList.length}件)</span>
          </h2>
          <p className="text-sm text-yellow-700 mb-4">
            以下の取引について、使途（何に使ったか）をご記入ください。
          </p>

          <ul className="divide-y divide-yellow-200">
            {onHoldList.map((txn) => (
              <li
                key={txn.id}
                onClick={() => openTransactionDetail(txn.id)}
                className="py-3 flex items-center justify-between cursor-pointer hover:bg-yellow-100 -mx-4 px-4 transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">
                      {txn.vendor_name || '不明な店舗'}
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-200 text-yellow-800">
                      要回答
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
                  <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

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

                  {/* On Hold Reply Form with Message Thread */}
                  {selectedTxn.status === 'on_hold' && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2 text-yellow-800">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">確認依頼</span>
                      </div>

                      {/* Message Thread */}
                      {messages.length > 0 && (
                        <div className="bg-white border border-yellow-300 rounded-md p-3 space-y-3 max-h-48 overflow-y-auto">
                          <p className="text-xs text-gray-500 font-medium">対話履歴:</p>
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.role === 'client' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                  msg.role === 'client'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                <p className="text-xs text-gray-500 mb-1">
                                  {msg.role === 'admin' ? '管理者' : 'あなた'}
                                  <span className="ml-2">
                                    {new Date(msg.created_at).toLocaleString('ja-JP', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </p>
                                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Admin Note Display (fallback for old format) */}
                      {selectedTxn.admin_note && messages.length === 0 && (
                        <div className="bg-white border border-yellow-300 rounded-md p-3">
                          <p className="text-xs text-gray-500 mb-1">管理者からのメッセージ:</p>
                          <p className="text-sm text-gray-800">{selectedTxn.admin_note}</p>
                        </div>
                      )}

                      {/* Current Transaction Details (Admin's edits) */}
                      <div className="bg-white border border-yellow-300 rounded-md p-3">
                        <p className="text-xs text-gray-500 font-medium mb-2">管理者が設定した内容:</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-gray-500">日付:</span>
                            <span className="ml-2 font-medium">{selectedTxn.transaction_date || '未設定'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">金額:</span>
                            <span className="ml-2 font-medium">¥{(selectedTxn.amount || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">店舗名:</span>
                            <span className="ml-2 font-medium">{selectedTxn.vendor_name || '未設定'}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">勘定科目:</span>
                            <span className="ml-2 font-medium text-blue-600">{selectedTxn.account_debit || '未設定'}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">税区分:</span>
                            <span className="ml-2 font-medium">{selectedTxn.tax_category || '未設定'}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-yellow-700">
                        上記内容でよろしければ「確認完了」を、修正が必要な場合は下記に記入して「返信して修正」を押してください。
                      </p>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">店名/取引先 *</label>
                        <input
                          type="text"
                          value={editForm.vendor_name}
                          onChange={(e) => setEditForm({ ...editForm, vendor_name: e.target.value })}
                          placeholder="例: コンビニ、〇〇商店"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">使途・備考 *</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          placeholder="例: 打ち合わせ用のお茶代、事務用品の購入など"
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        />
                      </div>
                    </div>
                  )}

                  {/* Edit Form or View Mode */}
                  {isEditing && selectedTxn.status !== 'on_hold' ? (
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
                  ) : selectedTxn.status !== 'on_hold' && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">ステータス</span>
                        <span className={`px-2 py-1 rounded-full text-sm flex items-center gap-1 ${
                          selectedTxn.status === 'confirmed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {selectedTxn.status === 'confirmed' && (
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                          )}
                          {selectedTxn.status === 'confirmed' ? '確認済 (ロック)' : '要確認'}
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

                      {/* Message History for pending/confirmed transactions */}
                      {messages.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-gray-200">
                          <p className="text-sm font-medium text-gray-700 mb-2">対話履歴</p>
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {messages.map((msg) => (
                              <div
                                key={msg.id}
                                className={`flex ${msg.role === 'client' ? 'justify-end' : 'justify-start'}`}
                              >
                                <div
                                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                    msg.role === 'client'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  <p className="text-xs text-gray-500 mb-1">
                                    {msg.role === 'admin' ? '管理者' : 'あなた'}
                                    <span className="ml-2">
                                      {new Date(msg.created_at).toLocaleString('ja-JP', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </span>
                                  </p>
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-4 border-t border-gray-200">
                  {/* On Hold - Two Choice System */}
                  {selectedTxn.status === 'on_hold' ? (
                    <div className="space-y-2">
                      {/* Choice A: Confirm (Agree) */}
                      <button
                        onClick={handleConfirmApproval}
                        disabled={confirming || replying}
                        className="w-full py-2.5 bg-green-600 text-white rounded-md text-sm disabled:opacity-50 hover:bg-green-700 font-medium"
                      >
                        {confirming ? '処理中...' : '確認完了 (内容に同意)'}
                      </button>
                      {/* Choice B: Reply/Object */}
                      <button
                        onClick={handleReply}
                        disabled={replying || confirming || !editForm.description.trim()}
                        className="w-full py-2.5 border-2 border-yellow-500 text-yellow-700 rounded-md text-sm disabled:opacity-50 hover:bg-yellow-50 font-medium"
                      >
                        {replying ? '送信中...' : '返信して修正'}
                      </button>
                      <p className="text-xs text-gray-500 text-center mt-1">
                        修正する場合は上の使途・備考欄に記入してください
                      </p>
                    </div>
                  ) : isEditing ? (
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
                          <div className="flex items-center gap-2 text-green-600">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm">管理者により確認済み（編集不可）</span>
                          </div>
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
