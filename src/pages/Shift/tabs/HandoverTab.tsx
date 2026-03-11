import React, { useState, useEffect } from 'react';
import { useShiftContext } from '../ShiftContext';
import { HandoverService } from '../../../services/shift/handover';
import { useToast } from '../../../contexts';
import type { ShiftInventoryHandover } from '../../../types/shift';

const HandoverRow = ({ 
    item, idx, isLocked, onUpdate 
}: { 
    item: ShiftInventoryHandover; 
    idx: number; 
    isLocked: boolean; 
    onUpdate: (item: ShiftInventoryHandover, field: 'system_qty' | 'actual_qty', value: number | null) => void 
}) => {
    const [sysQty, setSysQty] = useState<string>(item.system_qty?.toString() || '');
    const [actQty, setActQty] = useState<string>(item.actual_qty?.toString() || '');

    useEffect(() => {
        setSysQty(item.system_qty?.toString() || '');
        setActQty(item.actual_qty?.toString() || '');
    }, [item.system_qty, item.actual_qty]);

    const handleBlurSys = () => {
        const val = sysQty === '' ? null : parseFloat(sysQty);
        if (val !== item.system_qty) onUpdate(item, 'system_qty', val);
    };

    const handleBlurAct = () => {
        const val = actQty === '' ? null : parseFloat(actQty);
        if (val !== item.actual_qty) onUpdate(item, 'actual_qty', val);
    };

    const d = (item.actual_qty || 0) - (item.system_qty || 0);
    return (
        <tr className={d !== 0 ? (d > 0 ? 'ho-row-plus' : 'ho-row-minus') : ''}>
            <td className="ho-td-idx">{idx + 1}</td>
            <td className="ho-td-product">{item.product_name}</td>
            <td className="ho-td-barcode">{item.barcode || '—'}</td>
            <td style={{ textAlign: 'center', fontWeight: '500', color: '#64748b' }}>
                {item.system_qty}
            </td>
            <td style={{ textAlign: 'center' }}>
                <input type="number" className="ho-td-input"
                    value={actQty}
                    onChange={e => setActQty(e.target.value)}
                    onBlur={handleBlurAct}
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
};

const HandoverTab: React.FC = () => {
    const {
        handoverItems, isCompleted, handleHandoverUpdate, reloadHandoverItems, cash, storeId, shift
    } = useShiftContext();
    const toast = useToast();
    const [syncing, setSyncing] = useState(false);

    const isLocked = isCompleted && cash?.status !== 'REJECTED';

    const handleSyncKiot = async () => {
        if (!storeId || !shift) return;
        setSyncing(true);
        const res = await HandoverService.syncKiotVietHandover(storeId, shift.id);
        if (res.success) {
            toast.success(res.message || 'Đồng bộ Kiot thành công');
            await reloadHandoverItems();
            setSyncing(false);
        } else {
            toast.error(res.message || 'Lỗi đồng bộ Kiot');
            setSyncing(false);
        }
    };

    const handlePrint = () => {
        if (handoverItems.length === 0) {
            toast.error("Không có sản phẩm nào để in");
            return;
        }

        const now = new Date();
        const tableRows = handoverItems
            .map((p, i) => {
                const nameStr = p.product_name?.trim() || "";
                const barcodeStr = p.barcode ? String(p.barcode).trim() : "";
                const barcodeLast6 = barcodeStr.length >= 6 ? "....." + barcodeStr.slice(-6) : barcodeStr;

                return `<tr>
                    <td class="stt-col">${i + 1}</td>
                    <td class="name-col">${nameStr}</td>
                    <td class="barcode-col">${barcodeLast6}</td>
                    <td class="thucte-col"></td>
                </tr>`;
            })
            .join("");

        const printCSS = `*{box-sizing:border-box}@media print{body{margin:0;padding:3mm;font-size:9px}.no-print{display:none}@page{size:80mm auto;margin:2mm}}body{font-family:"Segoe UI","Arial Unicode MS","Tahoma","Arial",sans-serif;margin:0;padding:3mm;font-size:9px;width:100%;max-width:80mm;line-height:1.2;color:#000}.header{text-align:center;margin-bottom:1mm;border-bottom:2px solid #000;padding-bottom:0.5mm}.header h2{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;padding:0.5mm 1mm}.info{margin-bottom:2mm;font-size:8px;border-bottom:1px solid #ccc;padding:1mm 2mm}.info p{margin:1px 0;font-weight:500}.product-table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2mm}.product-table th{background:#fff;color:#000;font-weight:900;text-align:center;padding:1mm;border-bottom:1px solid #000;font-size:9px;text-transform:uppercase;white-space:nowrap}.product-table td{padding:1mm;border-bottom:1px solid #ccc;vertical-align:top;font-weight:600;color:#000}.product-table tr:nth-child(even){background:#f8f8f8}.stt-col{width:10%;text-align:center;font-weight:900;font-size:10px}.name-col{width:50%;text-align:left;padding-left:2mm;word-wrap:break-word;line-height:1.4;font-weight:700;font-size:9px}.barcode-col{width:20%;text-align:center;font-weight:800;font-size:10px;color:#333}.thucte-col{width:20%;text-align:center;font-weight:800;font-size:10px}.footer{margin-top:2mm;text-align:center;font-size:7px;border-top:1px solid #ccc;padding:1mm}.footer p{margin:1px 0}`;
        const html = `<!DOCTYPE html><html><head><title>Phiếu Kiểm Tồn Giao Ca</title><meta charset="UTF-8"><style>${printCSS}</style></head><body>
            <div class="header"><h2>PHIẾU TỒN GIAO CA</h2></div>
            <div class="info"><p><strong>Cửa hàng:</strong> ${storeId || ''} | <strong>Tổng SP:</strong> ${handoverItems.length}</p></div>
            <table class="product-table">
                <thead><tr><th class="stt-col">STT</th><th class="name-col">TÊN SẢN PHẨM</th><th class="barcode-col">BARCODE</th><th class="thucte-col">THỰC TẾ</th></tr></thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div class="footer"><p>In lúc: ${now.toLocaleString("vi-VN")}</p></div>
        </body></html>`;

        const existingFrame = document.getElementById("printFrame") as HTMLIFrameElement;
        if (existingFrame) existingFrame.remove();

        const iframe = document.createElement("iframe");
        iframe.id = "printFrame";
        iframe.style.cssText = "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
        document.body.appendChild(iframe);

        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.print();
            }, 300);
        }
    };

    return (
        <div className="ho-page">
            {/* ═══ MAIN: Table ═══ */}
            <div className="ho-table-card">
                <div className="ho-table-header">
                    <div className="ho-table-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#8b5cf6' }}>inventory_2</span>
                        <span>Hàng Tồn Giao Ca</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="ho-count-badge">{handoverItems.length} sản phẩm</span>
                        <button 
                            className="ho-action-btn" 
                            onClick={handleSyncKiot} 
                            disabled={isLocked || syncing}
                            title="Đồng bộ số lượng tồn từ KiotViet"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{syncing ? 'sync' : 'cloud_download'}</span>
                            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Kiot'}
                        </button>
                        <button 
                            className="print-btn" 
                            onClick={handlePrint}
                            title="In phiếu kiểm đếm tồn giao ca"
                            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', background: '#f3f4f6', color: '#4b5563', borderRadius: '6px', border: '1px solid #e5e7eb', cursor: 'pointer', fontWeight: 600, fontSize: '0.8125rem' }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>print</span>
                            In mẫu kiểm
                        </button>
                    </div>
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
                                {handoverItems.map((item, idx) => (
                                    <HandoverRow 
                                        key={item.id} 
                                        item={item} 
                                        idx={idx} 
                                        isLocked={isLocked!} 
                                        onUpdate={handleHandoverUpdate} 
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

        </div>
    );
};

export default HandoverTab;
