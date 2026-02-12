import React, { useState } from 'react';
import { User } from '../../types';
import { useToast } from '../../contexts';
import { useNavigate } from 'react-router-dom';
import DistributionHub from './DistributionHub';
import RecoveryView from './RecoveryView';
import ReviewsView from './ReviewsView';
import OverviewTab from './OverviewTab';

interface InventoryHQProps {
    user: User;
}

const InventoryHQ: React.FC<InventoryHQProps> = ({ user }) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [subTab, setSubTab] = useState<'TASKS' | 'REVIEWS' | 'RECOVERY'>('TASKS');
    const [progressSubTab, setProgressSubTab] = useState<'OVERVIEW' | 'REVIEW'>('OVERVIEW');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));

    return (
        <div className="h-full flex flex-col bg-slate-50/50 font-sans text-slate-900">
            {/* Header - Professional & Minimal */}
            <header className="px-8 flex items-center justify-between shrink-0 bg-white border-b border-gray-100 sticky top-0 z-50 h-16">
                {/* Left: Navigation Tabs */}
                <nav className="flex items-center gap-8 h-full">
                    {[
                        { id: 'TASKS', label: 'PHÂN PHỐI' },
                        { id: 'REVIEWS', label: 'TIẾN TRÌNH' },
                        { id: 'RECOVERY', label: 'TRUY THU' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setSubTab(tab.id as any)}
                            className={`h-full relative px-1 text-xs font-bold uppercase tracking-wider transition-colors flex items-center ${subTab === tab.id
                                ? 'text-indigo-600'
                                : 'text-gray-400 hover:text-slate-600'
                                }`}
                        >
                            {tab.label}
                            {subTab === tab.id && (
                                <span className="absolute bottom-0 left-0 w-full h-[2px] bg-indigo-600"></span>
                            )}
                        </button>
                    ))}
                </nav>

                {/* Right: Date Picker - Minimal */}
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
                        />
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
                <div className="max-w-7xl mx-auto min-h-full">
                    {subTab === 'TASKS' && <DistributionHub toast={toast} date={currentDate} />}

                    {subTab === 'REVIEWS' && (
                        <div className="space-y-4">
                            {/* Sub-tabs for TIẾN TRÌNH */}
                            <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-gray-200 w-fit">
                                {[
                                    { id: 'OVERVIEW', label: 'TỔNG QUAN', icon: 'dashboard' },
                                    { id: 'REVIEW', label: 'DUYỆT BÁO CÁO', icon: 'fact_check' }
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setProgressSubTab(tab.id as any)}
                                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${progressSubTab === tab.id
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-gray-500 hover:bg-gray-50'
                                            }`}
                                    >
                                        <span className="material-symbols-outlined text-lg">{tab.icon}</span>
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Content */}
                            {progressSubTab === 'OVERVIEW' && (
                                <OverviewTab
                                    date={currentDate}
                                    toast={toast}
                                    onNavigateToReviews={(storeCode) => {
                                        setProgressSubTab('REVIEW');
                                        // Could add store filter here
                                    }}
                                />
                            )}
                            {progressSubTab === 'REVIEW' && <ReviewsView toast={toast} user={user} />}
                        </div>
                    )}

                    {subTab === 'RECOVERY' && <RecoveryView toast={toast} date={currentDate} />}
                </div>
            </main>
        </div>
    );
};

export default InventoryHQ;
