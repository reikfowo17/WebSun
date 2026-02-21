import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { User } from '../../types';
import { useToast } from '../../contexts';
import { InventoryService } from '../../services';
import DistributionHub from './DistributionHub';
import RecoveryView from './RecoveryView';
import ReviewsView from './ReviewsView';
import OverviewTab from './OverviewTab';

interface InventoryHQProps {
    user: User;
}

type TabId = 'OVERVIEW' | 'REVIEWS' | 'TASKS' | 'RECOVERY';

const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'OVERVIEW', label: 'TỔNG QUAN', icon: 'dashboard' },
    { id: 'REVIEWS', label: 'DUYỆT', icon: 'fact_check' },
    { id: 'TASKS', label: 'PHÂN PHỐI', icon: 'local_shipping' },
    { id: 'RECOVERY', label: 'TRUY THU', icon: 'assignment_return' },
];

const InventoryHQ: React.FC<InventoryHQProps> = ({ user }) => {
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<TabId>('OVERVIEW');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));
    const [pendingCount, setPendingCount] = useState(0);
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));

        const titleFallback = document.getElementById('topbar-fallback-title');
        if (titleFallback) {
            titleFallback.style.display = 'none';
        }

        return () => {
            if (titleFallback) titleFallback.style.display = 'flex';
        }
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

    return (
        <div className="h-full flex flex-col bg-slate-50/50 font-sans text-slate-900 border-t border-gray-100 relative">

            {/* INJECT INTO TOPBAR */}
            {topbarNode && createPortal(
                <div className="flex items-center justify-between w-full h-full pl-2">
                    {/* Left: Navigation Tabs */}
                    <nav className="flex items-center gap-1 h-full" role="tablist">
                        {TABS.map((tab) => (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={activeTab === tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`h-full relative px-4 text-[13px] font-bold uppercase tracking-wider transition-colors flex items-center ${activeTab === tab.id
                                    ? 'text-yellow-600 bg-yellow-50/30'
                                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50/50'
                                    }`}
                            >
                                {tab.label}
                                {tab.id === 'REVIEWS' && pendingCount > 0 && (
                                    <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[11px] font-bold bg-yellow-100 text-yellow-700 shadow-sm border border-yellow-200">
                                        {pendingCount}
                                    </span>
                                )}
                                {activeTab === tab.id && (
                                    <span className="absolute bottom-[-1px] left-0 w-full h-[3px] bg-yellow-500 rounded-t-sm"></span>
                                )}
                            </button>
                        ))}
                    </nav>

                    {/* Right: Date Picker */}
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-yellow-300 hover:bg-yellow-50/50 transition-all cursor-pointer">
                                <span className="material-symbols-outlined text-gray-400 group-hover:text-yellow-500 text-[20px] transition-colors">calendar_month</span>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none group-hover:text-yellow-600">Ngày làm việc</span>
                                    <span className="text-[13px] font-bold text-gray-700 w-24 text-right group-hover:text-yellow-700 mt-0.5">
                                        {new Date(currentDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                            <input
                                type="date"
                                value={currentDate}
                                onChange={(e) => setCurrentDate(e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                aria-label="Chọn ngày làm việc"
                            />
                        </div>
                    </div>
                </div>,
                topbarNode
            )}

            {/* Content Display */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
                <div className="max-w-7xl mx-auto h-full">
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
            </main>
        </div>
    );
};

export default InventoryHQ;
