import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useKeyboardShortcuts, REVIEW_SHORTCUTS } from '../hooks/useKeyboardShortcuts';
import ImagePanel from '../components/review/ImagePanel';
import TransactionForm, { TransactionFormData, TransactionFormRef, SelectedAction } from '../components/review/TransactionForm';
import ConfidenceGroup, { TransactionItem } from '../components/review/ConfidenceGroup';
import ConfirmRevertModal from '../components/ConfirmRevertModal';

interface CompanyInfo {
  id: string;
  name: string;
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
  status: 'pending' | 'confirmed' | 'on_hold';
  image_key: string;
}

interface Message {
  id: string;
  transaction_id: string;
  user_id: string;
  role: 'admin' | 'client';
  message: string;
  created_at: string;
}

export default function ReviewStation() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batchConfirming, setBatchConfirming] = useState(false);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  // Ref for TransactionForm to call confirmWithSave
  const formRef = useRef<TransactionFormRef>(null);

  // Selected action for keyboard navigation
  const [selectedAction, setSelectedAction] = useState<SelectedAction>('none');

  // Load company and transactions
  useEffect(() => {
    if (!companyId) return;
    loadData();
  }, [companyId]);

  async function loadData() {
    try {
      setLoading(true);
      // Load company info
      const companiesRes = await api.get<{ data: CompanyInfo[] }>('/admin/companies');
      const foundCompany = companiesRes.data?.find((c) => c.id === companyId);
      if (foundCompany) {
        setCompany(foundCompany);
      }

      // Load transactions
      const txnRes = await api.get<{ data: TransactionItem[] }>(`/admin/companies/${companyId}/transactions`);
      const txns = txnRes.data || [];
      setTransactions(txns);

      // Auto-select first pending transaction
      const firstPending = txns.find((t) => t.status === 'pending');
      if (firstPending) {
        setSelectedId(firstPending.id);
      } else if (txns.length > 0) {
        setSelectedId(txns[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Load selected transaction detail
  useEffect(() => {
    if (!selectedId) {
      setSelectedTransaction(null);
      return;
    }
    loadTransactionDetail(selectedId);
    setSelectedAction('none'); // Reset selection when changing transaction
  }, [selectedId]);

  async function loadTransactionDetail(id: string) {
    setLoadingDetail(true);
    try {
      const [txnRes, msgRes] = await Promise.all([
        api.get<{ data: TransactionDetail }>(`/transactions/${id}`),
        api.get<{ data: Message[] }>(`/transactions/${id}/messages`),
      ]);
      setSelectedTransaction(txnRes.data);
      setMessages(msgRes.data || []);
    } catch (err) {
      console.error('Failed to load transaction detail:', err);
      setSelectedTransaction(null);
      setMessages([]);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Group transactions by confidence
  const { highConfidence, lowConfidence } = useMemo(() => {
    const high: TransactionItem[] = [];
    const low: TransactionItem[] = [];
    for (const txn of transactions) {
      if ((txn.ai_confidence ?? 0) >= 80) {
        high.push(txn);
      } else {
        low.push(txn);
      }
    }
    return { highConfidence: high, lowConfidence: low };
  }, [transactions]);

  // Progress stats
  const pendingCount = transactions.filter((t) => t.status === 'pending').length;
  const confirmedCount = transactions.filter((t) => t.status === 'confirmed').length;
  const onHoldCount = transactions.filter((t) => t.status === 'on_hold').length;
  const totalCount = transactions.length;

  // Navigation helpers
  function getCurrentIndex(): number {
    if (!selectedId) return -1;
    return transactions.findIndex((t) => t.id === selectedId);
  }

  function goToPrev() {
    const idx = getCurrentIndex();
    if (idx > 0) {
      setSelectedId(transactions[idx - 1].id);
    }
  }

  function goToNext() {
    const idx = getCurrentIndex();
    if (idx < transactions.length - 1) {
      setSelectedId(transactions[idx + 1].id);
    }
  }

  function goToNextPending() {
    const currentIdx = getCurrentIndex();
    // Find next pending after current
    for (let i = currentIdx + 1; i < transactions.length; i++) {
      if (transactions[i].status === 'pending') {
        setSelectedId(transactions[i].id);
        return;
      }
    }
    // Wrap around to start
    for (let i = 0; i < currentIdx; i++) {
      if (transactions[i].status === 'pending') {
        setSelectedId(transactions[i].id);
        return;
      }
    }
    // If no more pending, just go to next
    goToNext();
  }

  // Save handler
  async function handleSave(data: TransactionFormData) {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.put(`/transactions/${selectedId}`, data);
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === selectedId
            ? {
                ...t,
                transaction_date: data.transaction_date,
                amount: data.amount,
                vendor_name: data.vendor_name,
              }
            : t
        )
      );
      // Update selected transaction
      if (selectedTransaction) {
        setSelectedTransaction({
          ...selectedTransaction,
          ...data,
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // Confirm handler
  async function handleConfirm() {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.put(`/transactions/${selectedId}/confirm`, {});
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === selectedId ? { ...t, status: 'confirmed' as const } : t
        )
      );
      if (selectedTransaction) {
        setSelectedTransaction({ ...selectedTransaction, status: 'confirmed' });
      }
      // Move to next pending
      setTimeout(() => goToNextPending(), 100);
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // Batch confirm handler
  async function handleBatchConfirm(ids: string[]) {
    setBatchConfirming(true);
    try {
      await api.put<{ confirmed_count: number }>('/transactions/batch-confirm', { ids });
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          ids.includes(t.id) ? { ...t, status: 'confirmed' as const } : t
        )
      );
      if (selectedTransaction && ids.includes(selectedTransaction.id)) {
        setSelectedTransaction({ ...selectedTransaction, status: 'confirmed' });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '一括確認に失敗しました');
    } finally {
      setBatchConfirming(false);
    }
  }

  // Revert handler (unlock confirmed/on_hold transaction for editing)
  async function handleRevert() {
    if (!selectedId) return;
    setReverting(true);
    try {
      await api.put(`/transactions/${selectedId}/unlock`, {});
      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === selectedId ? { ...t, status: 'pending' as const } : t
        )
      );
      if (selectedTransaction) {
        setSelectedTransaction({ ...selectedTransaction, status: 'pending' });
      }
      setShowRevertModal(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認解除に失敗しました');
    } finally {
      setReverting(false);
    }
  }

  // Show hold modal (for admin to enter note)
  function handleHold() {
    setAdminNote('');
    setShowHoldModal(true);
  }

  // Submit hold with admin note
  async function submitHold() {
    if (!selectedId) return;
    setSaving(true);
    try {
      // Set status to on_hold
      await api.put(`/transactions/${selectedId}`, {
        status: 'on_hold',
      });

      // Send message if provided
      if (adminNote.trim()) {
        await api.post(`/transactions/${selectedId}/messages`, {
          message: adminNote.trim(),
        });
      }

      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === selectedId ? { ...t, status: 'on_hold' as const } : t
        )
      );
      if (selectedTransaction) {
        setSelectedTransaction({ ...selectedTransaction, status: 'on_hold' });
      }
      setShowHoldModal(false);
      setAdminNote('');
      // Move to next pending
      setTimeout(() => goToNextPending(), 100);
    } catch (err) {
      alert(err instanceof Error ? err.message : '確認依頼に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  // Send message to client
  async function sendMessage() {
    if (!selectedId || !newMessage.trim()) return;
    setSendingMessage(true);
    try {
      const res = await api.post<{ data: Message[] }>(`/transactions/${selectedId}/messages`, {
        message: newMessage.trim(),
      });
      setMessages(res.data || []);
      setNewMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'メッセージの送信に失敗しました');
    } finally {
      setSendingMessage(false);
    }
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      ...REVIEW_SHORTCUTS.ESCAPE,
      handler: () => {
        if (selectedAction !== 'none') {
          setSelectedAction('none'); // Cancel selection
        } else {
          navigate('/'); // Go back if nothing selected
        }
      },
    },
    {
      ...REVIEW_SHORTCUTS.PREV,
      handler: goToPrev,
    },
    {
      ...REVIEW_SHORTCUTS.NEXT,
      handler: goToNext,
    },
    {
      ...REVIEW_SHORTCUTS.HOLD,
      handler: () => {
        if (selectedTransaction?.status === 'pending') {
          setSelectedAction('hold');
        }
      },
    },
    {
      ...REVIEW_SHORTCUTS.CONFIRM,
      handler: () => {
        if (selectedTransaction?.status === 'pending') {
          setSelectedAction('confirm');
        }
      },
    },
    {
      ...REVIEW_SHORTCUTS.CONFIRM_NEXT,
      handler: () => {
        if (selectedTransaction?.status === 'pending' && selectedAction !== 'none') {
          if (selectedAction === 'confirm') {
            formRef.current?.confirmWithSave();
          } else if (selectedAction === 'hold') {
            handleHold();
          }
          setSelectedAction('none');
        }
      },
    },
    {
      ...REVIEW_SHORTCUTS.SAVE,
      handler: () => {
        // Trigger save via form - we'll need a ref for this
        // For now, the form handles Ctrl+S internally
      },
    },
  ]);

  // Get image URL
  function getImageUrl(transactionId: string): string {
    const token = localStorage.getItem('token');
    const baseUrl = import.meta.env.PROD
      ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api'
      : '/api';
    return `${baseUrl}/upload/transaction/${transactionId}/image?token=${token}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            戻る
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">{company?.name || '会社'}</h1>
            <p className="text-xs text-gray-500">審核モード</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            <span className="text-green-600 font-medium">{confirmedCount}</span>
            <span className="text-gray-400"> / </span>
            <span className="text-gray-600">{totalCount}</span>
            <span className="text-gray-400 ml-1">件確認済</span>
          </span>
          {pendingCount > 0 && (
            <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">
              {pendingCount}件要確認
            </span>
          )}
          {onHoldCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
              {onHoldCount}件確認待ち
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar - Transaction List (Mobile: Bottom, Desktop: Left) */}
        <div className="order-2 lg:order-1 lg:w-80 bg-white border-t lg:border-t-0 lg:border-r border-gray-200 overflow-auto flex-shrink-0 max-h-[40vh] lg:max-h-none">
          <div className="p-3 space-y-3">
            <ConfidenceGroup
              title="低置信度"
              transactions={lowConfidence}
              isHighConfidence={false}
              selectedId={selectedId}
              batchConfirming={batchConfirming}
              onSelect={setSelectedId}
            />
            <ConfidenceGroup
              title="高置信度"
              transactions={highConfidence}
              isHighConfidence={true}
              selectedId={selectedId}
              batchConfirming={batchConfirming}
              onSelect={setSelectedId}
              onBatchConfirm={handleBatchConfirm}
            />
          </div>
        </div>

        {/* Center - Split View */}
        <div className="order-1 lg:order-2 flex-1 flex flex-col lg:flex-row overflow-hidden">
          {selectedId && selectedTransaction ? (
            <>
              {/* Image Panel */}
              <div className="flex-1 lg:flex-[1.2] p-3 lg:p-4 min-h-[300px] lg:min-h-0">
                <ImagePanel
                  src={getImageUrl(selectedTransaction.id)}
                  alt={selectedTransaction.vendor_name || '領収書'}
                />
              </div>

              {/* Form Panel */}
              <div className="lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-gray-200 flex-shrink-0 overflow-auto max-h-[50vh] lg:max-h-full flex flex-col">
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  </div>
                ) : (
                  <>
                    <TransactionForm
                      ref={formRef}
                      data={{
                        transaction_date: selectedTransaction.transaction_date,
                        amount: selectedTransaction.amount,
                        vendor_name: selectedTransaction.vendor_name,
                        account_debit: selectedTransaction.account_debit,
                        tax_category: selectedTransaction.tax_category,
                      }}
                      aiConfidence={selectedTransaction.ai_confidence}
                      status={selectedTransaction.status}
                      saving={saving}
                      selectedAction={selectedAction}
                      onSave={handleSave}
                      onConfirm={handleConfirm}
                      onRevert={() => setShowRevertModal(true)}
                      onHold={handleHold}
                    />

                    {/* Messages Section */}
                    {messages.length > 0 && (
                      <div className="border-t border-gray-200 p-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          対話履歴
                        </h4>
                        <div className="space-y-2 max-h-40 overflow-auto">
                          {messages.map((msg) => (
                            <div
                              key={msg.id}
                              className={`p-2 rounded-lg text-sm ${
                                msg.role === 'admin'
                                  ? 'bg-blue-50 text-blue-800 ml-4'
                                  : 'bg-green-50 text-green-800 mr-4'
                              }`}
                            >
                              <div className="flex items-center gap-1 text-xs opacity-70 mb-1">
                                <span>{msg.role === 'admin' ? '管理者' : 'お客様'}</span>
                                <span>·</span>
                                <span>{new Date(msg.created_at).toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p>{msg.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Quick Message Input (for on_hold transactions) */}
                    {selectedTransaction.status === 'on_hold' && (
                      <div className="border-t border-gray-200 p-3">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="メッセージを入力..."
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                          />
                          <button
                            onClick={sendMessage}
                            disabled={sendingMessage || !newMessage.trim()}
                            className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm disabled:opacity-50"
                          >
                            {sendingMessage ? '...' : '送信'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p>取引を選択してください</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Single Revert Confirmation Modal */}
      <ConfirmRevertModal
        isOpen={showRevertModal}
        onClose={() => setShowRevertModal(false)}
        onConfirm={handleRevert}
        mode="single"
        processing={reverting}
      />

      {/* Hold Modal - Admin enters note for client */}
      {showHoldModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">確認依頼</h3>
            <p className="text-sm text-gray-600 mb-4">
              この取引を「確認待ち」に設定します。<br />
              お客様へのメッセージを入力してください（任意）。
            </p>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="例: この支出の使途を教えてください"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowHoldModal(false)}
                disabled={saving}
                className="flex-1 py-2 px-4 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                onClick={submitHold}
                disabled={saving}
                className="flex-1 py-2 px-4 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 disabled:opacity-50"
              >
                {saving ? '送信中...' : '確認依頼を送信'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
