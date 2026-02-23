import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { useToast } from '../../contexts';
import { InventoryService } from '../../services';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import DistributionHub from './DistributionHub';
import RecoveryView from './RecoveryView';
import ReviewsView from './ReviewsView';
import OverviewTab from './OverviewTab';
import '../../styles/hq-sidebar.css';

interface InventoryHQProps {
    user: User;
}

type TabId = 'OVERVIEW' | 'REVIEWS' | 'TASKS' | 'RECOVERY';

const TAB_META: Record<TabId, { label: string; desc: string }> = {
    OVERVIEW: { label: 'Tổng Quan', desc: 'Thống kê & báo cáo kiểm kho' },
    REVIEWS: { label: 'Duyệt Báo Cáo', desc: 'Xét duyệt phiếu kiểm từ nhân viên' },
    TASKS: { label: 'Phân Phối', desc: 'Chấm công & phân ca kiểm kho' },
    RECOVERY: { label: 'Truy Thu', desc: 'Theo dõi & xử lý truy thu' },
};

const InventoryHQ: React.FC<InventoryHQProps> = ({ user }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<TabId>('OVERVIEW');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));
    const [pendingCount, setPendingCount] = useState(0);
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
        const titleFallback = document.getElementById('topbar-fallback-title');
        if (titleFallback) titleFallback.style.display = 'none';
        return () => {
            if (titleFallback) titleFallback.style.display = 'flex';
        };
    }, []);

    const fetchPendingCount = useCallback(async () => {
        try {
            const res = await InventoryService.getReports('PENDING');
            if (res.success) setPendingCount((res.reports || []).length);
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        fetchPendingCount();
        const interval = setInterval(fetchPendingCount, 30_000);
        const onVis = () => { if (!document.hidden) fetchPendingCount(); };
        document.addEventListener('visibilitychange', onVis);
        return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVis); };
    }, [fetchPendingCount]);

    const handleReviewDone = useCallback(() => {
        fetchPendingCount();
    }, [fetchPendingCount]);

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'TỔNG QUAN',
            items: [
                { id: 'OVERVIEW', label: 'Dashboard' },
            ]
        },
        {
            label: 'QUẢN LÝ',
            items: [
                { id: 'REVIEWS', label: 'Duyệt Báo Cáo', badge: pendingCount > 0 ? pendingCount : undefined, badgeColor: 'danger' },
                { id: 'TASKS', label: 'Phân Phối' },
                { id: 'RECOVERY', label: 'Truy Thu' },
            ]
        }
    ];

    const meta = TAB_META[activeTab];

    const datePicker = (
        <div className="hq-date-picker">
            <span className="material-symbols-outlined hq-date-icon">calendar_month</span>
            <div className="hq-date-picker-info">
                <div className="hq-date-picker-label">Ngày làm việc</div>
                <div className="hq-date-picker-value">
                    {new Date(currentDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
            </div>
            <input
                type="date"
                value={currentDate}
                onChange={(e) => setCurrentDate(e.target.value)}
                className="hq-date-input-hidden"
                aria-label="Chọn ngày làm việc"
            />
        </div>
    );

    return (
        <div className="hq-page">
            {/* Breadcrumb in topbar */}
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">inventory_2</span>
                    <span className="hq-breadcrumb-title">Quản Lý Tồn Kho</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{meta.label}</span>
                </div>,
                topbarNode
            )}

            <div className="hq-layout">
                <SubSidebar
                    title="Quản Lý Tồn Kho"
                    groups={sidebarGroups}
                    activeId={activeTab}
                    onSelect={(id) => setActiveTab(id as TabId)}
                    footer={datePicker}
                />
                <div className="hq-content" key={activeTab}>
                    <div className="hq-section-animate">
                        {activeTab === 'OVERVIEW' && (
                            <OverviewTab
                                date={currentDate}
                                toast={toast}
                                onNavigateToReviews={() => setActiveTab('REVIEWS')}
                            />
                        )}
                        {activeTab === 'REVIEWS' && (
                            <ReviewsView toast={toast} user={user} onReviewDone={handleReviewDone} />
                        )}
                        {activeTab === 'TASKS' && <DistributionHub toast={toast} date={currentDate} />}
                        {activeTab === 'RECOVERY' && <RecoveryView toast={toast} date={currentDate} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryHQ;
