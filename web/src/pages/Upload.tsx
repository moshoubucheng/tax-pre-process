import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { compressImageIfNeeded } from '../lib/imageUtils';
import {
  TransactionType,
  getAccountDebitOptions,
  getTaxCategoryOptions,
  TAX_RATE_OPTIONS,
} from '../constants/accounts';

interface AIResult {
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  account_credit: string | null;
  tax_category: string | null;
  tax_rate: number | null;
  invoice_number: string | null;
  confidence: number;
}

interface UploadResponse {
  transaction_id: string;
  type: TransactionType;
  ai_result: AIResult;
}

type InputMode = 'ai' | 'manual';

export default function Upload() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>('ai');
  const [transactionType, setTransactionType] = useState<TransactionType>('expense');
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
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
    tax_rate: 10,
    invoice_number: '',
  });

  // Get options based on transaction type
  const accountOptions = getAccountDebitOptions(transactionType);
  const taxCategoryOptions = getTaxCategoryOptions(transactionType);

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
      // Compress image if larger than 5MB
      let processedFile = file;
      console.log('Original file:', file.name, 'size:', (file.size / 1024 / 1024).toFixed(2) + 'MB', 'type:', file.type);

      if (file.size > 5 * 1024 * 1024) {
        console.log('File exceeds 5MB, starting compression...');
        setCompressing(true);
        processedFile = await compressImageIfNeeded(file);
        setCompressing(false);
        console.log('After compression:', processedFile.name, 'size:', (processedFile.size / 1024 / 1024).toFixed(2) + 'MB');
      }

      // Create FormData and include type
      const uploadFormData = new FormData();
      uploadFormData.append('file', processedFile);
      uploadFormData.append('type', transactionType);

      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api' : '/api');

      const response = await fetch(`${baseUrl}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'アップロードに失敗しました');
      }

      const res: UploadResponse = await response.json();
      setTransactionId(res.transaction_id);
      setAiResult(res.ai_result);

      // Pre-fill form with AI results
      const defaultTaxCategory = transactionType === 'income' ? '課税売上10%' : '課対仕入内10%';
      setFormData({
        transaction_date: res.ai_result.transaction_date || '',
        amount: res.ai_result.amount?.toString() || '',
        vendor_name: res.ai_result.vendor_name || '',
        account_debit: res.ai_result.account_debit || '',
        tax_category: res.ai_result.tax_category || defaultTaxCategory,
        tax_rate: res.ai_result.tax_rate || 10,
        invoice_number: res.ai_result.invoice_number || '',
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
    const defaultTaxCategory = transactionType === 'income' ? '課税売上10%' : '課対仕入内10%';
    setFormData({
      transaction_date: '',
      amount: '',
      vendor_name: '',
      account_debit: '',
      tax_category: defaultTaxCategory,
      tax_rate: 10,
      invoice_number: '',
    });
  }

  function handleTypeChange(newType: TransactionType) {
    setTransactionType(newType);
    // Update default values based on type
    const defaultTaxCategory = newType === 'income' ? '課税売上10%' : '課対仕入内10%';
    setFormData({
      ...formData,
      account_debit: '',
      tax_category: defaultTaxCategory,
    });
  }

  async function handleManualSave() {
    if (!file) {
      alert('画像ファイルは必須です');
      return;
    }
    if (!formData.transaction_date || !formData.amount) {
      alert('日付と金額は必須です');
      return;
    }

    setSaving(true);
    try {
      // Compress image if larger than 5MB
      let processedFile = file;
      if (file.size > 5 * 1024 * 1024) {
        setCompressing(true);
        processedFile = await compressImageIfNeeded(file);
        setCompressing(false);
      }

      const submitFormData = new FormData();
      submitFormData.append('file', processedFile);
      submitFormData.append('type', transactionType);
      submitFormData.append('transaction_date', formData.transaction_date);
      submitFormData.append('amount', formData.amount);
      submitFormData.append('vendor_name', formData.vendor_name);
      submitFormData.append('account_debit', formData.account_debit);
      submitFormData.append('tax_category', formData.tax_category);
      submitFormData.append('tax_rate', formData.tax_rate.toString());
      submitFormData.append('invoice_number', formData.invoice_number);

      const token = localStorage.getItem('token');
      const baseUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://tax-api.759nxrb6x4-bc3.workers.dev/api' : '/api');

      const res = await fetch(`${baseUrl}/upload/manual`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: submitFormData,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || '保存に失敗しました');
      }

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
      <h1 className="text-xl font-bold text-gray-900">
        {transactionType === 'income' ? '売上登録' : '経費登録'}
      </h1>

      {/* Transaction Type Toggle */}
      {!aiResult && (
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => handleTypeChange('expense')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              transactionType === 'expense'
                ? 'bg-white text-red-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="text-lg">▲</span>
            経費 (支出)
          </button>
          <button
            onClick={() => handleTypeChange('income')}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1 ${
              transactionType === 'income'
                ? 'bg-white text-green-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span className="text-lg">+</span>
            売上 (収入)
          </button>
        </div>
      )}

      {/* Input Mode Tabs */}
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
                  className={`flex-1 py-2 text-white rounded-md disabled:opacity-50 ${
                    transactionType === 'income' ? 'bg-green-600' : 'bg-primary-600'
                  }`}
                >
                  {compressing ? '画像圧縮中...' : uploading ? 'AI解析中...' : 'アップロード'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`w-full py-12 border-2 border-dashed rounded-lg hover:border-primary-500 transition-colors ${
                transactionType === 'income' ? 'border-green-300' : 'border-gray-300'
              }`}
            >
              <div className="text-center">
                <svg
                  className={`mx-auto h-12 w-12 ${transactionType === 'income' ? 'text-green-400' : 'text-gray-400'}`}
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
                  {transactionType === 'income'
                    ? 'タップして請求書を撮影'
                    : 'タップして領収書を撮影'}
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

          {/* Image Upload for Manual Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {transactionType === 'income' ? '請求書画像' : '領収書画像'} <span className="text-red-500">*</span>
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />
            {preview ? (
              <div className="space-y-2">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full rounded-lg object-contain max-h-48 bg-gray-100"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 border border-gray-300 rounded-md text-gray-700 text-sm"
                >
                  画像を変更
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-500 transition-colors"
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-8 w-8 text-gray-400"
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
                  <p className="mt-1 text-sm text-gray-600">
                    タップして写真を撮影
                  </p>
                </div>
              </button>
            )}
          </div>

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
                {transactionType === 'income' ? '取引先名' : '店名/取引先'}
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
                {accountOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  税率
                </label>
                <select
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {TAX_RATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                  {taxCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {transactionType === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  インボイス番号
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="例: T1234567890123"
                />
                <p className="text-xs text-gray-500 mt-1">
                  ※ T番号なしの場合、仕入税額控除が制限されます
                </p>
              </div>
            )}
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
              className={`flex-1 py-2 text-white rounded-md disabled:opacity-50 ${
                transactionType === 'income' ? 'bg-green-600' : 'bg-primary-600'
              }`}
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
            <div className="flex items-center gap-2">
              <span className={`text-sm px-2 py-1 rounded-full ${
                transactionType === 'income'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {transactionType === 'income' ? '売上' : '経費'}
              </span>
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
                {transactionType === 'income' ? '取引先名' : '店名/取引先'}
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
                {accountOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  税率
                </label>
                <select
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {TAX_RATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
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
                  {taxCategoryOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {transactionType === 'expense' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  インボイス番号
                  {isLowConfidence('invoice_number') && (
                    <span className="ml-2 text-red-500 text-xs">要確認</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${
                    isLowConfidence('invoice_number')
                      ? 'border-red-300 bg-red-50'
                      : formData.invoice_number
                      ? 'border-green-300 bg-green-50'
                      : 'border-orange-300 bg-orange-50'
                  }`}
                  placeholder="例: T1234567890123"
                />
                {!formData.invoice_number && (
                  <p className="text-xs text-orange-600 mt-1">
                    ※ T番号なしの場合、仕入税額控除が制限されます
                  </p>
                )}
              </div>
            )}
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
              className={`flex-1 py-2 text-white rounded-md ${
                transactionType === 'income' ? 'bg-green-600' : 'bg-primary-600'
              }`}
            >
              確定して保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
