import React, { useState, useEffect, useCallback } from 'react';
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

    // Fetch pending report count for badge
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

    // When review action happens, refresh count
    const handleReviewDone = useCallback(() => {
        fetchPendingCount();
    }, [fetchPendingCount]);

    return (
        <div className="h-full flex flex-col bg-slate-50/50 font-sans text-slate-900">
            {/* Header */}
            <header className="px-8 flex items-center justify-between shrink-0 bg-white border-b border-gray-100 sticky top-0 z-50 h-16">
                {/* Left: Navigation Tabs */}
                <nav className="flex items-center gap-1 h-full" role="tablist">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            role="tab"
                            aria-selected={activeTab === tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`h-full relative px-4 text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2 ${activeTab === tab.id
                                    ? 'text-indigo-600'
                                    : 'text-gray-400 hover:text-slate-600'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            {tab.label}
                            {/* Pending badge on DUYỆT tab */}
                            {tab.id === 'REVIEWS' && pendingCount > 0 && (
                                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-sm">
                                    {pendingCount}
                                </span>
                            )}
                            {activeTab === tab.id && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600"></span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Right: Date Picker */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all cursor-pointer">
                            <span className="material-symbols-outlined text-gray-400 group-hover:text-indigo-500 text-lg transition-colors">calendar_month</span>
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide leading-none group-hover:text-indigo-400">Ngày làm việc</span>
                                <span className="text-sm font-bold text-slate-700 w-24 text-right group-hover:text-indigo-700">
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
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
                <div className="max-w-7xl mx-auto min-h-full">
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
