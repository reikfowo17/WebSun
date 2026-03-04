import React from 'react';
import { useShiftContext } from '../ShiftContext';

const AssetsTab: React.FC = () => {
    const { assets, assetChecks, isCompleted, handleAssetCheck, fmt } = useShiftContext();

    return (
        <div className="sp-tab-body">
            <div className="sp-card">
                <div className="sp-card-head">
                    <div className="sp-card-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#10b981' }}>handyman</span>
                        Vật Tư & Thiết Bị
                    </div>
                    <span className="sp-count-badge">{assets.length} vật tư</span>
                </div>
                <div className="sp-table-wrap">
                    <table className="sp-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Vật tư</th>
                                <th>Giá trị</th>
                                <th style={{ textAlign: 'center' }}>Chuẩn</th>
                                <th style={{ textAlign: 'center' }}>Thực</th>
                                <th style={{ textAlign: 'center' }}>Hư</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.map((asset, idx) => {
                                const check = assetChecks.find(c => c.asset_id === asset.id);
                                return (
                                    <tr key={asset.id}>
                                        <td>{idx + 1}</td>
                                        <td className="sp-td-product">{asset.name}</td>
                                        <td className="sp-td-barcode">{fmt(asset.unit_value || 0)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="number" className="sp-td-input" value={check?.ok_count ?? asset.expected_ok} onChange={e => handleAssetCheck(asset.id, parseInt(e.target.value) || 0, check?.damaged_count || 0)} min="0" inputMode="numeric" disabled={isCompleted} />
                                        </td>
                                        <td style={{ textAlign: 'center', fontWeight: 700 }}>{check?.ok_count ?? asset.expected_ok}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <input type="number" className="sp-td-input"
                                                style={{ borderColor: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined, color: (check?.damaged_count || 0) > 0 ? '#ef4444' : undefined }}
                                                value={check?.damaged_count || ''} onChange={e => handleAssetCheck(asset.id, check?.ok_count ?? asset.expected_ok, parseInt(e.target.value) || 0)} min="0" inputMode="numeric" placeholder="0" disabled={isCompleted}
                                            />
                                        </td>
                                    </tr>
                                );
                            })}
                            {assets.length === 0 && <tr><td colSpan={6} className="sp-table-empty">Chưa có vật tư</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AssetsTab;
