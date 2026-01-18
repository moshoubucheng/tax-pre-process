import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface Company {
  id: string;
  name: string;
  pending_count: number;
  confirmed_count: number;
}

interface Transaction {
  id: string;
  type?: 'expense' | 'income';
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  account_credit: string | null;
  tax_category: string | null;
  tax_rate: number | null;
  ai_confidence: number | null;
  status: 'pending' | 'confirmed' | 'on_hold';
  image_key: string;
  created_at: string;
}

export default function AdminReceipts() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected company
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Selected transaction
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

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

  async function selectCompany(company: Company) {
    setSelectedCompany(company);
    setLoadingTxns(true);
    setSelectedTxn(null);
    try {
      const res = await api.get<{ data: Transaction[] }>(`/admin/companies/${company.id}/transactions`);
      setTransactions(res.data || []);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTxns(false);
    }
  }

  function closeCompanyDetail() {
    setSelectedCompany(null);
    setTransactions([]);
    setSelectedTxn(null);
  }

  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  async function handleConfirm(txnId: string) {
    setConfirming(true);
    try {
      await api.put(`/transactions/${txnId}/confirm`, {});
      // Update local state
      setTransactions(transactions.map(t =>
        t.id === txnId ? { ...t, status: 'confirmed' } : t
      ));
      if (selectedTxn?.id === txnId) {
        setSelectedTxn({ ...selectedTxn, status: 'confirmed' });
      }
      // Update company counts
      if (selectedCompany) {
        setSelectedCompany({
          ...selectedCompany,
          pending_count: selectedCompany.pending_count - 1,
          confirmed_count: selectedCompany.confirmed_count + 1,
        });
        setCompanies(companies.map(c =>
          c.id === selectedCompany.id
            ? { ...c, pending_count: c.pending_count - 1, confirmed_count: c.confirmed_count + 1 }
            : c
        ));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setConfirming(false);
    }
  }

  async function handleUnlock(txnId: string) {
    setUnlocking(true);
    try {
      await api.put(`/transactions/${txnId}/unlock`, {});
      // Update local state
      setTransactions(transactions.map(t =>
        t.id === txnId ? { ...t, status: 'pending' } : t
      ));
      if (selectedTxn?.id === txnId) {
        setSelectedTxn({ ...selectedTxn, status: 'pending' });
      }
      // Update company counts
      if (selectedCompany) {
        setSelectedCompany({
          ...selectedCompany,
          pending_count: selectedCompany.pending_count + 1,
          confirmed_count: selectedCompany.confirmed_count - 1,
        });
        setCompanies(companies.map(c =>
          c.id === selectedCompany.id
            ? { ...c, pending_count: c.pending_count + 1, confirmed_count: c.confirmed_count - 1 }
            : c
        ));
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '解除に失敗しました');
    } finally {
      setUnlocking(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Transaction detail view
  if (selectedTxn) {
    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedTxn(null)}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 戻る
          </button>
          <h1 className="text-xl font-bold text-gray-900">領収書詳細</h1>
          <span className={`text-sm px-2 py-1 rounded ${
            selectedTxn.status === 'confirmed'
              ? 'bg-green-100 text-green-700'
              : 'bg-orange-100 text-orange-700'
          }`}>
            {selectedTxn.status === 'confirmed' ? '確認済' : '要確認'}
          </span>
        </div>

        {/* Receipt Image */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <img
            src={getImageUrl(selectedTxn.id)}
            alt="領収書"
            className="w-full h-auto max-h-96 object-contain bg-gray-100"
          />
        </div>

        {/* Transaction Info */}
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">店舗名</span>
            <span className="font-medium">{selectedTxn.vendor_name || '不明'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">日付</span>
            <span className="font-medium">{selectedTxn.transaction_date || '不明'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">金額</span>
            <span className="font-medium text-lg">¥{(selectedTxn.amount || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">勘定科目（借方）</span>
            <span className="font-medium">{selectedTxn.account_debit || '未設定'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">勘定科目（貸方）</span>
            <span className="font-medium">{selectedTxn.account_credit || '未設定'}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-gray-500">税区分</span>
            <span className="font-medium">{selectedTxn.tax_category || '未設定'}</span>
          </div>
          {selectedTxn.ai_confidence !== null && (
            <div className="flex justify-between py-2 border-b border-gray-100">
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

        {/* Actions */}
        <div className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4">
          <div className="max-w-7xl mx-auto flex gap-2">
            {selectedTxn.status === 'pending' ? (
              <button
                onClick={() => handleConfirm(selectedTxn.id)}
                disabled={confirming}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {confirming ? '処理中...' : '確認する'}
              </button>
            ) : (
              <button
                onClick={() => handleUnlock(selectedTxn.id)}
                disabled={unlocking}
                className="flex-1 py-3 bg-orange-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {unlocking ? '処理中...' : '編集を許可'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Company transactions view
  if (selectedCompany) {
    return (
      <div className="space-y-6 pb-24">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={closeCompanyDetail}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 戻る
            </button>
            <h1 className="text-xl font-bold text-gray-900">{selectedCompany.name}</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-green-600">確認済: {selectedCompany.confirmed_count}</span>
            <span className="text-orange-600">要確認: {selectedCompany.pending_count}</span>
          </div>
        </div>

        {loadingTxns ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            領収書がまだアップロードされていません
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((txn) => (
              <button
                key={txn.id}
                onClick={() => setSelectedTxn(txn)}
                className="w-full bg-white rounded-lg shadow-sm p-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{txn.vendor_name || '不明'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        txn.status === 'confirmed'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {txn.status === 'confirmed' ? '確認済' : '要確認'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span>{txn.transaction_date || '日付不明'}</span>
                      <span className="mx-2">·</span>
                      <span>{txn.account_debit || '未分類'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">¥{(txn.amount || 0).toLocaleString()}</span>
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Company list view
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">領収書管理</h1>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {companies.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            顧問先がまだ登録されていません
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {companies.map((company) => (
              <button
                key={company.id}
                onClick={() => selectCompany(company)}
                className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 text-left"
              >
                <span className="font-medium text-gray-900">{company.name}</span>
                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <span className="text-green-600 mr-3">確認済: {company.confirmed_count}</span>
                    <span className="text-orange-600">要確認: {company.pending_count}</span>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
