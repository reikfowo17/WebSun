import React from 'react';

interface ProductFormData {
    barcode: string;
    name: string;
    unit: string;
    category: string;
}

interface ProductModalProps {
    isOpen: boolean;
    isEditing: boolean;
    productForm: ProductFormData;
    processing: string | null;
    onClose: () => void;
    onSave: () => void;
    onFormChange: (updates: Partial<ProductFormData>) => void;
}

const UNIT_OPTIONS = ['Cái', 'Hộp', 'Lon', 'Chai', 'Kg', 'Gói'];

const ProductModal: React.FC<ProductModalProps> = ({
    isOpen,
    isEditing,
    productForm,
    processing,
    onClose,
    onSave,
    onFormChange
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-black text-slate-800">
                        {isEditing ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Barcode / Mã vạch *</label>
                        <input
                            type="text"
                            value={productForm.barcode}
                            onChange={(e) => onFormChange({ barcode: e.target.value })}
                            placeholder="8934567890123"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1.5">Tên sản phẩm *</label>
                        <input
                            type="text"
                            value={productForm.name}
                            onChange={(e) => onFormChange({ name: e.target.value })}
                            placeholder="Bánh mì sữa tươi"
                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">Đơn vị tính</label>
                            <select
                                value={productForm.unit}
                                onChange={(e) => onFormChange({ unit: e.target.value })}
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                            >
                                <option value="">Chọn...</option>
                                {UNIT_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">Mã hàng</label>
                            <input
                                type="text"
                                value={productForm.category}
                                onChange={(e) => onFormChange({ category: e.target.value })}
                                placeholder="SP001"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none"
                            />
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 px-4 bg-white text-gray-600 font-bold text-sm rounded-xl border border-gray-200 hover:bg-gray-50"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={onSave}
                        disabled={!!processing}
                        className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {processing === 'SAVE_PRODUCT' ? (
                            <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                        ) : (
                            <span className="material-symbols-outlined text-sm">save</span>
                        )}
                        Lưu
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
