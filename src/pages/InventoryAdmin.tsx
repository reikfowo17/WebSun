import React, { useState, useMemo, useEffect } from 'react';
import { User } from '../types';
import { useToast } from '../contexts';
import { useNavigate } from 'react-router-dom';
import { RecoveryService, RecoveryItem, InventoryService } from '../services';

// --- CONFIG & TYPES ---

const REVIEW_CONFIG = {
    STORES: [
        { id: 'BEE', name: 'SM BEE', color: 'bg-yellow-100 text-yellow-700' },
        { id: 'PLAZA', name: 'SM PLAZA', color: 'bg-blue-100 text-blue-700' },
        { id: 'MIỀN ĐÔNG', name: 'SM MIỀN ĐÔNG', color: 'bg-green-100 text-green-700' },
        { id: 'HT PEARL', name: 'SM HT PEARL', color: 'bg-purple-100 text-purple-700' },
        { id: 'GREEN TOPAZ', name: 'SM GREEN TOPAZ', color: 'bg-teal-100 text-teal-700' },
        { id: 'EMERALD', name: 'SM EMERALD', color: 'bg-pink-100 text-pink-700' }
    ],
    STATUS_OPTIONS: [
        { value: 'TRUY THU', label: 'Truy Thu', color: 'bg-red-100 text-red-700 border-red-200' },
        { value: 'ĐÃ XỬ LÝ', label: 'Đã Xử Lý', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        { value: 'CHỜ XÁC MINH', label: 'Chờ Xác Minh', color: 'bg-amber-100 text-amber-700 border-amber-200' },
        { value: 'BỎ QUA', label: 'Bỏ Qua', color: 'bg-gray-100 text-gray-500 border-gray-200' }
    ],
    REASON_OPTIONS: [
        { value: 'Mất hàng', icon: 'remove_shopping_cart' },
        { value: 'Hư hỏng', icon: 'broken_image' },
        { value: 'Sai nhập liệu', icon: 'edit_note' },
        { value: 'Hết hạn sử dụng', icon: 'event_busy' },
        { value: 'Khách trả lại', icon: 'undo' },
        { value: 'Kiểm đếm sai', icon: 'calculate' },
        { value: 'Lý do khác', icon: 'more_horiz' }
    ]
};



interface InventoryAdminProps {
    user: User;
}

// --- MAIN COMPONENT ---

const InventoryAdmin: React.FC<InventoryAdminProps> = ({ user }) => {
    const toast = useToast();
    const navigate = useNavigate();
    const [subTab, setSubTab] = useState<'TASKS' | 'REVIEWS' | 'RECOVERY'>('TASKS');
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));

    return (
        <div className="h-full flex flex-col bg-slate-50/50 font-sans text-slate-900">
            {/* Header */}
            <header className="px-8 py-5 flex items-center justify-between shrink-0 bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                        <span className="material-symbols-outlined text-white text-2xl">inventory</span>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Quản Lý Tồn Kho</h2>
                        <div className="flex gap-4 mt-1">
                            {['TASKS', 'REVIEWS', 'RECOVERY'].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setSubTab(tab as any)}
                                    className={`text-xs font-bold uppercase tracking-wider relative pb-1 transition-colors ${subTab === tab ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
                                        }`}
                                >
                                    {tab === 'TASKS' ? 'Phân Phối & Tiến độ' : tab === 'REVIEWS' ? 'Duyệt Báo Cáo' : 'Xử Lý Chênh Lệch'}
                                    {subTab === tab && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-full" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Date Picker & Actions */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-gray-400 text-lg">calendar_today</span>
                        </div>
                        <input
                            type="date"
                            value={currentDate}
                            onChange={(e) => setCurrentDate(e.target.value)}
                            className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-700 text-sm font-bold rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none hover:bg-gray-100 cursor-pointer"
                        />
                    </div>
                    <button className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors">
                        <span className="material-symbols-outlined">notifications</span>
                    </button>
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold border border-indigo-200 shadow-sm">
                        {user.username.substring(0, 2).toUpperCase()}
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-2">
                <div className="max-w-7xl mx-auto min-h-full">
                    {subTab === 'TASKS' && <TasksView toast={toast} date={currentDate} />}
                    {subTab === 'REVIEWS' && <ReviewsView toast={toast} user={user} />}
                    {subTab === 'RECOVERY' && <RecoveryView toast={toast} />}
                </div>
            </main>
        </div>
    );
};

// --- SUB-COMPONENTS ---

/* 1. TASKS VIEW - IMPROVED DISTRIBUTION TABLE */
const TasksView: React.FC<{ toast: any, date: string }> = ({ toast, date }) => {
    const [filterShift, setFilterShift] = useState<'ALL' | number>('ALL');

    // Mock Tasks - In real app, fetch based on `date`
    const tasks = [
        { storeId: 'BEE', storeName: 'SM BEE', shift: 1, status: 'SUBMITTED', assignee: 'Nguyễn Văn A', avatar: 'A', progress: 100 },
        { storeId: 'BEE', storeName: 'SM BEE', shift: 2, status: 'NOT_STARTED', assignee: 'Chưa phân công', avatar: null, progress: 0 },
        { storeId: 'PLAZA', storeName: 'SM PLAZA', shift: 1, status: 'IN_PROGRESS', assignee: 'Trần Thị B', avatar: 'B', progress: 65 },
        { storeId: 'MIỀN ĐÔNG', storeName: 'SM MIỀN ĐÔNG', shift: 1, status: 'NOT_STARTED', assignee: 'Chưa phân công', avatar: null, progress: 0 },
        { storeId: 'HT PEARL', storeName: 'SM HT PEARL', shift: 1, status: 'COMPLETED', assignee: 'Lê Văn C', avatar: 'C', progress: 100 },
        { storeId: 'GREEN TOPAZ', storeName: 'SM GREEN TOPAZ', shift: 2, status: 'NOT_STARTED', assignee: 'Phạm D', avatar: 'D', progress: 0 },
        { storeId: 'EMERALD', storeName: 'SM EMERALD', shift: 1, status: 'NOT_STARTED', assignee: 'Chưa phân công', avatar: null, progress: 0 }
    ];

    const filtered = filterShift === 'ALL' ? tasks : tasks.filter(t => t.shift === filterShift);

    return (
        <div className="space-y-6 pt-4">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-400 uppercase mr-2">Bộ lọc Ca:</span>
                    {[
                        { id: 'ALL', label: 'Tất cả' },
                        { id: 1, label: 'Ca 1 (Sáng)' },
                        { id: 2, label: 'Ca 2 (Chiều)' },
                        { id: 3, label: 'Ca 3 (Đêm)' }
                    ].map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setFilterShift(opt.id as any)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${filterShift === opt.id
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                                }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                    <span className="material-symbols-outlined text-[18px]">add_task</span>
                    Phân Bổ Tự Động
                </button>
            </div>

            {/* Distribution Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <span className="material-symbols-outlined text-indigo-600">assignment_ind</span>
                        Bảng Phân Phối Kiểm Tồn
                    </h3>
                    <span className="text-xs font-medium text-gray-500 bg-white px-2 py-1 rounded-lg border border-gray-200">
                        Ngày: {new Date(date).toLocaleDateString('vi-VN')}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 w-1/4">Cửa hàng</th>
                                <th className="px-6 py-4 w-1/6 text-center">Ca làm việc</th>
                                <th className="px-6 py-4 w-1/4">Nhân viên phụ trách</th>
                                <th className="px-6 py-4 w-1/6 text-center">Trạng thái</th>
                                <th className="px-6 py-4 w-1/6 text-center">Tiến độ</th>
                                <th className="px-6 py-4 text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filtered.map((task, i) => (
                                <tr key={i} className="hover:bg-indigo-50/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black border uppercase ${REVIEW_CONFIG.STORES.find(s => s.id === task.storeId)?.color || 'bg-gray-100 text-gray-500'
                                                }`}>
                                                {task.storeId}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{task.storeName}</p>
                                                <p className="text-[10px] text-gray-400 font-medium">Store ID: {task.storeId}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="inline-block px-2 py-1 rounded-md bg-white border border-gray-200 text-xs font-bold text-gray-600 shadow-sm">
                                            Ca {task.shift}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            {task.avatar ? (
                                                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold border-2 border-white shadow-sm">
                                                    {task.avatar}
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center border-2 border-white border-dashed">
                                                    <span className="material-symbols-outlined text-[16px]">add</span>
                                                </div>
                                            )}
                                            <span className={`text-sm font-medium ${!task.avatar ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                                                {task.assignee}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border inline-flex items-center gap-1 ${task.status === 'NOT_STARTED' ? 'bg-gray-50 text-gray-400 border-gray-100' :
                                                task.status === 'IN_PROGRESS' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                    'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'NOT_STARTED' ? 'bg-gray-400' :
                                                    task.status === 'IN_PROGRESS' ? 'bg-amber-500 animate-pulse' :
                                                        'bg-emerald-500'
                                                }`} />
                                            {task.status === 'NOT_STARTED' ? 'Chưa nhận' : task.status === 'IN_PROGRESS' ? 'Đang kiểm' : 'Hoàn thành'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-1000 ${task.status === 'SUBMITTED' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                    style={{ width: `${task.progress || 0}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-gray-500 w-8 text-right">{task.progress}%</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-indigo-600 p-1 rounded-lg hover:bg-indigo-50 transition-colors">
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/* 2. REVIEWS VIEW */
const ReviewsView: React.FC<{ toast: any, user: User }> = ({ toast, user }) => {
    const [reports, setReports] = useState<any[]>([]);
    const [selectedReport, setSelectedReport] = useState<any | null>(null);
    const [reportItems, setReportItems] = useState<any[]>([]);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        loadReports();
    }, []);

    const loadReports = async () => {
        const res = await InventoryService.getReports();
        if (res.success) setReports(res.reports);
    };

    const loadReportDetails = async (report: any) => {
        setSelectedReport(report);
        setShowDetailModal(true);
        setLoadingDetails(true);
        try {
            // Fetch items for this store/shift
            // Note: In real app we might want a snapshot, but getItems returns current/latest for that shift
            // If historical snapshot is needed, getItems needs update. For now assuming getItems(store, shift) is sufficient.
            const res = await InventoryService.getItems(report.storeId, report.shift);
            if (res.success) {
                // Filter only items with discrepancies for the view
                const problems = res.products.filter((p: any) => p.diff !== 0 || p.status === 'MISSING' || p.status === 'OVER');
                setReportItems(problems);
            }
        } finally {
            setLoadingDetails(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const pending = reports.filter(r => r.status === 'PENDING').length;
        // missingValue is not yet calculated in backend view, so default 0 or sum from items if available
        const missingVal = 0;
        return { pending, missingVal };
    }, [reports]);

    const handleApprove = async (id: string) => {
        if (!confirm('Xác nhận duyệt?')) return;
        setLoading(true);
        try {
            const res = await InventoryService.updateReportStatus(id, 'APPROVED', user.id);
            if (res.success) {
                toast.success('Đã duyệt báo cáo');
                loadReports();
                if (showDetailModal) setShowDetailModal(false);
            } else toast.error('Lỗi khi duyệt');
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async (id: string) => {
        if (!confirm('Xác nhận từ chối?')) return;
        setLoading(true);
        try {
            const res = await InventoryService.updateReportStatus(id, 'REJECTED', user.id);
            if (res.success) {
                toast.success('Đã từ chối báo cáo');
                loadReports();
                if (showDetailModal) setShowDetailModal(false);
            } else toast.error('Lỗi khi từ chối');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6 pt-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                    <span className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center material-symbols-outlined">pending_actions</span>
                    <div>
                        <p className="text-xs text-gray-400 font-bold uppercase">Chờ duyệt</p>
                        <p className="text-xl font-black text-indigo-600">{stats.pending}</p>
                    </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
                    <span className="w-10 h-10 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center material-symbols-outlined">money_off</span>
                    <div>
                        <p className="text-xs text-gray-400 font-bold uppercase">Giá trị lệch</p>
                        <p className="text-xl font-black text-rose-600">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(stats.missingVal)}
                        </p>
                    </div>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {reports.length === 0 && <p className="text-center text-gray-400 py-8">Không có báo cáo nào.</p>}
                {reports.map(report => (
                    <div key={report.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-300 transition-all shadow-sm group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border text-xs font-bold ${REVIEW_CONFIG.STORES.find(s => s.id === report.storeId)?.color || 'bg-gray-100'
                                    }`}>
                                    {(report.store || '').split(' ').pop()}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800">{report.store} <span className="text-gray-400 font-medium text-xs ml-1">Ca {report.shift}</span></h4>
                                    <p className="text-xs text-gray-500">{report.employee} • {report.date}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-6 bg-gray-50/50 px-6 py-2 rounded-xl border border-gray-100">
                                <div className="text-center">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Khớp</span>
                                    <span className="font-bold text-emerald-600">{report.matched}</span>
                                </div>
                                <div className="text-center border-l border-gray-200 pl-6">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Lệch</span>
                                    <span className={`font-bold ${report.missing > 0 ? 'text-red-600' : 'text-gray-600'}`}>{report.missing}</span>
                                </div>
                                <div className="text-center border-l border-gray-200 pl-6">
                                    <span className="block text-[10px] font-bold text-gray-400 uppercase">Giá Trị</span>
                                    <span className="font-bold text-rose-600">--</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {report.status === 'PENDING' ? (
                                    <>
                                        <button
                                            onClick={() => handleApprove(report.id)}
                                            className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 hover:bg-emerald-200 flex items-center justify-center transition-colors"
                                            title="Duyệt"
                                        >
                                            <span className="material-symbols-outlined">check</span>
                                        </button>
                                        <button
                                            onClick={() => loadReportDetails(report)}
                                            className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors"
                                            title="Xem chi tiết"
                                        >
                                            <span className="material-symbols-outlined">visibility</span>
                                        </button>
                                    </>
                                ) : (
                                    <div className="px-3 py-1.5 bg-gray-100 text-gray-500 border border-gray-200 rounded-lg text-xs font-bold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-sm">check_circle</span>
                                        {report.status}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Detail Modal */}
            {showDetailModal && selectedReport && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-lg font-bold text-gray-800">Chi tiết báo cáo</h3>
                                <p className="text-xs text-gray-500">{selectedReport.store} - {selectedReport.date}</p>
                            </div>
                            <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
                                <span className="material-symbols-outlined text-gray-500">close</span>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-4">
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <h4 className="font-bold text-red-700 text-sm mb-2">Sản phẩm chênh lệch</h4>
                                    {loadingDetails ? <p className="text-xs text-gray-500">Đang tải...</p> : (
                                        <div className="space-y-2">
                                            {reportItems.length === 0 ? <p className="text-xs text-gray-500">Không có chênh lệch nào.</p> : reportItems.map((p, i) => (
                                                <div key={i} className="flex justify-between items-center text-sm p-2 bg-white rounded-lg border border-red-100">
                                                    <div>
                                                        <p className="font-medium text-gray-800">{p.productName}</p>
                                                        <p className="text-xs text-gray-500">{p.barcode}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-red-600">{p.diff}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                            {selectedReport.status === 'PENDING' && (
                                <>
                                    <button onClick={() => handleReject(selectedReport.id)} className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition-colors">Từ chối</button>
                                    <button onClick={() => handleApprove(selectedReport.id)} className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">Phê duyệt</button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/* 3. RECOVERY VIEW (Integrated from RecoveryHub logic) */
const RecoveryView: React.FC<{ toast: any }> = ({ toast }) => {
    const [activeTab, setActiveTab] = useState<'SCAN' | 'MANAGE'>('SCAN');

    // Scan State
    const [scanStore, setScanStore] = useState('BEE');
    const [scanMonth, setScanMonth] = useState(new Date().toISOString().slice(0, 7));
    const [scannedItems, setScannedItems] = useState<any[]>([]);
    const [scanning, setScanning] = useState(false);

    // Manage State
    const [recoveryItems, setRecoveryItems] = useState<RecoveryItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'MANAGE') {
            loadRecoveryItems();
        }
    }, [activeTab]);

    const handleScan = async () => {
        setScanning(true);
        try {
            const res = await RecoveryService.scanForDiscrepancies(scanStore, scanMonth);
            if (res.success) setScannedItems(res.items);
            else toast.error('Không tìm thấy dữ liệu');
        } catch { toast.error('Lỗi kết nối'); }
        finally { setScanning(false); }
    };

    const handleCreate = async () => {
        if (!scannedItems.length) return;
        if (!confirm(`Xác nhận lập ${scannedItems.length} phiếu truy thu?`)) return;
        setScanning(true);
        try {
            const res = await RecoveryService.createRecoveryItems(scanStore, scannedItems);
            if (res.success) {
                toast.success(res.message);
                setScannedItems([]);
                setActiveTab('MANAGE');
            } else toast.error(res.message);
        } catch { toast.error('Lỗi tạo phiếu'); }
        finally { setScanning(false); }
    };

    const loadRecoveryItems = async () => {
        setLoading(true);
        try {
            const res = await RecoveryService.getRecoveryItems('ALL');
            if (res.success) setRecoveryItems(res.items);
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6 pt-4">
            {/* Sub-Tabs for Recovery */}
            <div className="flex bg-gray-100 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('SCAN')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'SCAN' ? 'bg-white shadow text-slate-800' : 'text-gray-500'}`}
                >
                    Quét & Lập Phiếu
                </button>
                <button
                    onClick={() => setActiveTab('MANAGE')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'MANAGE' ? 'bg-white shadow text-slate-800' : 'text-gray-500'}`}
                >
                    Quản Lý Phiếu
                </button>
            </div>

            {activeTab === 'SCAN' && (
                <div className="space-y-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-200">
                        <div className="flex gap-4 items-end">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Cửa hàng</label>
                                <select value={scanStore} onChange={e => setScanStore(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold">
                                    {REVIEW_CONFIG.STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tháng</label>
                                <input type="month" value={scanMonth} onChange={e => setScanMonth(e.target.value)} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold" />
                            </div>
                            <button onClick={handleScan} disabled={scanning} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-50">
                                {scanning ? 'Đang quét...' : 'Quét Dữ Liệu'}
                            </button>
                        </div>
                    </div>

                    {scannedItems.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h4 className="font-bold text-gray-800">Kết quả: {scannedItems.length} mục</h4>
                                <button onClick={handleCreate} disabled={scanning} className="px-4 py-2 bg-rose-500 text-white rounded-lg text-sm font-bold hover:bg-rose-600">
                                    Tạo Phiếu Truy Thu
                                </button>
                            </div>
                            <div className="max-h-96 overflow-y-auto p-4">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase font-bold sticky top-0 bg-white">
                                        <tr>
                                            <th>Sản phẩm</th>
                                            <th className="text-center">SL Thiếu</th>
                                            <th className="text-right">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {scannedItems.map((item, i) => (
                                            <tr key={i}>
                                                <td className="py-2">{item.product_name}</td>
                                                <td className="py-2 text-center text-red-500 font-bold">{item.missing_qty}</td>
                                                <td className="py-2 text-right">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.total_amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'MANAGE' && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-xs font-bold text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-3">Sản phẩm</th>
                                <th className="px-6 py-3 text-center">SL</th>
                                <th className="px-6 py-3 text-right">Tổng tiền</th>
                                <th className="px-6 py-3">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr><td colSpan={4} className="p-4 text-center">Đang tải...</td></tr>
                            ) : recoveryItems.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center text-gray-400">Chưa có phiếu truy thu nào</td></tr>
                            ) : (
                                recoveryItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-3">
                                            <p className="font-bold text-gray-800">{item.product_name}</p>
                                            <p className="text-xs text-gray-500">{item.check_date} • {item.store_name}</p>
                                        </td>
                                        <td className="px-6 py-3 text-center font-bold text-red-600">-{item.missing_qty}</td>
                                        <td className="px-6 py-3 text-right font-bold text-gray-800">
                                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.total_amount)}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${item.status === 'TRUY THU' ? 'bg-red-100 text-red-600 border-red-200' : 'bg-green-100 text-green-600 border-green-200'
                                                }`}>{item.status}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default InventoryAdmin;
