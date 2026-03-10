import React from 'react';
import {
    RESOLUTION_CONFIG,
    type DiscrepancyResolution,
} from '../../../services/inventory';

const RESOLUTION_ORDER: DiscrepancyResolution[] = [
    'PENDING',
    'LOST_GOODS',
    'MISPLACED',
    'STOCK_ADJUSTMENT',
    'INPUT_ERROR',
    'RETURN_GOODS',
    'RESOLVED_INTERNAL',
];

interface ResolutionSelectProps {
    value: DiscrepancyResolution;
    onChange: (value: DiscrepancyResolution) => void;
    disabled?: boolean;
}

export const ResolutionSelect: React.FC<ResolutionSelectProps> = ({ 
    value, 
    onChange, 
    disabled 
}) => {
    return (
        <div className="iap-field">
            <label className="iap-label">
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>category</span>
                Phân loại xử lý
            </label>
            <div className="iap-select-wrap">
                <select
                    className="iap-select"
                    style={{
                        borderColor: RESOLUTION_CONFIG[value].color + '60',
                        color: RESOLUTION_CONFIG[value].color,
                        background: RESOLUTION_CONFIG[value].bg,
                    }}
                    value={value}
                    onChange={e => onChange(e.target.value as DiscrepancyResolution)}
                    disabled={disabled}
                >
                    {RESOLUTION_ORDER.map(r => (
                        <option key={r} value={r}>
                            {RESOLUTION_CONFIG[r].label}
                        </option>
                    ))}
                </select>
                <span className="iap-select-icon material-symbols-outlined">
                    {RESOLUTION_CONFIG[value].icon}
                </span>
            </div>
            <p className="iap-desc">{RESOLUTION_CONFIG[value].description}</p>
        </div>
    );
};

export default ResolutionSelect;
