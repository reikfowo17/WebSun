import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types';

interface ProfilePopoverProps {
    user: User;
    onLogout?: () => void;
}

// Achievement mock data for display
const MOCK_ACHIEVEMENTS = [
    { id: '1', name: 'Chào Mừng!', icon: '👋', unlocked: true },
    { id: '2', name: 'Siêng Năng', icon: '⭐', unlocked: true },
    { id: '3', name: 'Chuyên Gia', icon: '🏆', unlocked: false },
];

// Leaderboard mock data
const MOCK_LEADERBOARD = [
    { rank: 1, name: 'Nguyễn Văn A', xp: 4520, isCurrentUser: false },
    { rank: 2, name: 'Trần Thị B', xp: 3890, isCurrentUser: false },
    { rank: 3, name: 'Lê Văn C', xp: 2150, isCurrentUser: true },
];

const ProfilePopover: React.FC<ProfilePopoverProps> = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'achievements' | 'leaderboard'>('overview');
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate level progress
    const xpPerLevel = 500;
    const xpInCurrentLevel = user.xp % xpPerLevel;
    const progressPercent = (xpInCurrentLevel / xpPerLevel) * 100;

    // Handle mouse enter with delay
    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(true);
    };

    // Handle mouse leave with delay
    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const getRankBadge = (rank: number) => {
        if (rank === 1) return { bg: 'bg-yellow-100', text: 'text-yellow-700', icon: '🥇' };
        if (rank === 2) return { bg: 'bg-gray-100', text: 'text-gray-600', icon: '🥈' };
        if (rank === 3) return { bg: 'bg-orange-100', text: 'text-orange-700', icon: '🥉' };
        return { bg: 'bg-gray-50', text: 'text-gray-500', icon: '' };
    };

    return (
        <div
            className="relative"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            {/* Trigger - User Avatar & Info */}
            <div
                ref={triggerRef}
                className="flex items-center gap-3 p-2 rounded-xl cursor-pointer hover:bg-gray-100/80 transition-all group"
            >
                <div className="relative">
                    <img
                        src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
                        alt={user.name}
                        className="w-10 h-10 rounded-xl border-2 border-yellow-400/50 group-hover:border-yellow-400 transition-all"
                    />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-md flex items-center justify-center text-[10px] font-black text-secondary shadow-sm">
                        {user.level}
                    </div>
                </div>
                <div className="hidden md:block">
                    <div className="font-bold text-sm text-gray-800">{user.name}</div>
                    <div className="text-[10px] text-gray-400 font-medium">{user.xp} XP</div>
                </div>
                <span className={`material-symbols-outlined text-gray-400 text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                    expand_more
                </span>
            </div>

            {/* Popover Panel - Opens UPWARD from sidebar footer */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    className="absolute left-0 bottom-full mb-2 w-80 bg-white rounded-2xl shadow-2xl shadow-gray-300/50 border border-gray-200 overflow-hidden z-[100]"
                    style={{ animation: 'fadeInSlideUp 0.2s ease-out' }}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-5">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <img
                                    src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
                                    alt={user.name}
                                    className="w-14 h-14 rounded-xl border-2 border-yellow-400/30"
                                />
                                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-yellow-400 rounded-md text-[10px] font-black text-gray-900">
                                    Lv.{user.level}
                                </div>
                            </div>
                            <div className="flex-1">
                                <h3 className="font-bold text-white text-lg">{user.name}</h3>
                                <p className="text-gray-400 text-xs">{user.store || 'Sunmart'}</p>
                            </div>
                        </div>

                        {/* XP Progress */}
                        <div className="mt-4">
                            <div className="flex justify-between text-[10px] font-bold mb-1.5">
                                <span className="text-gray-400">XP PROGRESS</span>
                                <span className="text-yellow-400">{xpInCurrentLevel} / {xpPerLevel}</span>
                            </div>
                            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-yellow-400 to-yellow-300 rounded-full transition-all duration-500"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="flex gap-2 mt-3">
                            <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                                <div className="text-lg font-black text-white">{user.xp}</div>
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Total XP</div>
                            </div>
                            <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                                <div className="text-lg font-black text-white">2</div>
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Thành tựu</div>
                            </div>
                            <div className="flex-1 bg-white/10 rounded-lg p-2 text-center">
                                <div className="text-lg font-black text-white">#3</div>
                                <div className="text-[9px] text-gray-400 uppercase font-bold">Xếp hạng</div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-100">
                        {[
                            { key: 'overview', label: 'Tổng quan', icon: 'person' },
                            { key: 'achievements', label: 'Thành tựu', icon: 'emoji_events' },
                            { key: 'leaderboard', label: 'Xếp hạng', icon: 'leaderboard' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.key
                                    ? 'text-yellow-600 border-b-2 border-yellow-400 bg-yellow-50/50'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-4 max-h-64 overflow-y-auto">
                        {activeTab === 'overview' && (
                            <div className="space-y-3">
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <span className="material-symbols-outlined text-gray-400">badge</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-400">Mã nhân viên</div>
                                        <div className="font-bold text-gray-800">{user.id?.slice(0, 8) || 'N/A'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <span className="material-symbols-outlined text-gray-400">store</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-400">Cửa hàng</div>
                                        <div className="font-bold text-gray-800">{user.store || 'Chưa phân công'}</div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                    <span className="material-symbols-outlined text-gray-400">military_tech</span>
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-400">Cấp bậc</div>
                                        <div className="font-bold text-gray-800">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div className="space-y-2">
                                {MOCK_ACHIEVEMENTS.map(ach => (
                                    <div
                                        key={ach.id}
                                        className={`flex items-center gap-3 p-3 rounded-xl transition-all ${ach.unlocked
                                            ? 'bg-yellow-50 border border-yellow-200'
                                            : 'bg-gray-50 opacity-50'
                                            }`}
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${ach.unlocked ? 'bg-yellow-100' : 'bg-gray-100'
                                            }`}>
                                            {ach.unlocked ? ach.icon : '🔒'}
                                        </div>
                                        <div className="flex-1">
                                            <div className={`font-bold text-sm ${ach.unlocked ? 'text-gray-800' : 'text-gray-400'}`}>
                                                {ach.name}
                                            </div>
                                            <div className="text-[10px] text-gray-400">
                                                {ach.unlocked ? 'Đã mở khóa' : 'Chưa đạt được'}
                                            </div>
                                        </div>
                                        {ach.unlocked && (
                                            <span className="material-symbols-outlined text-yellow-500">verified</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'leaderboard' && (
                            <div className="space-y-2">
                                {MOCK_LEADERBOARD.map(entry => {
                                    const badge = getRankBadge(entry.rank);
                                    return (
                                        <div
                                            key={entry.rank}
                                            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${entry.isCurrentUser
                                                ? 'bg-yellow-50 border-2 border-yellow-300'
                                                : 'bg-gray-50 hover:bg-gray-100'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${badge.bg} ${badge.text}`}>
                                                {badge.icon || entry.rank}
                                            </div>
                                            <div className="flex-1">
                                                <div className="font-bold text-sm text-gray-800">
                                                    {entry.name}
                                                    {entry.isCurrentUser && <span className="text-yellow-600 text-xs ml-1">(Bạn)</span>}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-yellow-600">{entry.xp.toLocaleString()}</div>
                                                <div className="text-[9px] text-gray-400">XP</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                        <button
                            onClick={onLogout}
                            className="w-full py-2.5 text-sm font-bold text-red-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">logout</span>
                            Đăng xuất
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePopover;
