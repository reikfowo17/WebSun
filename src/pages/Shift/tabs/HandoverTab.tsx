import React from 'react';
import { useShiftContext } from '../ShiftContext';

const HandoverTab: React.FC = () => {
    const { handoverItems, isCompleted, handleHandoverUpdate } = useShiftContext();

    return (
        <div className="sp-tab-body">
            <div className="sp-card">
                <div className="sp-card-head">
                    <div className="sp-card-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#8b5cf6' }}>inventory_2</span>
                        Hàng Tồn Giao Ca
                    </div>
                    <span className="sp-count-badge">{handoverItems.length} sản phẩm</span>
                </div>
                {handoverItems.length === 0 ? (
                    <div className="sp-empty-state">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>inventory_2</span>
                        <p className="sp-empty-title">Chưa có sản phẩm giao ca</p>
                        <p className="sp-empty-desc">Danh sách sẽ hiển thị khi có sản phẩm cần kiểm đếm khi giao ca</p>
                    </div>
                ) : (
                    <div className="sp-table-wrap">
                        <table className="sp-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Sản phẩm</th>
                                    <th>Barcode</th>
                                    <th style={{ textAlign: 'center' }}>Kiot</th>
                                    <th style={{ textAlign: 'center' }}>Thực</th>
                                    <th style={{ textAlign: 'center' }}>CL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {handoverItems.map((item, idx) => {
                                    const d = (item.actual_qty || 0) - (item.system_qty || 0);
                                    return (
                                        <tr key={item.id}>
                                            <td>{idx + 1}</td>
                                            <td className="sp-td-product">{item.product_name}</td>
                                            <td className="sp-td-barcode">{item.barcode || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className="sp-td-input" value={item.system_qty || ''} onChange={e => handleHandoverUpdate(item, 'system_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className="sp-td-input" value={item.actual_qty || ''} onChange={e => handleHandoverUpdate(item, 'actual_qty', parseFloat(e.target.value) || 0)} inputMode="numeric" disabled={isCompleted} />
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: 700, color: d > 0 ? '#10b981' : d < 0 ? '#ef4444' : '#6b7280', fontSize: '0.8125rem' }}>
                                                {d !== 0 ? (d > 0 ? '+' : '') + d : '—'}
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

export default HandoverTab;
