import React from 'react';

interface AdminNoteFieldProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export const AdminNoteField: React.FC<AdminNoteFieldProps> = ({
    value,
    onChange,
    disabled
}) => {
    return (
        <div className="iap-field">
            <label className="iap-label">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>edit_note</span>
                Ghi chú admin
            </label>
            <textarea
                className="iap-note"
                placeholder="Ghi chú thêm..."
                rows={2}
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled}
            />
        </div>
    );
};

export default AdminNoteField;
