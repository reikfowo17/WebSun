import React from 'react';
import { useShiftContext } from '../ShiftContext';
import {
    CHECKLIST_LABELS, CHECKLIST_ICONS,
} from '../../../types/shift';
import { QuickReportService } from '../../../services/shift';

const TasksTab: React.FC = () => {
    const {
        checkProgress, noteItems, groupedChecklist, handleToggleChecklist,
        quickReports, shift, user, isCompleted, setQuickReports,
    } = useShiftContext();

    if (!shift) return null;

    return (
        <div className="sp-tab-body">
            <div className="sp-tasks-layout">
                {/* LEFT — Summary + Quick reports */}
                <div className="sp-tasks-left">
                    {/* Progress */}
                    <div className="sp-card">
                        <div className="sp-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: checkProgress.pct === 100 ? '#10b981' : '#f59e0b' }}>task_alt</span>
                            Tiến Độ Công Việc
                        </div>
                        <div className="sp-progress-visual">
                            <div className="sp-progress-ring">
                                <svg viewBox="0 0 80 80" width="80" height="80">
                                    <circle cx="40" cy="40" r="34" fill="none" stroke="#f3f4f6" strokeWidth="6" />
                                    <circle cx="40" cy="40" r="34" fill="none"
                                        stroke={checkProgress.pct === 100 ? '#10b981' : '#f59e0b'}
                                        strokeWidth="6" strokeLinecap="round"
                                        strokeDasharray={`${(checkProgress.pct / 100) * 213.6} 213.6`}
                                        transform="rotate(-90 40 40)" style={{ transition: 'stroke-dasharray 0.4s ease' }}
                                    />
                                </svg>
                                <span className="sp-progress-pct">{checkProgress.pct}%</span>
                            </div>
                            <div className="sp-progress-detail">
                                <span className="sp-progress-count">{checkProgress.completed}/{checkProgress.total}</span>
                                <span className="sp-progress-label">công việc hoàn thành</span>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {noteItems.length > 0 && (
                        <div className="sp-notice">
                            <div className="sp-notice-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>warning</span>
                                Lưu Ý Quan Trọng
                            </div>
                            {noteItems.map(note => (
                                <div key={note.id} className="sp-notice-item">• {note.title}</div>
                            ))}
                        </div>
                    )}

                    {/* Quick Reports */}
                    <div className="sp-card">
                        <div className="sp-card-title">
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#f59e0b' }}>bolt</span>
                            Báo Cáo Nhanh Đầu Ca
                        </div>
                        <div className="sp-quick-grid">
                            {['Trứng gà', 'Gạo', 'Bánh mì tươi', 'Covang', 'Biwase 20L', 'Thức ăn nhanh'].map(name => {
                                const report = quickReports.find(r => r.item_name === name);
                                return (
                                    <div key={name} className="sp-quick-item">
                                        <span className="sp-quick-name">{name}</span>
                                        <input
                                            type="number" className="sp-quick-input" value={report?.quantity || ''}
                                            onChange={async e => {
                                                const qty = parseFloat(e.target.value) || 0;
                                                try {
                                                    const saved = await QuickReportService.upsert({
                                                        ...(report || {}),
                                                        shift_id: shift.id, item_name: name, quantity: qty, checked_by: user.id,
                                                    });
                                                    setQuickReports(prev => {
                                                        const idx = prev.findIndex(r => r.item_name === name);
                                                        if (idx >= 0) { const arr = [...prev]; arr[idx] = saved; return arr; }
                                                        return [...prev, saved];
                                                    });
                                                } catch (err) { console.error(err); }
                                            }}
                                            placeholder="0" inputMode="numeric" disabled={isCompleted}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT — Checklist groups */}
                <div className="sp-tasks-right">
                    {Object.keys(groupedChecklist).length === 0 ? (
                        <div className="sp-card sp-empty-state">
                            <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>checklist</span>
                            <p className="sp-empty-title">Không có nhiệm vụ</p>
                            <p className="sp-empty-desc">Chưa có checklist được cấu hình cho ca này</p>
                        </div>
                    ) : (
                        Object.entries(groupedChecklist).map(([category, items]) => (
                            <div key={category} className="sp-card" style={{ padding: 0, overflow: 'hidden' }}>
                                <div className="sp-group-header">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9ca3af' }}>
                                        {CHECKLIST_ICONS[category as keyof typeof CHECKLIST_ICONS] || 'list'}
                                    </span>
                                    <span className="sp-group-label">{CHECKLIST_LABELS[category as keyof typeof CHECKLIST_LABELS] || category}</span>
                                    <span className="sp-group-count">{items.filter(i => i.is_completed).length}/{items.length}</span>
                                </div>
                                {items.map(response => (
                                    <div key={response.id} className={`sp-check-item ${response.is_completed ? 'done' : ''}`} onClick={() => handleToggleChecklist(response)}>
                                        <div className={`sp-checkbox ${response.is_completed ? 'checked' : ''}`}>
                                            {response.is_completed && <span className="material-symbols-outlined">check</span>}
                                        </div>
                                        <span className="sp-check-text">{response.template?.title || ''}</span>
                                    </div>
                                ))}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default TasksTab;
