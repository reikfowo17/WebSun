import React from 'react';

interface RecheckDateFieldProps {
    value: string;
    onChange: (date: string) => void;
    completedAt?: string | null;
    disabled?: boolean;
}

export const RecheckDateField: React.FC<RecheckDateFieldProps> = ({
    value,
    onChange,
    completedAt,
    disabled
}) => {
    return (
        <div className="iap-field iap-field--recheck">
            <label className="iap-label">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>event</span>
                Ngày kiểm tra lại
            </label>
            <input
                type="date"
                className="iap-date-input"
                value={value}
                min={new Date().toISOString().split('T')[0]}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            />
            {completedAt && (
                <span className="iap-recheck-done">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check_circle</span>
                    Đã kiểm {new Date(completedAt).toLocaleDateString('vi-VN')}
                </span>
            )}
        </div>
    );
};

export default RecheckDateField;
