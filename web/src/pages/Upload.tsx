import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface AIResult {
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  tax_category: string | null;
  confidence: number;
}

interface UploadResponse {
  transaction_id: string;
  ai_result: AIResult;
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

type InputMode = 'ai' | 'manual';

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>('ai');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    transaction_date: '',
    amount: '',
    vendor_name: '',
    account_debit: '',
    tax_category: '課対仕入内10%',
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    }
  }

  async function handleUpload() {
    if (!file) return;

    setUploading(true);
    try {
      const res = await api.upload<UploadResponse>('/upload', file);
      setTransactionId(res.transaction_id);
      setAiResult(res.ai_result);

      // Pre-fill form with AI results
      setFormData({
        transaction_date: res.ai_result.transaction_date || '',
        amount: res.ai_result.amount?.toString() || '',
        vendor_name: res.ai_result.vendor_name || '',
        account_debit: res.ai_result.account_debit || '',
        tax_category: res.ai_result.tax_category || '課対仕入内10%',
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!transactionId) return;

    try {
      await api.put(`/transactions/${transactionId}`, {
        ...formData,
        amount: parseInt(formData.amount) || 0,
        status: 'confirmed',
      });
      alert('保存しました');
      navigate('/');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    }
  }

  function resetForm() {
    setFile(null);
    setPreview(null);
    setAiResult(null);
    setTransactionId(null);
    setFormData({
      transaction_date: '',
      amount: '',
      vendor_name: '',
      account_debit: '',
      tax_category: '課対仕入内10%',
    });
  }

  async function handleManualSave() {
    if (!formData.transaction_date || !formData.amount) {
      alert('日付と金額は必須です');
      return;
    }

    setSaving(true);
    try {
      await api.post('/upload/manual', {
        ...formData,
        amount: parseInt(formData.amount) || 0,
      });
      alert('保存しました');
      navigate('/');
    } catch (err) {
      alert(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }

  const isLowConfidence = (field: keyof AIResult) => {
    if (!aiResult) return false;
    return aiResult.confidence < 70 && aiResult[field] !== null;
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-xl font-bold text-gray-900">領収書登録</h1>

      {/* Mode Tabs */}
      {!aiResult && (
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => { setMode('ai'); resetForm(); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'ai'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            AI識別
          </button>
          <button
            onClick={() => { setMode('manual'); resetForm(); }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              mode === 'manual'
                ? 'bg-white text-primary-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            手動入力
          </button>
        </div>
      )}

      {/* AI Mode - File Selection */}
      {mode === 'ai' && !aiResult && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {preview ? (
            <div className="space-y-4">
              <img
                src={preview}
                alt="Preview"
                className="w-full rounded-lg object-contain max-h-64"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 border border-gray-300 rounded-md text-gray-700"
                >
                  やり直す
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
                >
                  {uploading ? 'AI解析中...' : 'アップロード'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-12 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors"
            >
              <div className="text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-600">
                  タップして写真を撮影またはファイルを選択
                </p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Manual Mode - Input Form */}
      {mode === 'manual' && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">手動入力</h2>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金額 <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="¥"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                店名/取引先
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                勘定科目
              </label>
              <select
                value={formData.account_debit}
                onChange={(e) => setFormData({ ...formData, account_debit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">選択してください</option>
                {ACCOUNT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                税区分
              </label>
              <select
                value={formData.tax_category}
                onChange={(e) => setFormData({ ...formData, tax_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {TAX_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2 border border-gray-300 rounded-md text-gray-700"
            >
              クリア
            </button>
            <button
              onClick={handleManualSave}
              disabled={saving}
              className="flex-1 py-2 bg-primary-600 text-white rounded-md disabled:opacity-50"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      )}

      {/* AI Result Form */}
      {aiResult && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">AI解析結果</h2>
            <span
              className={`text-sm px-2 py-1 rounded-full ${
                aiResult.confidence >= 70
                  ? 'bg-green-100 text-green-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              信頼度: {aiResult.confidence}%
            </span>
          </div>

          {preview && (
            <img
              src={preview}
              alt="Receipt"
              className="w-full rounded-lg object-contain max-h-48"
            />
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                日付
                {isLowConfidence('transaction_date') && (
                  <span className="ml-2 text-red-500 text-xs">要確認</span>
                )}
              </label>
              <input
                type="date"
                value={formData.transaction_date}
                onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  isLowConfidence('transaction_date')
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                金額
                {isLowConfidence('amount') && (
                  <span className="ml-2 text-red-500 text-xs">要確認</span>
                )}
              </label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  isLowConfidence('amount')
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="¥"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                店名/取引先
                {isLowConfidence('vendor_name') && (
                  <span className="ml-2 text-red-500 text-xs">要確認</span>
                )}
              </label>
              <input
                type="text"
                value={formData.vendor_name}
                onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${
                  isLowConfidence('vendor_name')
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                勘定科目
              </label>
              <select
                value={formData.account_debit}
                onChange={(e) => setFormData({ ...formData, account_debit: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="">選択してください</option>
                {ACCOUNT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                税区分
              </label>
              <select
                value={formData.tax_category}
                onChange={(e) => setFormData({ ...formData, tax_category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                {TAX_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={resetForm}
              className="flex-1 py-2 border border-gray-300 rounded-md text-gray-700"
            >
              キャンセル
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-2 bg-primary-600 text-white rounded-md"
            >
              確定して保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
