import React from 'react';

interface DeleteConfirmProps {
    isOpen: boolean;
    productName: string;
    processing: string | null;
    onConfirm: () => void;
    onCancel: () => void;
}

const DeleteConfirm: React.FC<DeleteConfirmProps> = ({
    isOpen,
    productName,
    processing,
    onConfirm,
    onCancel
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="p-6 text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-symbols-outlined text-2xl text-red-600">delete_forever</span>
                    </div>
                    <h3 className="text-lg font-black text-slate-800 mb-2">Xác nhận xóa</h3>
                    <p className="text-sm text-gray-500">
                        Bạn có chắc muốn xóa <strong className="text-gray-700">{productName}</strong>?
                    </p>
                </div>
                <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-2.5 px-4 bg-white text-gray-600 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={!!processing}
                        className="flex-1 py-2.5 px-4 bg-red-600 text-white font-bold text-sm rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {processing?.startsWith('DELETE_') ? (
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">delete</span>
                        )}
                        Xóa
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirm;
