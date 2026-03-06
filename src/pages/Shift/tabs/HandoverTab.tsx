import React from 'react';
import { useShiftContext } from '../ShiftContext';

const HandoverTab: React.FC = () => {
    const {
        handoverItems, isCompleted, handleHandoverUpdate, cash
    } = useShiftContext();

    const isLocked = isCompleted && cash?.status !== 'REJECTED';

    return (
        <div className="ho-page">
            {/* ═══ MAIN: Table ═══ */}
            <div className="ho-table-card">
                <div className="ho-table-header">
                    <div className="ho-table-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#8b5cf6' }}>inventory_2</span>
                        <span>Hàng Tồn Giao Ca</span>
                    </div>
                    <span className="ho-count-badge">{handoverItems.length} sản phẩm</span>
                </div>
                {handoverItems.length === 0 ? (
                    <div className="ho-empty">
                        <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>inventory_2</span>
                        <p className="ho-empty-title">Chưa có sản phẩm giao ca</p>
                        <p className="ho-empty-desc">Danh sách sẽ hiển thị khi có sản phẩm cần kiểm đếm khi giao ca</p>
                    </div>
                ) : (
                    <div className="ho-table-scroll">
                        <table className="ho-table">
                            <thead>
                                <tr>
                                    <th style={{ width: 40 }}>#</th>
                                    <th>Sản phẩm</th>
                                    <th style={{ width: 120 }}>Barcode</th>
                                    <th style={{ textAlign: 'center', width: 80 }}>Kiot</th>
                                    <th style={{ textAlign: 'center', width: 80 }}>Thực</th>
                                    <th style={{ textAlign: 'center', width: 60 }}>CL</th>
                                </tr>
                            </thead>
                            <tbody>
                                {handoverItems.map((item, idx) => {
                                    const d = (item.actual_qty || 0) - (item.system_qty || 0);
                                    return (
                                        <tr key={item.id} className={d !== 0 ? (d > 0 ? 'ho-row-plus' : 'ho-row-minus') : ''}>
                                            <td className="ho-td-idx">{idx + 1}</td>
                                            <td className="ho-td-product">{item.product_name}</td>
                                            <td className="ho-td-barcode">{item.barcode || '—'}</td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className="ho-td-input"
                                                    value={item.system_qty || ''}
                                                    onChange={e => handleHandoverUpdate(item, 'system_qty', parseFloat(e.target.value) || 0)}
                                                    inputMode="numeric" disabled={isLocked}
                                                />
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <input type="number" className="ho-td-input"
                                                    value={item.actual_qty ?? ''}
                                                    onChange={e => handleHandoverUpdate(item, 'actual_qty', parseFloat(e.target.value) || 0)}
                                                    inputMode="numeric" disabled={isLocked}
                                                />
                                            </td>
                                            <td className="ho-td-diff" style={{
                                                color: d > 0 ? '#10b981' : d < 0 ? '#ef4444' : '#94a3b8',
                                            }}>
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
