import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import type { Store } from '../types';

interface MultiStoreSelectProps {
    stores: Store[];
    selectedStoreIds: string[] | null; // null means all
    onChange: (ids: string[] | null) => void;
    disabled?: boolean;
}

export const MultiStoreSelect: React.FC<MultiStoreSelectProps> = ({ stores, selectedStoreIds, onChange, disabled }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, bottom: -1, width: 260 });

    const updatePosition = useCallback(() => {
        if (buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;

            if (spaceBelow < 320 && spaceAbove > spaceBelow) {
                setDropdownPos({
                    top: -1,
                    left: rect.left,
                    bottom: window.innerHeight - rect.top + 4,
                    width: rect.width
                });
            } else {
                setDropdownPos({
                    top: rect.bottom + 4,
                    left: rect.left,
                    bottom: -1,
                    width: rect.width
                });
            }
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        updatePosition();
        const handleScroll = () => updatePosition();
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleScroll);
        };
    }, [open, updatePosition]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                buttonRef.current && !buttonRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const isAllSelected = selectedStoreIds === null;
    const selectedCount = isAllSelected ? stores.length : (selectedStoreIds?.length || 0);
    const label = isAllSelected
        ? 'Tất cả cửa hàng'
        : selectedCount === 0
            ? 'Chọn cửa hàng'
            : `${selectedCount} cửa hàng`;

    const filteredStores = stores.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase())
    );

    const toggleAll = () => {
        if (isAllSelected) {
            onChange([]);
        } else {
            onChange(null);
        }
    };

    const toggleStore = (id: string) => {
        let current = isAllSelected ? stores.map(s => s.id) : [...(selectedStoreIds || [])];
        if (current.includes(id)) {
            current = current.filter(x => x !== id);
        } else {
            current.push(id);
        }

        if (current.length === stores.length) {
            onChange(null);
        } else {
            onChange(current);
        }
    };

    const dropdown = open ? ReactDOM.createPortal(
        <div
            ref={dropdownRef}
            style={{
                position: 'fixed',
                top: dropdownPos.top !== -1 ? dropdownPos.top : 'auto',
                bottom: dropdownPos.bottom !== -1 ? dropdownPos.bottom : 'auto',
                left: dropdownPos.left,
                width: dropdownPos.width,
                maxHeight: 300,
                background: 'var(--stg-bg-element, #fff)',
                border: '1px solid var(--stg-border, #e5e7eb)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 99999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
            }}
        >
            <div style={{ padding: 8, borderBottom: '1px solid var(--stg-border, #e5e7eb)' }}>
                <input
                    type="text"
                    className="stg-input"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm cửa hàng..."
                    style={{ width: '100%', fontSize: 12, padding: '4px 8px' }}
                    autoFocus
                />
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    borderBottom: '1px solid var(--stg-bg-base, #f5f5f5)'
                }}>
                    <input
                        type="checkbox"
                        checked={isAllSelected}
                        onChange={toggleAll}
                    />
                    Tất cả cửa hàng
                </label>

                {filteredStores.map(s => {
                    const isChecked = isAllSelected || (selectedStoreIds?.includes(s.id) ?? false);
                    return (
                        <label key={s.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 12px',
                            cursor: 'pointer',
                            fontSize: 12
                        }}>
                            <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleStore(s.id)}
                            />
                            <span>{s.code} - {s.name}</span>
                        </label>
                    );
                })}

                {filteredStores.length === 0 && (
                    <div style={{ padding: '12px', textAlign: 'center', color: 'var(--stg-text-muted, #999)', fontSize: 12 }}>
                        Không tìm thấy
                    </div>
                )}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div style={{ position: 'relative', minWidth: 140 }}>
            <button
                ref={buttonRef}
                type="button"
                className="stg-input stg-input-mono"
                style={{
                    width: '100%',
                    padding: '4px 8px',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: open ? 'var(--stg-bg-base, #fafafa)' : undefined,
                    borderColor: open ? 'var(--stg-accent, #f59e0b)' : undefined
                }}
                onClick={() => {
                    if (!disabled) {
                        setOpen(!open);
                        if (!open) setSearch('');
                    }
                }}
                disabled={disabled}
            >
                <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {label}
                </span>
                <span className="material-symbols-outlined" style={{ fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
            </button>

            {dropdown}
        </div>
    );
};
