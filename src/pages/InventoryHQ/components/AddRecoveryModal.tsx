import React, { useState, useEffect } from 'react';
import { RecoveryService } from '../../../services/recovery';
import { InventoryService } from '../../../services/inventory';
import type { CreateRecoveryItemInput } from '../../../types/recovery';

interface AddRecoveryModalProps {
    toast: any;
    onClose: () => void;
    onSuccess: () => void;
}

const formatCurrency = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);

const AddRecoveryModal: React.FC<AddRecoveryModalProps> = ({ toast, onClose, onSuccess }) => {
    const [form, setForm] = useState<CreateRecoveryItemInput>({
        store_id: '',
        product_id: '',
        quantity: 0,
        unit_price: 0,
        reason: '',
        notes: ''
    });

    const [stores, setStores] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        loadStores();
        loadProducts();
    }, []);

    const loadStores = async () => {
        try {
            const res = await InventoryService.getStores();
            if (res.success && res.stores) setStores(res.stores);
        } catch (error) {
            console.error('[AddRecoveryModal] Load stores error:', error);
        }
    };

    const loadProducts = async () => {
        try {
            const res = await InventoryService.getMasterItems();
            if (res.success && res.items) setProducts(res.items);
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
                unit_price: product.unitPrice || 0
            }));
        } else {
            setForm(prev => ({ ...prev, product_id: '' }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.store_id) { toast.error('Vui lòng chọn cửa hàng'); return; }
        if (!form.product_id) { toast.error('Vui lòng chọn sản phẩm'); return; }
        if (!form.quantity || form.quantity <= 0) { toast.error('Số lượng phải lớn hơn 0'); return; }
        if (!form.unit_price || form.unit_price < 0) { toast.error('Đơn giá không hợp lệ'); return; }
        if (!form.reason) { toast.error('Vui lòng nhập lý do truy thu'); return; }

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
        <>
            <style>{CSS_TEXT}</style>
            <div className="arm-overlay" onClick={onClose}>
                <div className="arm-modal" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="arm-header">
                        <div className="arm-header-left">
                            <div className="arm-header-icon">
                                <span className="material-symbols-outlined" style={{ fontSize: 22, color: '#6366f1' }}>add_box</span>
                            </div>
                            <div>
                                <h2 className="arm-title">Tạo phiếu truy thu</h2>
                                <p className="arm-subtitle">Nhập thông tin sản phẩm cần truy thu</p>
                            </div>
                        </div>
                        <button className="arm-close" onClick={onClose}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="arm-body">
                        {/* Store */}
                        <div className="arm-field">
                            <label className="arm-label">Cửa hàng <span className="arm-required">*</span></label>
                            <select
                                className="arm-select"
                                value={form.store_id}
                                onChange={e => setForm({ ...form, store_id: e.target.value })}
                                required
                            >
                                <option value="">-- Chọn cửa hàng --</option>
                                {stores.map(store => (
                                    <option key={store.id} value={store.id}>{store.name} ({store.code})</option>
                                ))}
                            </select>
                        </div>

                        {/* Product */}
                        <div className="arm-field">
                            <label className="arm-label">Sản phẩm <span className="arm-required">*</span></label>
                            <select
                                className="arm-select"
                                value={form.product_id || ''}
                                onChange={e => handleProductSelect(e.target.value)}
                                required
                            >
                                <option value="">-- Chọn sản phẩm --</option>
                                {products.map(product => (
                                    <option key={product.id} value={product.id}>{product.name} - {product.barcode}</option>
                                ))}
                            </select>
                        </div>

                        {/* Quantity & Unit Price */}
                        <div className="arm-row">
                            <div className="arm-field">
                                <label className="arm-label">Số lượng <span className="arm-required">*</span></label>
                                <input
                                    type="number"
                                    className="arm-input"
                                    value={form.quantity || ''}
                                    onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 0 })}
                                    placeholder="0"
                                    min="1"
                                    required
                                />
                            </div>
                            <div className="arm-field">
                                <label className="arm-label">Đơn giá (VNĐ) <span className="arm-required">*</span></label>
                                <input
                                    type="number"
                                    className="arm-input"
                                    value={form.unit_price || ''}
                                    onChange={e => setForm({ ...form, unit_price: parseFloat(e.target.value) || 0 })}
                                    placeholder="0"
                                    min="0"
                                    step="1000"
                                    required
                                />
                            </div>
                        </div>

                        {/* Total (calculated) */}
                        {form.quantity > 0 && form.unit_price > 0 && (
                            <div className="arm-total-card">
                                <span className="arm-total-label">Tổng tiền:</span>
                                <span className="arm-total-value">{formatCurrency(form.quantity * form.unit_price)}</span>
                            </div>
                        )}

                        {/* Reason */}
                        <div className="arm-field">
                            <label className="arm-label">Lý do truy thu <span className="arm-required">*</span></label>
                            <textarea
                                className="arm-textarea"
                                value={form.reason}
                                onChange={e => setForm({ ...form, reason: e.target.value })}
                                placeholder="Nhập lý do cần truy thu (ví dụ: thiếu hàng, hư hỏng, ...)"
                                rows={3}
                                required
                            />
                        </div>

                        {/* Notes */}
                        <div className="arm-field">
                            <label className="arm-label">Ghi chú thêm</label>
                            <textarea
                                className="arm-textarea"
                                value={form.notes}
                                onChange={e => setForm({ ...form, notes: e.target.value })}
                                placeholder="Nhập ghi chú bổ sung (không bắt buộc)"
                                rows={2}
                            />
                        </div>

                        {/* Actions */}
                        <div className="arm-actions">
                            <button type="button" className="arm-btn-cancel" onClick={onClose} disabled={submitting}>Hủy</button>
                            <button type="submit" className="arm-btn-submit" disabled={submitting}>
                                {submitting ? (
                                    <>
                                        <span className="material-symbols-outlined arm-spin" style={{ fontSize: 18 }}>progress_activity</span>
                                        Đang tạo...
                                    </>
                                ) : (
                                    <>
                                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>
                                        Tạo phiếu
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
};

export default AddRecoveryModal;

/* ══════ CSS ══════ */
const CSS_TEXT = `
/* Overlay */
.arm-overlay {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px;
    animation: armFadeIn 0.2s ease;
}
@keyframes armFadeIn { from { opacity: 0; } to { opacity: 1; } }

/* Modal */
.arm-modal {
    background: #fff; border-radius: 16px;
    width: 100%; max-width: 680px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 25px 60px -12px rgba(0,0,0,0.25);
    animation: armSlideUp 0.25s ease;
}
@keyframes armSlideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

/* Header */
.arm-header {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: space-between;
    padding: 20px 24px;
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
}
.arm-header-left { display: flex; align-items: center; gap: 14px; }
.arm-header-icon {
    width: 48px; height: 48px;
    background: #eef2ff; border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
}
.arm-title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 0; }
.arm-subtitle { font-size: 13px; color: #94a3b8; margin: 2px 0 0; }
.arm-close {
    width: 36px; height: 36px; border-radius: 10px;
    border: 1px solid #e5e7eb; background: #fff;
    display: flex; align-items: center; justify-content: center;
    color: #64748b; cursor: pointer; transition: all 0.15s;
}
.arm-close:hover { background: #f1f5f9; color: #1e293b; }

/* Body */
.arm-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; }

/* Field */
.arm-field { display: flex; flex-direction: column; gap: 6px; }
.arm-label { font-size: 13px; font-weight: 600; color: #475569; }
.arm-required { color: #ef4444; }
.arm-select, .arm-input {
    width: 100%; padding: 10px 14px;
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-weight: 500; color: #334155;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.arm-select:focus, .arm-input:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
.arm-textarea {
    width: 100%; padding: 10px 14px;
    background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px;
    font-size: 13px; font-weight: 500; color: #334155;
    outline: none; transition: border-color 0.2s, box-shadow 0.2s;
    resize: none; font-family: inherit;
}
.arm-textarea:focus { border-color: #818cf8; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }

/* Row */
.arm-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

/* Total Card */
.arm-total-card {
    display: flex; align-items: center; justify-content: space-between;
    background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px;
    padding: 14px 18px;
}
.arm-total-label { font-size: 14px; font-weight: 600; color: #312e81; }
.arm-total-value { font-size: 20px; font-weight: 800; color: #4f46e5; }

/* Actions */
.arm-actions {
    display: flex; align-items: center; justify-content: flex-end;
    gap: 12px; padding-top: 16px; border-top: 1px solid #f1f5f9;
}
.arm-btn-cancel {
    padding: 10px 18px; border: 1.5px solid #e2e8f0; border-radius: 10px;
    background: #fff; font-size: 13px; font-weight: 700; color: #64748b;
    cursor: pointer; transition: all 0.15s;
}
.arm-btn-cancel:hover { border-color: #a5b4fc; color: #4f46e5; background: #eef2ff; }
.arm-btn-cancel:disabled { opacity: 0.5; cursor: not-allowed; }
.arm-btn-submit {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 22px; background: linear-gradient(135deg, #6366f1, #4338ca);
    color: #fff; border: none; border-radius: 10px;
    font-size: 13px; font-weight: 700; cursor: pointer;
    box-shadow: 0 4px 14px -3px rgba(99,102,241,.4);
    transition: transform 0.15s, box-shadow 0.2s;
}
.arm-btn-submit:hover { transform: translateY(-1px); box-shadow: 0 6px 20px -4px rgba(99,102,241,.5); }
.arm-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

/* Spin */
@keyframes armSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
.arm-spin { animation: armSpin 1s linear infinite; }
`;
