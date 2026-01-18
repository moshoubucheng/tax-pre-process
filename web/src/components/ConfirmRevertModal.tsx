import { useState, useEffect, useRef } from 'react';

interface ConfirmRevertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: 'single' | 'batch';
  companyName?: string;
  count?: number;
  processing?: boolean;
}

export default function ConfirmRevertModal({
  isOpen,
  onClose,
  onConfirm,
  mode,
  companyName = '',
  count = 1,
  processing = false,
}: ConfirmRevertModalProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Required confirmation text
  const requiredText = mode === 'single' ? '確認解除' : `${companyName}確認解除`;

  // Hint text
  const hintText =
    mode === 'single'
      ? '確認を解除するには「確認解除」と入力してください。'
      : `一括解除するには「${companyName}確認解除」と入力してください。`;

  // Is input valid
  const isValid = inputValue === requiredText;

  // Reset input when modal opens
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle key events
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && isValid && !processing) {
      onConfirm();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <svg
              className={`w-6 h-6 ${mode === 'batch' ? 'text-red-600' : 'text-orange-600'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className={`text-lg font-semibold ${mode === 'batch' ? 'text-red-800' : 'text-gray-900'}`}>
              {mode === 'single' ? '確認解除' : `一括確認解除 (${count}件)`}
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Warning message */}
          <div className={`p-3 rounded-lg ${mode === 'batch' ? 'bg-red-50 text-red-800' : 'bg-orange-50 text-orange-800'}`}>
            <p className="text-sm">
              {mode === 'single'
                ? 'この取引の確認を解除し、要確認状態に戻します。'
                : `${count}件の取引の確認を解除し、要確認状態に戻します。この操作は慎重に行ってください。`}
            </p>
          </div>

          {/* Hint text */}
          <p className="text-sm text-gray-600">{hintText}</p>

          {/* Input field */}
          <div>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={processing}
              placeholder={requiredText}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                inputValue.length > 0
                  ? isValid
                    ? 'border-green-500 focus:ring-green-500'
                    : 'border-red-300 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-primary-500'
              }`}
              autoComplete="off"
              spellCheck={false}
            />
            {inputValue.length > 0 && !isValid && (
              <p className="mt-1 text-xs text-red-600">
                入力が一致しません
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={!isValid || processing}
            className={`px-4 py-2 text-sm text-white rounded-md disabled:opacity-50 ${
              mode === 'batch'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-orange-600 hover:bg-orange-700'
            }`}
          >
            {processing ? '処理中...' : '確認解除'}
          </button>
        </div>
      </div>
    </div>
  );
}
