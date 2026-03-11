import React, { useState, useEffect } from 'react';
import { useShiftContext } from '../ShiftContext';
import type { ShiftAsset, ShiftAssetCheck } from '../../../types/shift';

const AssetRow = ({ 
    asset, check, idx, isLocked, onUpdate, fmt 
}: { 
    asset: ShiftAsset; 
    check?: ShiftAssetCheck; 
    idx: number; 
    isLocked: boolean; 
    onUpdate: (assetId: string, okCount: number | null, damagedCount: number) => void; 
    fmt: (n: number) => string 
}) => {
    const [okValue, setOkValue] = useState<string>(check?.ok_count != null ? check.ok_count.toString() : '');
    const [damValue, setDamValue] = useState<string>(check?.damaged_count != null ? check.damaged_count.toString() : '');

    useEffect(() => {
        setOkValue(check?.ok_count != null ? check.ok_count.toString() : '');
        setDamValue(check?.damaged_count != null ? check.damaged_count.toString() : '');
    }, [check?.ok_count, check?.damaged_count]);

    const handleBlur = () => {
        const updatedOk = okValue === '' ? null : parseInt(okValue);
        const updatedDam = damValue === '' ? 0 : parseInt(damValue);
        
        if (updatedOk !== check?.ok_count || updatedDam !== (check?.damaged_count || 0)) {
            onUpdate(asset.id, updatedOk, updatedDam);
        }
    };

    const hasDamage = (check?.damaged_count || 0) > 0;
    return (
        <tr className={hasDamage ? 'at-row-damaged' : ''}>
            <td className="at-td-idx">{idx + 1}</td>
            <td className="at-td-product">{asset.name}</td>
            <td className="at-td-value">{fmt(asset.unit_value || 0)}</td>
            <td style={{ textAlign: 'center' }}>
                <span className="at-td-expected">{asset.expected_ok}</span>
            </td>
            <td style={{ textAlign: 'center' }}>
                <input type="number" className="at-td-input"
                    value={okValue}
                    onChange={e => setOkValue(e.target.value)}
                    onBlur={handleBlur}
                    min="0" inputMode="numeric" disabled={isLocked}
                />
            </td>
            <td style={{ textAlign: 'center' }}>
                <input type="number" className={`at-td-input ${hasDamage ? 'damaged' : ''}`}
                    value={damValue}
                    onChange={e => setDamValue(e.target.value)}
                    onBlur={handleBlur}
                    min="0" inputMode="numeric" placeholder="0" disabled={isLocked}
                />
            </td>
        </tr>
    );
};

const AssetsTab: React.FC = () => {
    const { assets, assetChecks, isCompleted, handleAssetCheck, fmt, cash } = useShiftContext();

    const isLocked = isCompleted && cash?.status !== 'REJECTED';


    return (
        <div className="at-page">
            {/* ═══ MAIN: Table ═══ */}
            <div className="at-table-card">
                <div className="at-table-header">
                    <div className="at-table-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#10b981' }}>handyman</span>
                        <span>Vật Tư & Thiết Bị</span>
                    </div>
                    <span className="at-count-badge">{assets.length} vật tư</span>
                </div>
                {assets.length === 0 ? (
                    <div className="at-empty">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>handyman</span>
                        <p className="at-empty-title">Chưa có vật tư</p>
                        <p className="at-empty-desc">Vật tư sẽ hiển thị khi admin cấu hình cho cửa hàng này</p>
                    </div>
                ) : (
                    <div className="at-table-scroll">
                        <table className="at-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th>Vật tư</th>
                                    <th style={{ width: 100 }}>Giá trị</th>
                                    <th style={{ textAlign: 'center', width: 80 }}>Chuẩn</th>
                                    <th style={{ textAlign: 'center', width: 80 }}>Thực</th>
                                    <th style={{ textAlign: 'center', width: 80 }}>Hư</th>
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => {
                                    const check = assetChecks.find(c => c.asset_id === asset.id);
                                    return (
                                        <AssetRow
                                            key={asset.id}
                                            asset={asset}
                                            check={check}
                                            idx={idx}
                                            isLocked={isLocked!}
                                            onUpdate={handleAssetCheck}
                                            fmt={fmt}
                                        />
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssetsTab;
