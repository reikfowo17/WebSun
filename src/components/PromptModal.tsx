import React, { useState } from "react";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  title,
  message,
  placeholder = "Nhập nội dung...",
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState("");

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (value.trim()) {
      onConfirm(value.trim());
      setValue("");
    }
  };

  const handleCancel = () => {
    setValue("");
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-[500px] shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-xl font-black text-gray-800">{title}</h3>
          {message && <p className="text-sm text-gray-500 mt-1">{message}</p>}
        </div>

        {/* Input */}
        <div className="p-6">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none transition-colors resize-none font-medium"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey) {
                handleConfirm();
              }
            }}
          />
          <p className="text-xs text-gray-400 mt-2">
            💡 Tip: Press Ctrl+Enter để xác nhận nhanh
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button
            onClick={handleCancel}
            className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptModal;
