import React from 'react';

export interface ShiftToggleProps {
    shifts: string[];
    selected: string[] | null;
    onChange: (selected: string[] | null) => void;
    disabled?: boolean;
}

export const ShiftPillToggle: React.FC<ShiftToggleProps> = ({ shifts, selected, onChange, disabled }) => {
    const isAll = selected === null;

    const toggle = (st: string) => {
        if (disabled) return;
        let current = isAll ? [...shifts] : [...(selected || [])];
        if (current.includes(st)) {
            current = current.filter(x => x !== st);
        } else {
            current.push(st);
        }
        if (current.length === shifts.length) {
            onChange(null);
        } else {
            onChange(current);
        }
    };

    return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {shifts.map(st => {
                const isActive = isAll || (selected?.includes(st) ?? false);
                return (
                    <button
                        key={st}
                        type="button"
                        onClick={() => toggle(st)}
                        disabled={disabled}
                        style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            border: `1px solid ${isActive ? 'var(--stg-accent, #f59e0b)' : 'var(--stg-border, #e5e7eb)'}`,
                            background: isActive ? 'var(--stg-accent-light, #fef3c7)' : 'transparent',
                            color: isActive ? 'var(--stg-accent-dark, #b45309)' : 'var(--stg-text-muted, #6b7280)',
                            fontSize: 10,
                            fontWeight: isActive ? 600 : 400,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {isActive && <span className="material-symbols-outlined" style={{ fontSize: 10 }}>check</span>}
                        {st === 'MORNING' ? 'Sáng' : st === 'AFTERNOON' ? 'Chiều' : 'Tối'}
                    </button>
                );
            })}
        </div>
    );
};

export interface DayOfWeekToggleProps {
    days: number[];
    labels: Record<number, string>;
    selected: number[] | null;
    onChange: (selected: number[] | null) => void;
    disabled?: boolean;
}

export const DayPillToggle: React.FC<DayOfWeekToggleProps> = ({ days, labels, selected, onChange, disabled }) => {
    const isAll = selected === null;

    const toggle = (d: number) => {
        if (disabled) return;
        let current = isAll ? [...days] : [...(selected || [])];
        if (current.includes(d)) {
            current = current.filter(x => x !== d);
        } else {
            current.push(d);
        }
        if (current.length === days.length) {
            onChange(null); // All selected
        } else {
            onChange(current);
        }
    };

    return (
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {days.map(d => {
                const isActive = isAll || (selected?.includes(d) ?? false);
                return (
                    <button
                        key={d}
                        type="button"
                        onClick={() => toggle(d)}
                        disabled={disabled}
                        style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${isActive ? 'var(--stg-primary, #1e40af)' : 'var(--stg-border, #e5e7eb)'}`,
                            background: isActive ? 'var(--stg-primary-light, #dbeafe)' : 'transparent',
                            color: isActive ? 'var(--stg-primary-dark, #1e3a8a)' : 'var(--stg-text-muted, #6b7280)',
                            fontSize: 10,
                            fontWeight: isActive ? 600 : 400,
                            cursor: disabled ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        {labels[d]}
                    </button>
                );
            })}
        </div>
    );
};
