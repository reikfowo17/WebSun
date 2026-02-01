import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

interface LeaderboardEntry {
    id: string;
    name: string;
    store: string;
    level: number;
    xp: number;
    avatar_url: string;
    rank: number;
}

interface LeaderboardProps {
    currentUserId?: string;
}

const Leaderboard: React.FC<LeaderboardProps> = ({ currentUserId }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<'all' | 'month' | 'week'>('all');

    useEffect(() => {
        loadLeaderboard();
    }, [period]);

    const loadLeaderboard = async () => {
        setLoading(true);

        if (isSupabaseConfigured()) {
            try {
                const { data, error } = await supabase
                    .from('users')
                    .select(`
            id,
            name,
            level,
            xp,
            avatar_url,
            stores (name)
          `)
                    .order('xp', { ascending: false })
                    .limit(20);

                if (!error && data) {
                    const mapped = (data as any[]).map((u, idx) => ({
                        id: u.id,
                        name: u.name,
                        store: u.stores?.name || 'N/A',
                        level: u.level || 1,
                        xp: u.xp || 0,
                        avatar_url: u.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(u.name)}`,
                        rank: idx + 1
                    }));
                    setEntries(mapped);
                }
            } catch (e) {
                console.error(e);
            }
        } else {
            // Mock data
            setEntries([
                { id: '1', name: 'Nguyễn Văn A', store: 'SM BEE', level: 12, xp: 4520, avatar_url: '', rank: 1 },
                { id: '2', name: 'Trần Thị B', store: 'SM PLAZA', level: 10, xp: 3890, avatar_url: '', rank: 2 },
                { id: '3', name: 'Lê Văn C', store: 'SM MIỀN ĐÔNG', level: 9, xp: 3340, avatar_url: '', rank: 3 },
                { id: '4', name: 'Phạm Thị D', store: 'SM BEE', level: 8, xp: 2980, avatar_url: '', rank: 4 },
                { id: '5', name: 'Hoàng Văn E', store: 'SM EMERALD', level: 7, xp: 2450, avatar_url: '', rank: 5 },
            ]);
        }

        setLoading(false);
    };

    const getRankBadge = (rank: number) => {
        if (rank === 1) return (
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-yellow-200">
                <span className="material-symbols-outlined text-white text-lg material-symbols-fill">emoji_events</span>
            </div>
        );
        if (rank === 2) return (
            <div className="w-10 h-10 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full flex items-center justify-center shadow-lg shadow-gray-200">
                <span className="material-symbols-outlined text-white text-lg material-symbols-fill">emoji_events</span>
            </div>
        );
        if (rank === 3) return (
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-700 rounded-full flex items-center justify-center shadow-lg shadow-amber-200">
                <span className="material-symbols-outlined text-white text-lg material-symbols-fill">emoji_events</span>
            </div>
        );
        return (
            <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="font-black text-gray-500">{rank}</span>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-purple-500 to-indigo-600">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-2xl">leaderboard</span>
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white">Bảng Xếp Hạng</h3>
                            <p className="text-purple-200 text-sm">Top nhân viên xuất sắc</p>
                        </div>
                    </div>

                    {/* Period Selector */}
                    <div className="flex bg-white/20 backdrop-blur rounded-lg p-1">
                        {(['all', 'month', 'week'] as const).map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${period === p ? 'bg-white text-purple-600' : 'text-white/80 hover:text-white'
                                    }`}
                            >
                                {p === 'all' ? 'Tất cả' : p === 'month' ? 'Tháng' : 'Tuần'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="divide-y divide-gray-100">
                {loading ? (
                    <div className="p-8 text-center text-gray-400">
                        <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">Chưa có dữ liệu</div>
                ) : (
                    entries.map((entry) => (
                        <div
                            key={entry.id}
                            className={`flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors ${entry.id === currentUserId ? 'bg-purple-50 border-l-4 border-purple-500' : ''
                                }`}
                        >
                            {/* Rank */}
                            {getRankBadge(entry.rank)}

                            {/* Avatar */}
                            <img
                                src={entry.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(entry.name)}`}
                                alt={entry.name}
                                className="w-12 h-12 rounded-full border-2 border-gray-200"
                            />

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-bold text-gray-800 truncate">{entry.name}</span>
                                    {entry.id === currentUserId && (
                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-bold rounded">BẠN</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="material-symbols-outlined text-sm">store</span>
                                    {entry.store}
                                </div>
                            </div>

                            {/* Stats */}
                            <div className="text-right">
                                <div className="flex items-center gap-1 justify-end mb-1">
                                    <span className="material-symbols-outlined text-yellow-500 text-sm">bolt</span>
                                    <span className="font-black text-gray-800">{entry.xp.toLocaleString()}</span>
                                    <span className="text-xs text-gray-400">XP</span>
                                </div>
                                <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full">
                                    <span className="text-white text-[10px] font-bold">LV.{entry.level}</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Leaderboard;
