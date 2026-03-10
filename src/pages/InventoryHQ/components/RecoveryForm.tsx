import React, { useState } from 'react';

interface RecoveryFormProps {
    quantity: number;
    onCreateRecovery: (unitPrice: number) => Promise<void>;
    disabled?: boolean;
}

export const RecoveryForm: React.FC<RecoveryFormProps> = ({
    quantity,
    onCreateRecovery,
    disabled
}) => {
    const [unitPrice, setUnitPrice] = useState('');
    const [saving, setSaving] = useState(false);
    const [recoveryDone, setRecoveryDone] = useState(false);

    const handleCreateRecovery = async () => {
        if (!unitPrice || Number(unitPrice) <= 0) return;
        setSaving(true);
        try {
            await onCreateRecovery(Number(unitPrice));
            setRecoveryDone(true);
        } finally {
            setSaving(false);
        }
    };

    if (recoveryDone) {
        return (
            <div className="iap-field iap-field--recovery">
                <label className="iap-label">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>payments</span>
                    Tạo phiếu truy thu
                </label>
                <div className="iap-recovery-done">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#16a34a' }}>check_circle</span>
                    Đã tạo phiếu truy thu
                </div>
            </div>
        );
    }

    return (
        <div className="iap-field iap-field--recovery">
            <label className="iap-label">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>payments</span>
                Tạo phiếu truy thu
            </label>
            <div className="iap-recovery-form">
                <div className="iap-recovery-qty">
                    <span className="iap-qty-label">SL mất:</span>
                    <span className="iap-qty-val">{quantity}</span>
                </div>
                <div className="iap-recovery-price-row">
                    <input
                        type="number"
                        className="iap-price-input"
                        placeholder="Đơn giá (VND)"
                        value={unitPrice}
                        min="0"
                        onChange={e => setUnitPrice(e.target.value)}
                        disabled={disabled || saving}
                    />
                    {unitPrice && Number(unitPrice) > 0 && (
                        <span className="iap-total">
                            = {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(quantity * Number(unitPrice))}
                        </span>
                    )}
                </div>
                <button
                    className="iap-btn-recovery"
                    disabled={!unitPrice || Number(unitPrice) <= 0 || saving || disabled}
                    onClick={handleCreateRecovery}
                >
                    {saving ? (
                        <span className="iap-spinner" />
                    ) : (
                        <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add_card</span>
                    )}
                    Tạo phiếu truy thu
                </button>
            </div>
        </div>
    );
};

export default RecoveryForm;
