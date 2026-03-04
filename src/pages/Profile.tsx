import React, { useState, useEffect } from 'react';
import type { User } from '../types';

interface ProfileProps {
    user: User;
}

// Achievement icons using Material Symbols instead of emoji
const MOCK_ACHIEVEMENTS = [
    { id: '1', name: 'Chào Mừng!', icon: 'waving_hand', xp: 50, unlocked: true },
    { id: '2', name: 'Siêng Năng', icon: 'star', xp: 100, unlocked: true },
    { id: '3', name: 'Chính Xác', icon: 'target', xp: 150, unlocked: true },
    { id: '4', name: 'Chuyên Gia', icon: 'emoji_events', xp: 500, unlocked: false },
    { id: '5', name: 'Huyền Thoại', icon: 'workspace_premium', xp: 2000, unlocked: false },
    { id: '6', name: 'Thần Tốc', icon: 'bolt', xp: 75, unlocked: false },
];

const ACHIEVEMENT_COLORS: Record<string, { bg: string; color: string }> = {
    waving_hand: { bg: '#FEF3C7', color: '#D97706' },
    star: { bg: '#FEF9C3', color: '#CA8A04' },
    target: { bg: '#DBEAFE', color: '#2563EB' },
    emoji_events: { bg: '#FDE68A', color: '#92400E' },
    workspace_premium: { bg: '#EDE9FE', color: '#7C3AED' },
    bolt: { bg: '#FEF3C7', color: '#F59E0B' },
};

// Rank icons using Material Symbols
const RANK_ICONS: Record<number, { icon: string; color: string }> = {
    1: { icon: 'military_tech', color: '#F59E0B' },
    2: { icon: 'military_tech', color: '#94A3B8' },
    3: { icon: 'military_tech', color: '#CD7F32' },
};

// Mock leaderboard
const MOCK_LEADERBOARD = [
    { rank: 1, name: 'Nguyễn Văn A', xp: 4520, level: 10 },
    { rank: 2, name: 'Trần Thị B', xp: 3890, level: 8 },
    { rank: 3, name: 'Lê Văn C', xp: 2150, level: 5 },
    { rank: 4, name: 'Phạm Minh D', xp: 1800, level: 4 },
    { rank: 5, name: 'Hoàng Thị E', xp: 1200, level: 3 },
];

type ProfileTab = 'overview' | 'achievements' | 'leaderboard';

const Profile: React.FC<ProfileProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
    const [stats, setStats] = useState({ xp: user.xp, level: user.level, xpToNextLevel: 500 });

    const xpPerLevel = 500;
    const xpInCurrentLevel = stats.xp % xpPerLevel;
    const progressPercent = (xpInCurrentLevel / xpPerLevel) * 100;

    useEffect(() => {
        setStats({
            xp: user.xp,
            level: user.level,
            xpToNextLevel: 500
        });
    }, [user.id, user.xp, user.level]);

    return (
        <div className="min-h-full p-6" style={{ background: '#F8F7F4' }}>
            <div className="max-w-3xl mx-auto">
                {/* Compact Header Card */}
                <div className="rounded-2xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #0F0F0F 100%)' }}>
                    <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            <img
                                src={user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}&backgroundColor=fbbf24`}
                                alt={user.name}
                                className="w-16 h-16 rounded-xl border-3 border-yellow-400/50"
                            />
                            <div className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-yellow-400 rounded-md text-xs font-black text-gray-900">
                                Lv.{stats.level}
                            </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-black text-white truncate">{user.name}</h1>
                            <p className="text-sm text-gray-400">{user.store || 'Sunmart'} • {user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</p>

                            {/* XP Progress Bar */}
                            <div className="mt-2">
                                <div className="flex justify-between text-[10px] font-bold mb-1">
                                    <span className="text-gray-500 uppercase">XP Progress</span>
                                    <span className="text-yellow-400">{xpInCurrentLevel}/{xpPerLevel}</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${progressPercent}%`, background: 'linear-gradient(90deg, #FACC15, #F59E0B)' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="hidden sm:flex gap-2">
                            <div className="text-center px-3 py-2 bg-white/10 rounded-xl min-w-[60px]">
                                <div className="text-lg font-black text-white">{stats.xp}</div>
                                <div className="text-[9px] text-gray-400 uppercase">Total XP</div>
                            </div>
                            <div className="text-center px-3 py-2 bg-white/10 rounded-xl min-w-[60px]">
                                <div className="text-lg font-black text-white">3</div>
                                <div className="text-[9px] text-gray-400 uppercase">Thành tựu</div>
                            </div>
                            <div className="text-center px-3 py-2 bg-white/10 rounded-xl min-w-[60px]">
                                <div className="text-lg font-black text-white">#3</div>
                                <div className="text-[9px] text-gray-400 uppercase">Xếp hạng</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
                    <div className="flex border-b border-gray-100">
                        {([
                            { key: 'overview' as ProfileTab, label: 'Tổng quan', icon: 'person' },
                            { key: 'achievements' as ProfileTab, label: 'Thành tựu', icon: 'emoji_events' },
                            { key: 'leaderboard' as ProfileTab, label: 'Bảng xếp hạng', icon: 'leaderboard' },
                        ]).map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 py-3 text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === tab.key
                                    ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50 font-bold'
                                    : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-base">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="p-4">
                        {activeTab === 'overview' && (
                            <div className="space-y-3">
                                {/* Info Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FAFAF8' }}>
                                        <span className="material-symbols-outlined text-gray-400">badge</span>
                                        <div>
                                            <div className="text-[10px] text-gray-400 uppercase">Mã NV</div>
                                            <div className="font-bold text-sm text-gray-800">{user.id?.slice(0, 8).toUpperCase()}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FAFAF8' }}>
                                        <span className="material-symbols-outlined text-gray-400">store</span>
                                        <div>
                                            <div className="text-[10px] text-gray-400 uppercase">Cửa hàng</div>
                                            <div className="font-bold text-sm text-gray-800">{user.store || 'N/A'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#FAFAF8' }}>
                                        <span className="material-symbols-outlined text-gray-400">military_tech</span>
                                        <div>
                                            <div className="text-[10px] text-gray-400 uppercase">Vai trò</div>
                                            <div className="font-bold text-sm text-gray-800">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên'}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-xl">
                                        <span className="material-symbols-outlined text-yellow-500">trending_up</span>
                                        <div>
                                            <div className="text-[10px] text-yellow-600 uppercase">Cấp tiếp theo</div>
                                            <div className="font-bold text-sm text-gray-800">Còn {xpPerLevel - xpInCurrentLevel} XP</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Activity Stats */}
                                <div className="p-4 rounded-xl" style={{ background: 'linear-gradient(135deg, #FEF3C7, #FFEDD5)', border: '1px solid #FBBF24' }}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="material-symbols-outlined text-yellow-600 text-lg">analytics</span>
                                        <span className="font-bold text-gray-800 text-sm">Thống kê hoạt động</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div>
                                            <div className="text-xl font-black text-primary">24</div>
                                            <div className="text-[10px] text-gray-500">Báo cáo đã nộp</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-black text-emerald-600">98%</div>
                                            <div className="text-[10px] text-gray-500">Độ chính xác</div>
                                        </div>
                                        <div>
                                            <div className="text-xl font-black text-blue-600">12</div>
                                            <div className="text-[10px] text-gray-500">Ngày liên tiếp</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'achievements' && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {MOCK_ACHIEVEMENTS.map(ach => {
                                    const colors = ACHIEVEMENT_COLORS[ach.icon] || { bg: '#F3F4F6', color: '#6B7280' };
                                    return (
                                        <div
                                            key={ach.id}
                                            className={`relative p-3 rounded-xl border transition-all text-center ${ach.unlocked
                                                ? 'bg-white border-yellow-200 shadow-sm'
                                                : 'bg-gray-50 border-gray-200 opacity-50'
                                                }`}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2"
                                                style={{ background: ach.unlocked ? colors.bg : '#F3F4F6' }}
                                            >
                                                <span
                                                    className="material-symbols-outlined"
                                                    style={{ fontSize: 22, color: ach.unlocked ? colors.color : '#9CA3AF' }}
                                                >
                                                    {ach.unlocked ? ach.icon : 'lock'}
                                                </span>
                                            </div>
                                            <div className={`font-bold text-xs ${ach.unlocked ? 'text-gray-800' : 'text-gray-400'}`}>
                                                {ach.name}
                                            </div>
                                            <div className={`text-[10px] font-bold ${ach.unlocked ? 'text-yellow-600' : 'text-gray-400'}`}>
                                                +{ach.xp} XP
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {activeTab === 'leaderboard' && (
                            <div className="space-y-2">
                                {MOCK_LEADERBOARD.map((entry, idx) => {
                                    const isCurrentUser = idx === 2; // Assume #3 is current user
                                    const rankCfg = RANK_ICONS[entry.rank];
                                    return (
                                        <div
                                            key={entry.rank}
                                            className={`flex items-center gap-3 p-3 rounded-xl ${isCurrentUser
                                                ? 'bg-yellow-50 border-2 border-yellow-300'
                                                : 'bg-gray-50'
                                                }`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm ${!rankCfg ? 'bg-gray-200 text-gray-500' : ''}`}>
                                                {rankCfg ? (
                                                    <span className="material-symbols-outlined material-symbols-fill" style={{ fontSize: 22, color: rankCfg.color }}>
                                                        {rankCfg.icon}
                                                    </span>
                                                ) : entry.rank}
                                            </div>
                                            <img
                                                src={`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(entry.name)}&backgroundColor=94a3b8`}
                                                alt=""
                                                className="w-8 h-8 rounded-lg"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-gray-800 truncate">
                                                    {entry.name}
                                                    {isCurrentUser && <span className="text-yellow-600 text-xs ml-1">(Bạn)</span>}
                                                </div>
                                                <div className="text-[10px] text-gray-400">Level {entry.level}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-black text-sm text-primary">{entry.xp.toLocaleString()}</div>
                                                <div className="text-[9px] text-gray-400">XP</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Profile;
