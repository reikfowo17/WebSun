import React, { useState, useEffect } from 'react';
import { RecoveryService } from '../../../services/recovery';
import { InventoryService } from '../../../services/inventory';
import type { CreateRecoveryItemInput } from '../../../types/recovery';

interface AddRecoveryModalProps {
    toast: any;
    onClose: () => void;
    onSuccess: () => void;
}

const AddRecoveryModal: React.FC<AddRecoveryModalProps> = ({ toast, onClose, onSuccess }) => {
    const [form, setForm] = useState<CreateRecoveryItemInput>({
        store_id: '',
        product_name: '',
        barcode: '',
        quantity: 0,
        unit_price: 0,
        reason: '',
        notes: ''
    });

    const [stores, setStores] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadStores();
        loadProducts();
    }, []);

    const loadStores = async () => {
        try {
            const res = await InventoryService.getStores();
            if (res.success && res.stores) {
                setStores(res.stores);
            }
        } catch (error) {
            console.error('[AddRecoveryModal] Load stores error:', error);
        }
    };

    const loadProducts = async () => {
        try {
            const res = await InventoryService.getMasterItems();
            if (res.success && res.items) {
                setProducts(res.items);
            }
        } catch (error) {
            console.error('[AddRecoveryModal] Load products error:', error);
        }
    };

    const handleProductSelect = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setForm(prev => ({
                ...prev,
                product_id: product.id,
                product_name: product.name,
                barcode: product.barcode || '',
                unit_price: product.unitPrice || 0
            }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!form.store_id) {
            toast.error('Vui lòng chọn cửa hàng');
            return;
        }
        if (!form.product_name) {
            toast.error('Vui lòng nhập tên sản phẩm');
            return;
        }
        if (!form.quantity || form.quantity <= 0) {
            toast.error('Số lượng phải lớn hơn 0');
            return;
        }
        if (!form.unit_price || form.unit_price < 0) {
            toast.error('Đơn giá không hợp lệ');
            return;
        }
        if (!form.reason) {
            toast.error('Vui lòng nhập lý do truy thu');
            return;
        }

        setSubmitting(true);
        try {
            const result = await RecoveryService.createRecoveryItem(form);

            if (result.success) {
                onSuccess();
            } else {
                toast.error(result.error || 'Không thể tạo phiếu truy thu');
            }
        } catch (error: any) {
            console.error('[AddRecoveryModal] Submit error:', error);
            toast.error('Lỗi hệ thống: ' + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <span className="material-symbols-outlined text-indigo-600 text-2xl">add_box</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Tạo phiếu truy thu</h2>
                            <p className="text-sm text-gray-500">Nhập thông tin sản phẩm cần truy thu</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-gray-500">close</span>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Store Selection */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Cửa hàng <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={form.store_id}
                            onChange={(e) => setForm({ ...form, store_id: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        >
                            <option value="">-- Chọn cửa hàng --</option>
                            {stores.map(store => (
                                <option key={store.id} value={store.id}>
                                    {store.name} ({store.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Product Selection (Optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Chọn sản phẩm có sẵn (không bắt buộc)
                        </label>
                        <select
                            onChange={(e) => handleProductSelect(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        >
                            <option value="">-- Hoặc nhập thủ công bên dưới --</option>
                            {products.map(product => (
                                <option key={product.id} value={product.id}>
                                    {product.name} - {product.barcode}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Product Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Tên sản phẩm <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.product_name}
                            onChange={(e) => setForm({ ...form, product_name: e.target.value })}
                            placeholder="Nhập tên sản phẩm"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            required
                        />
                    </div>

                    {/* Barcode */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mã vạch
                        </label>
                        <input
                            type="text"
                            value={form.barcode}
                            onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                            placeholder="Nhập mã vạch (nếu có)"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                    </div>

                    {/* Quantity & Unit Price */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Số lượng <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.quantity || ''}
                                onChange={(e) => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                                placeholder="0"
                                min="1"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Đơn giá (VNĐ) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.unit_price || ''}
                                onChange={(e) => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                                min="0"
                                step="1000"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                required
                            />
                        </div>
                    </div>

                    {/* Total Amount (calculated) */}
                    {form.quantity > 0 && form.unit_price > 0 && (
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-indigo-900">Tổng tiền:</span>
                                <span className="text-lg font-bold text-indigo-600">
                                    {new Intl.NumberFormat('vi-VN', {
                                        style: 'currency',
                                        currency: 'VND'
                                    }).format(form.quantity * form.unit_price)}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lý do truy thu <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={form.reason}
                            onChange={(e) => setForm({ ...form, reason: e.target.value })}
                            placeholder="Nhập lý do cần truy thu (ví dụ: thiếu hàng, hư hỏng, ...)"
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                            required
                        />
                    </div>

                    {/* Notes (optional) */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ghi chú thêm
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={(e) => setForm({ ...form, notes: e.target.value })}
                            placeholder="Nhập ghi chú bổ sung (không bắt buộc)"
                            rows={2}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                        >
                            {submitting ? (
                                <>
                                    <span className="material-symbols-outlined animate-spin text-xl">progress_activity</span>
                                    <span>Đang tạo...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-xl">check</span>
                                    <span>Tạo phiếu</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddRecoveryModal;
