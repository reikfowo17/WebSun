import React, { useEffect, useState, Suspense } from 'react';
import { createPortal } from 'react-dom';
import type { User } from '../../types';
import type { ShiftType } from '../../types/shift';
import { SHIFT_LABELS, SHIFT_ICONS } from '../../types/shift';
import { ShiftProvider, useShiftContext, TAB_LABELS } from './ShiftContext';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import '../../styles/hq-sidebar.css';

const TasksTab = React.lazy(() => import('./tabs/TasksTab'));
const CashTab = React.lazy(() => import('./tabs/CashTab'));
const HandoverTab = React.lazy(() => import('./tabs/HandoverTab'));
const AssetsTab = React.lazy(() => import('./tabs/AssetsTab'));

const TabLoading = () => (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
        <div style={{ width: 32, height: 32, border: '3px solid #f59e0b', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 1s linear infinite', margin: '0 auto 0.5rem' }} />
        Đang tải...
    </div>
);

const ShiftPageInner: React.FC = () => {
    const {
        shift, selectedType, setSelectedType, loading, starting, ending,
        activeTab, setActiveTab, isCompleted,
        autoSaveStatus, checkProgress, getDenomTotal,
        assets, handoverItems,
        handleStartShift, handleEndShift, fmt, user,
        todayAssignments, assignedShiftIds, shiftConfigs, isAssignedToday, registerSupportShift,
    } = useShiftContext();

    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
        const titleFallback = document.getElementById('topbar-fallback-title');
        if (titleFallback) titleFallback.style.display = 'none';
        return () => { if (titleFallback) titleFallback.style.display = 'flex'; };
    }, []);

    // Map ShiftType to config ID for assignment checking
    const SHIFT_TYPE_TO_CONFIG: Record<ShiftType, number> = {
        MORNING: 1,
        AFTERNOON: 2,
        EVENING: 3,
    };

    // Also check shiftConfigs for a more accurate mapping
    const getConfigIdForType = (type: ShiftType): number => {
        const fallback = SHIFT_TYPE_TO_CONFIG[type];
        if (shiftConfigs.length === 0) return fallback;
        // Try to match by index order of MAIN shifts
        const mainShifts = shiftConfigs.filter(s => (s.type || 'MAIN') === 'MAIN');
        const typeIndex = type === 'MORNING' ? 0 : type === 'AFTERNOON' ? 1 : 2;
        return mainShifts[typeIndex]?.id ?? fallback;
    };

    const isAdminUser = user.role === 'ADMIN';

    // Get support shifts for registration
    const supportShifts = shiftConfigs.filter(s => s.type === 'SUPPORT');

    if (loading) {
        return (
            <div className="hq-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                    <div style={{ width: 48, height: 48, border: '4px solid #f59e0b', borderTopColor: 'transparent', borderRadius: 999, animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Đang tải thông tin ca...</p>
                </div>
            </div>
        );
    }

    if (!shift) {
        return (
            <div className="hq-page">
                {topbarNode && createPortal(
                    <div className="hq-breadcrumb">
                        <span className="material-symbols-outlined hq-breadcrumb-icon">store</span>
                        <span className="hq-breadcrumb-title">Bàn Giao Ca</span>
                    </div>,
                    topbarNode
                )}
                <div className="sp-start-container">
                    <div className="sp-start-card">
                        <div className="sp-start-icon">
                            <span className="material-symbols-outlined material-symbols-fill">store</span>
                        </div>
                        <h2 className="sp-start-title">Bắt đầu Ca Làm Việc</h2>
                        <p className="sp-start-desc">
                            {isAdminUser
                                ? 'Chọn ca để bắt đầu nhập liệu và báo cáo'
                                : isAssignedToday
                                    ? 'Chọn ca đã được phân để bắt đầu'
                                    : 'Bạn chưa được phân ca hôm nay. Hãy đăng ký hoặc liên hệ admin.'
                            }
                        </p>
                        <div className="sp-type-list">
                            {(['MORNING', 'AFTERNOON', 'EVENING'] as ShiftType[]).map(type => {
                                const configId = getConfigIdForType(type);
                                const isAssigned = isAdminUser || assignedShiftIds.has(configId);
                                return (
                                    <button
                                        key={type}
                                        className={`sp-type-btn ${selectedType === type ? 'active' : ''} ${!isAssigned ? 'disabled' : ''}`}
                                        onClick={() => isAssigned && setSelectedType(type)}
                                        disabled={!isAssigned}
                                        title={isAssigned ? SHIFT_LABELS[type] : 'Chưa được phân ca này'}
                                    >
                                        <div className={`sp-type-icon ${type.toLowerCase()}`}>
                                            <span className="material-symbols-outlined material-symbols-fill">{SHIFT_ICONS[type]}</span>
                                        </div>
                                        <span className="sp-type-label">{SHIFT_LABELS[type]}</span>
                                        {isAssigned ? (
                                            <span className="sp-type-badge assigned">
                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check_circle</span>
                                            </span>
                                        ) : (
                                            <span className="sp-type-badge unassigned">Chưa phân ca</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Support shifts registration */}
                        {!isAdminUser && supportShifts.length > 0 && (
                            <div className="sp-support-section">
                                <p className="sp-support-title">
                                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>volunteer_activism</span>
                                    Ca hỗ trợ — Đăng ký để chờ admin duyệt
                                </p>
                                <div className="sp-support-list">
                                    {supportShifts.map(sc => {
                                        const isRegistered = todayAssignments.some(a => a.shift === sc.id);
                                        return (
                                            <button
                                                key={sc.id}
                                                className={`sp-support-btn ${isRegistered ? 'registered' : ''}`}
                                                onClick={() => !isRegistered && registerSupportShift(sc.id)}
                                                disabled={isRegistered}
                                            >
                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: sc.color }}>{sc.icon}</span>
                                                <span>{sc.name} ({sc.time})</span>
                                                {isRegistered ? (
                                                    <span className="sp-support-status">✓ Đã đăng ký</span>
                                                ) : (
                                                    <span className="sp-support-status register">Đăng ký</span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <button
                            className="sp-start-btn"
                            onClick={handleStartShift}
                            disabled={!selectedType || starting || (!isAdminUser && !assignedShiftIds.has(getConfigIdForType(selectedType || 'MORNING')))}
                        >
                            <span className="material-symbols-outlined">play_arrow</span>
                            {starting ? 'Đang tạo ca...' : 'Bắt đầu ca'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'KẾT TOÁN',
            items: [
                { id: 'cash', label: 'Kiểm Két', badge: getDenomTotal() > 0 ? fmt(getDenomTotal()) : undefined, badgeColor: 'amber' },
            ],
        },
        {
            label: 'CÔNG VIỆC',
            items: [
                { id: 'tasks', label: 'Nhiệm Vụ', badge: `${checkProgress.completed}/${checkProgress.total}`, badgeColor: checkProgress.pct === 100 ? 'emerald' : 'amber' },
            ],
        },
        {
            label: 'GIAO NHẬN',
            items: [
                { id: 'handover', label: 'Tồn Giao Ca', badge: handoverItems.length > 0 ? handoverItems.length : undefined, badgeColor: 'muted' },
                { id: 'assets', label: 'Vật Tư', badge: assets.length > 0 ? assets.length : undefined, badgeColor: 'muted' },
            ],
        },
    ];

    const shiftInfoFooter = (
        <div className="sp-sidebar-shift-info">
            <div className={`sp-sidebar-badge ${shift.shift_type.toLowerCase()}`}>
                <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 18 }}>{SHIFT_ICONS[shift.shift_type]}</span>
            </div>
            <div className="sp-sidebar-shift-detail">
                <div className="sp-sidebar-shift-name">{SHIFT_LABELS[shift.shift_type]}</div>
                <div className="sp-sidebar-shift-meta">{shift.store?.name || ''}</div>
                <div className="sp-sidebar-shift-meta">{new Date(shift.shift_date).toLocaleDateString('vi-VN')} • {user.name}</div>
            </div>
            {isCompleted && <div className="sp-sidebar-completed">✓ Đã kết ca</div>}
        </div>
    );

    // ═══ ACTIVE SHIFT ═══
    return (
        <div className="hq-page">
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">store</span>
                    <span className="hq-breadcrumb-title">Bàn Giao Ca</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{TAB_LABELS[activeTab]}</span>
                    {autoSaveStatus !== 'idle' && (
                        <span className={`sp-autosave ${autoSaveStatus}`} style={{ marginLeft: 12 }}>
                            <span className="sp-autosave-dot" />
                            {autoSaveStatus === 'saving' && 'Lưu...'}
                            {autoSaveStatus === 'saved' && 'Đã lưu'}
                            {autoSaveStatus === 'error' && 'Lỗi'}
                        </span>
                    )}
                </div>,
                topbarNode
            )}

            <div className="hq-layout">
                <SubSidebar
                    title="Bàn Giao Ca"
                    groups={sidebarGroups}
                    activeId={activeTab}
                    onSelect={(id) => setActiveTab(id as any)}
                    footer={shiftInfoFooter}
                />

                <div className="hq-content">
                    <div className="hq-section-animate">
                        <Suspense fallback={<TabLoading />}>
                            {activeTab === 'tasks' && <TasksTab />}
                            {activeTab === 'cash' && <CashTab />}
                            {activeTab === 'handover' && <HandoverTab />}
                            {activeTab === 'assets' && <AssetsTab />}
                        </Suspense>
                    </div>

                    {/* End-shift bar */}
                    {!isCompleted && (
                        <div className="sp-endbar">
                            <div className="sp-endbar-info">
                                <span style={{ color: checkProgress.pct === 100 ? '#10b981' : '#f59e0b', fontWeight: 700 }}>
                                    {checkProgress.pct}% nhiệm vụ
                                </span>
                                <span style={{ color: '#d1d5db' }}>•</span>
                                <span style={{ color: '#6b7280' }}>Két: {fmt(getDenomTotal())}</span>
                            </div>
                            <button className="sp-end-btn" onClick={handleEndShift} disabled={ending}>
                                <span className="material-symbols-outlined">stop_circle</span>
                                {ending ? 'Đang kết ca...' : 'Kết Ca & Gửi Báo Cáo'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ShiftPage: React.FC<{ user: User }> = ({ user }) => (
    <ShiftProvider user={user}>
        <ShiftPageInner />
    </ShiftProvider>
);

export default ShiftPage;
