import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { ACCOUNT_DEBIT_OPTIONS, TAX_CATEGORY_OPTIONS } from '../../constants/accounts';

export interface TransactionFormData {
  transaction_date: string | null;
  amount: number | null;
  vendor_name: string | null;
  account_debit: string | null;
  tax_category: string | null;
  invoice_number: string | null;
}

export interface TransactionFormRef {
  confirmWithSave: () => void;
  holdAction: () => void;
}

export type SelectedAction = 'none' | 'hold' | 'confirm';

interface TransactionFormProps {
  data: TransactionFormData;
  aiConfidence: number | null;
  lowConfidenceFields?: string[];
  status: 'pending' | 'confirmed' | 'on_hold';
  saving: boolean;
  selectedAction?: SelectedAction;
  onSave: (data: TransactionFormData) => void;
  onConfirm: () => void;
  onRevert?: () => void;
  onHold?: () => void;
}

const TransactionForm = forwardRef<TransactionFormRef, TransactionFormProps>(({
  data,
  aiConfidence,
  lowConfidenceFields = [],
  status,
  saving,
  selectedAction = 'none',
  onSave,
  onConfirm,
  onRevert,
  onHold,
}, ref) => {
  const [formData, setFormData] = useState<TransactionFormData>(data);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset form when data changes (e.g., when navigating to different transaction)
  useEffect(() => {
    setFormData(data);
    setHasChanges(false);
  }, [data]);

  function handleChange(field: keyof TransactionFormData, value: string | number | null) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  }

  function handleConfirmWithSave() {
    if (hasChanges) {
      onSave(formData);
      setHasChanges(false);
    }
    onConfirm();
  }

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    confirmWithSave: handleConfirmWithSave,
    holdAction: () => onHold?.(),
  }));

  function isLowConfidence(field: string): boolean {
    // If overall confidence is low, mark all AI-filled fields
    if (aiConfidence !== null && aiConfidence < 80) {
      return true;
    }
    return lowConfidenceFields.includes(field);
  }

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 ${
      isLowConfidence(field)
        ? 'border-orange-300 bg-orange-50'
        : 'border-gray-300'
    }`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Status Badge */}
        <div className="flex items-center justify-between">
          <span className={`px-2 py-1 rounded-full text-sm ${
            status === 'confirmed'
              ? 'bg-green-100 text-green-700'
              : status === 'on_hold'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-orange-100 text-orange-700'
          }`}>
            {status === 'confirmed' ? '確認済' : status === 'on_hold' ? '確認待ち' : '要確認'}
          </span>
          {aiConfidence !== null && (
            <span className={`text-sm ${
              aiConfidence >= 80 ? 'text-green-600' :
              aiConfidence >= 60 ? 'text-orange-600' : 'text-red-600'
            }`}>
              AI信頼度: {aiConfidence}%
            </span>
          )}
        </div>

        {/* Date Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            日付
            {isLowConfidence('transaction_date') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <input
            type="date"
            value={formData.transaction_date || ''}
            onChange={(e) => handleChange('transaction_date', e.target.value || null)}
            className={fieldClass('transaction_date')}
          />
        </div>

        {/* Amount Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            金額
            {isLowConfidence('amount') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">¥</span>
            <input
              type="number"
              value={formData.amount ?? ''}
              onChange={(e) => handleChange('amount', e.target.value ? Number(e.target.value) : null)}
              className={`${fieldClass('amount')} pl-7`}
              placeholder="0"
            />
          </div>
        </div>

        {/* Vendor Name Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            店舗名
            {isLowConfidence('vendor_name') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <input
            type="text"
            value={formData.vendor_name || ''}
            onChange={(e) => handleChange('vendor_name', e.target.value || null)}
            className={fieldClass('vendor_name')}
            placeholder="例: セブンイレブン"
          />
        </div>

        {/* Account Debit Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            勘定科目
            {isLowConfidence('account_debit') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <select
            value={formData.account_debit || ''}
            onChange={(e) => handleChange('account_debit', e.target.value || null)}
            className={fieldClass('account_debit')}
          >
            <option value="">選択してください</option>
            {ACCOUNT_DEBIT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Tax Category Field */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            税区分
            {isLowConfidence('tax_category') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <select
            value={formData.tax_category || ''}
            onChange={(e) => handleChange('tax_category', e.target.value || null)}
            className={fieldClass('tax_category')}
          >
            <option value="">選択してください</option>
            {TAX_CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* Invoice Number Field (インボイス番号) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            インボイス番号
            {isLowConfidence('invoice_number') && (
              <span className="ml-1 text-orange-500">*</span>
            )}
          </label>
          <input
            type="text"
            value={formData.invoice_number || ''}
            onChange={(e) => handleChange('invoice_number', e.target.value || null)}
            className={fieldClass('invoice_number')}
            placeholder="例: T1234567890123"
          />
          {!formData.invoice_number && (
            <p className="text-xs text-orange-600 mt-1">
              ※ T番号なしの場合、仕入税額控除が制限されます
            </p>
          )}
        </div>

        {/* Low confidence hint */}
        {aiConfidence !== null && aiConfidence < 80 && (
          <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
            * AI信頼度が低いため、入力内容をご確認ください
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="p-4 border-t border-gray-200 space-y-2">
        <div className="flex gap-2">
          {/* Pending: 確認依頼 (left) + 確認 (right) */}
          {status === 'pending' && onHold && (
            <button
              onClick={onHold}
              disabled={saving}
              className={`flex-1 py-2 px-4 text-white rounded-md disabled:opacity-50 text-sm transition-all ${
                selectedAction === 'hold'
                  ? 'bg-yellow-600 ring-2 ring-yellow-400 ring-offset-1'
                  : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              確認依頼 (←)
            </button>
          )}
          {status === 'pending' && (
            <button
              onClick={handleConfirmWithSave}
              disabled={saving}
              className={`flex-1 py-2 px-4 text-white rounded-md disabled:opacity-50 text-sm transition-all ${
                selectedAction === 'confirm'
                  ? 'bg-green-700 ring-2 ring-green-400 ring-offset-1'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              確認 (→)
            </button>
          )}
          {status === 'confirmed' && onRevert && (
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-md disabled:opacity-50 hover:bg-orange-700 text-sm"
            >
              編集を許可
            </button>
          )}
          {status === 'on_hold' && onRevert && (
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-md disabled:opacity-50 hover:bg-blue-700 text-sm"
            >
              要確認に戻す
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500 text-center">
          ↑↓ 前後の取引、←/→ 選択、Enter 実行、Esc 取消
        </div>
      </div>
    </div>
  );
});

export default TransactionForm;
