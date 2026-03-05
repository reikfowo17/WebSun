import React from 'react';
import { useShiftContext } from '../ShiftContext';
import {
    CHECKLIST_LABELS, CHECKLIST_ICONS,
} from '../../../types/shift';

const TasksTab: React.FC = () => {
    const {
        checkProgress, noteItems, groupedChecklist, handleToggleChecklist,
        isCompleted,
    } = useShiftContext();

    const hasChecklist = Object.keys(groupedChecklist).length > 0;
    const categories = Object.entries(groupedChecklist);

    return (
        <div className="tk-page">
            {/* ═══ TOP: Stats + Notes Row ═══ */}
            <div className="tk-top-row">
                {/* Progress card */}
                <div className="tk-progress-card">
                    <div className="tk-ring-wrap">
                        <svg viewBox="0 0 64 64" width="56" height="56">
                            <circle cx="32" cy="32" r="27" fill="none" stroke="#f3f4f6" strokeWidth="5" />
                            <circle cx="32" cy="32" r="27" fill="none"
                                stroke={checkProgress.pct === 100 ? '#10b981' : '#f59e0b'}
                                strokeWidth="5" strokeLinecap="round"
                                strokeDasharray={`${(checkProgress.pct / 100) * 169.6} 169.6`}
                                transform="rotate(-90 32 32)" style={{ transition: 'stroke-dasharray 0.4s ease' }}
                            />
                        </svg>
                        <span className="tk-ring-pct">{checkProgress.pct}%</span>
                    </div>
                    <div className="tk-progress-info">
                        <span className="tk-progress-count">{checkProgress.completed}/{checkProgress.total}</span>
                        <span className="tk-progress-label">công việc hoàn thành</span>
                    </div>
                </div>

                {/* Notes */}
                {noteItems.length > 0 && (
                    <div className="tk-notes-card">
                        <div className="tk-notes-header">
                            <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#d97706' }}>warning</span>
                            <span className="tk-notes-title">Lưu Ý Quan Trọng</span>
                        </div>
                        <div className="tk-notes-list">
                            {noteItems.map(note => (
                                <div key={note.id} className="tk-note-item">• {note.title}</div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ MAIN: Checklist Grid ═══ */}
            {!hasChecklist ? (
                <div className="tk-empty">
                    <span className="material-symbols-outlined" style={{ fontSize: 48, color: '#d1d5db' }}>checklist</span>
                    <p className="tk-empty-title">Không có nhiệm vụ</p>
                    <p className="tk-empty-desc">Chưa có checklist được cấu hình cho ca này</p>
                </div>
            ) : (
                <div className="tk-grid">
                    {categories.map(([category, items]) => (
                        <div key={category} className="tk-group">
                            <div className="tk-group-header">
                                <span className="material-symbols-outlined" style={{ fontSize: 15, color: '#94a3b8' }}>
                                    {CHECKLIST_ICONS[category as keyof typeof CHECKLIST_ICONS] || 'list'}
                                </span>
                                <span className="tk-group-label">
                                    {CHECKLIST_LABELS[category as keyof typeof CHECKLIST_LABELS] || category}
                                </span>
                                <span className="tk-group-count">
                                    {items.filter(i => i.is_completed).length}/{items.length}
                                </span>
                            </div>
                            <div className="tk-group-items">
                                {items.map(response => (
                                    <div key={response.id}
                                        className={`tk-check-item ${response.is_completed ? 'done' : ''}`}
                                        onClick={() => !isCompleted && handleToggleChecklist(response)}
                                        style={{ cursor: isCompleted ? 'default' : 'pointer' }}
                                    >
                                        <div className={`tk-checkbox ${response.is_completed ? 'checked' : ''}`}>
                                            {response.is_completed && <span className="material-symbols-outlined">check</span>}
                                        </div>
                                        <span className="tk-check-text">{response.template?.title || ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TasksTab;
