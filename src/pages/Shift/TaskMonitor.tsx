import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import type { User, Store } from '../../types';
import type { Shift, ShiftType, ChecklistResponse } from '../../types/shift';
import { SHIFT_ICONS, SHIFT_COLORS, CHECKLIST_LABELS } from '../../types/shift';
import { ShiftService, ChecklistService, HandoverService, AssetService } from '../../services/shift';
import { supabase } from '../../lib/supabase';

interface TaskMonitorProps {
    user: User;
    toast: ToastContextType;
}

interface ShiftProgress {
    shift: Shift;
    responses: ChecklistResponse[];
    handoverCount: number;
    assetCheckCount: number;
}

export const TaskMonitor: React.FC<TaskMonitorProps> = ({ user, toast }) => {
    const [shifts, setShifts] = useState<Shift[]>([]);
    const [stores, setStores] = useState<Store[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [shiftDetails, setShiftDetails] = useState<Map<string, ShiftProgress>>(new Map());
    const [expandedShift, setExpandedShift] = useState<string | null>(null);

    useEffect(() => {
        const loadStores = async () => {
            const { data } = await supabase.from('stores').select('id, code, name').eq('is_active', true).order('sort_order');
            setStores((data as Store[]) || []);
        };
        loadStores();
    }, []);

    useEffect(() => {
        const loadShifts = async () => {
            setLoading(true);
            try {
                const data = await ShiftService.listShifts({
                    storeId: selectedStore !== 'all' ? selectedStore : undefined,
                    startDate: selectedDate,
                    endDate: selectedDate,
                    limit: 50,
                });
                setShifts(data);

                // Load checklist progress for each shift
                const details = new Map<string, ShiftProgress>();
                await Promise.all(data.map(async (shift) => {
                    try {
                        const [responses, handover, assetChecks] = await Promise.all([
                            ChecklistService.getResponses(shift.id),
                            HandoverService.getItems(shift.id),
                            AssetService.getChecks(shift.id),
                        ]);
                        details.set(shift.id, {
                            shift,
                            responses,
                            handoverCount: handover.length,
                            assetCheckCount: assetChecks.length,
                        });
                    } catch (err) {
                        console.error('[TaskMonitor] Detail load error:', err);
                    }
                }));
                setShiftDetails(details);
            } catch (err) {
                console.error('[TaskMonitor] Load error:', err);
            } finally {
                setLoading(false);
            }
        };
        loadShifts();
    }, [selectedStore, selectedDate]);

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '--:--';
        return new Date(dateStr).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    };

    const getShiftLabel = (type: ShiftType) =>
        type === 'MORNING' ? 'Ca Sáng' : type === 'AFTERNOON' ? 'Ca Chiều' : 'Ca Tối';

    return (
        <div className="stg-section-animate">
            {/* Filters */}
            <div className="stg-toolbar" style={{ marginBottom: '1rem' }}>
                <div className="stg-toolbar-left" style={{ gap: '0.75rem', display: 'flex', alignItems: 'center' }}>
                    <select className="stg-input" style={{ width: 200 }} value={selectedStore} onChange={e => setSelectedStore(e.target.value)}>
                        <option value="all">Tất cả cửa hàng</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <input type="date" className="stg-input" style={{ width: 160 }} value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                </div>
                <div className="stg-toolbar-right">
                    <span className="stg-badge">{shifts.length} ca</span>
                </div>
            </div>

            {/* Shift Cards */}
            {loading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--stg-text-muted)' }}>
                    <div style={{ width: 32, height: 32, borderWidth: 3, borderStyle: 'solid', borderColor: '#f59e0b', borderTopColor: 'transparent', borderRadius: 999, margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }} />
                    Đang tải tiến độ nhiệm vụ...
                </div>
            ) : shifts.length === 0 ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--stg-text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3, display: 'block', marginBottom: 8 }}>event_busy</span>
                    Không có ca nào trong ngày đã chọn
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {shifts.map(shift => {
                        const detail = shiftDetails.get(shift.id);
                        const isExpanded = expandedShift === shift.id;
                        const total = detail?.responses.length || 0;
                        const completed = detail?.responses.filter(r => r.is_completed).length || 0;
                        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

                        // Group responses by category
                        const grouped: Record<string, ChecklistResponse[]> = {};
                        if (detail) {
                            for (const r of detail.responses) {
                                const cat = r.template?.category || 'START_SHIFT';
                                if (cat === 'NOTE') continue;
                                if (!grouped[cat]) grouped[cat] = [];
                                grouped[cat].push(r);
                            }
                        }

                        return (
                            <div key={shift.id} className="card" style={{ overflow: 'hidden' }}>
                                {/* Summary row */}
                                <div
                                    style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}
                                    onClick={() => setExpandedShift(isExpanded ? null : shift.id)}
                                >
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: SHIFT_COLORS[shift.shift_type] + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 18, color: SHIFT_COLORS[shift.shift_type] }}>
                                            {SHIFT_ICONS[shift.shift_type]}
                                        </span>
                                    </div>

                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>
                                                {getShiftLabel(shift.shift_type)}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                {shift.store?.name} • {shift.started_by_user?.name}
                                            </span>
                                            <span className={`badge ${shift.status === 'COMPLETED' ? 'badge-success' : shift.status === 'LOCKED' ? 'badge-info' : 'badge-warning'}`} style={{ fontSize: '0.625rem', marginLeft: 4 }}>
                                                {shift.status === 'COMPLETED' ? 'Xong' : shift.status === 'LOCKED' ? 'Khóa' : 'Mở'}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
                                            {formatTime(shift.started_at)} → {formatTime(shift.ended_at)} • {detail?.handoverCount || 0} SP kiểm tồn • {detail?.assetCheckCount || 0} vật tư
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div style={{ width: 120, textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: pct === 100 ? '#10b981' : '#f59e0b', marginBottom: 4 }}>
                                            {completed}/{total} ({pct}%)
                                        </div>
                                        <div style={{ height: 4, borderRadius: 2, background: '#f3f4f6', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: pct === 100 ? '#10b981' : '#f59e0b', transition: 'width 0.3s ease' }} />
                                        </div>
                                    </div>

                                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#9ca3af', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : undefined }}>
                                        expand_more
                                    </span>
                                </div>

                                {/* Expanded detail */}
                                {isExpanded && detail && (
                                    <div style={{ borderTop: '1px solid #f3f4f6', padding: '0.75rem 1rem', background: '#fafbfc' }}>
                                        {Object.entries(grouped).map(([cat, items]) => (
                                            <div key={cat} style={{ marginBottom: '0.75rem' }}>
                                                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                                    {CHECKLIST_LABELS[cat as keyof typeof CHECKLIST_LABELS] || cat}
                                                    <span style={{ fontWeight: 400, marginLeft: 4 }}>
                                                        ({items.filter(i => i.is_completed).length}/{items.length})
                                                    </span>
                                                </div>
                                                {items.map(r => (
                                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.25rem 0', fontSize: '0.8125rem' }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 16, color: r.is_completed ? '#10b981' : '#d1d5db' }}>
                                                            {r.is_completed ? 'check_circle' : 'radio_button_unchecked'}
                                                        </span>
                                                        <span style={{ color: r.is_completed ? '#6b7280' : '#111827', textDecoration: r.is_completed ? 'line-through' : 'none' }}>
                                                            {r.template?.title || ''}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ))}

                                        {Object.keys(grouped).length === 0 && (
                                            <div style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center', padding: '1rem' }}>
                                                Không có nhiệm vụ checklist nào
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
