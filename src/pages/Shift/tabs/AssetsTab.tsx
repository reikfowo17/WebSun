import React from 'react';
import { useShiftContext } from '../ShiftContext';

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
                                    const hasDamage = (check?.damaged_count || 0) > 0;
                                    return (
                                        <tr key={asset.id} className={hasDamage ? 'at-row-damaged' : ''}>
                                            <td className="at-td-idx">{idx + 1}</td>
                                            <td className="at-td-product">{asset.name}</td>
                                            <td className="at-td-value">{fmt(asset.unit_value || 0)}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="at-td-expected">{asset.expected_ok}</span>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className="at-td-input"
                                                    value={check?.ok_count ?? ''}
                                                    onChange={e => handleAssetCheck(asset.id, parseInt(e.target.value) || 0, check?.damaged_count || 0)}
                                                    min="0" inputMode="numeric" disabled={isLocked}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className={`at-td-input ${hasDamage ? 'damaged' : ''}`}
                                                    value={check?.damaged_count || ''}
                                                    onChange={e => handleAssetCheck(asset.id, check?.ok_count ?? asset.expected_ok, parseInt(e.target.value) || 0)}
                                                    min="0" inputMode="numeric" placeholder="0" disabled={isLocked}
                                                />
                                            </td>
                                        </tr>
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
