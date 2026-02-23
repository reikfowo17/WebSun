import React, { useState, useCallback } from 'react';
import { SystemService, EmployeeConfig, UserStoreAssignment, StoreConfig } from '../../services/system';

interface SettingsEmployeesProps {
    toast: any;
    initialEmployees: EmployeeConfig[];
    allStores: StoreConfig[];
}

export const SettingsEmployees: React.FC<SettingsEmployeesProps> = ({ toast, initialEmployees, allStores }) => {
    const [employees] = useState<EmployeeConfig[]>(initialEmployees);
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [assignments, setAssignments] = useState<UserStoreAssignment[]>([]);
    const [loadingStores, setLoadingStores] = useState(false);
    const [saving, setSaving] = useState(false);
    const [addingStoreForUser, setAddingStoreForUser] = useState<string | null>(null);
    const [selectedStoreId, setSelectedStoreId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const loadAssignments = useCallback(async (userId: string) => {
        setLoadingStores(true);
        try {
            const data = await SystemService.getEmployeeStores(userId);
            setAssignments(data);
        } catch (e: unknown) {
            toast.error('Lỗi tải chi nhánh: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoadingStores(false);
        }
    }, [toast]);

    const handleExpandEmployee = useCallback((userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            setAssignments([]);
            setAddingStoreForUser(null);
        } else {
            setExpandedUserId(userId);
            loadAssignments(userId);
            setAddingStoreForUser(null);
        }
    }, [expandedUserId, loadAssignments]);

    const handleAddStore = async (userId: string) => {
        if (!selectedStoreId) {
            toast.error('Vui lòng chọn chi nhánh');
            return;
        }
        setSaving(true);
        try {
            const res = await SystemService.addEmployeeStore(userId, selectedStoreId);
            if (res.success) {
                toast.success('Đã thêm chi nhánh cho nhân viên');
                await loadAssignments(userId);
                setSelectedStoreId('');
                setAddingStoreForUser(null);
            } else {
                toast.error(res.message || 'Thêm chi nhánh thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveStore = async (userId: string, assignmentId: string, storeName: string) => {
        if (!window.confirm(`Xóa chi nhánh "${storeName}" khỏi nhân viên này?`)) return;
        setSaving(true);
        try {
            const res = await SystemService.removeEmployeeStore(assignmentId);
            if (res.success) {
                toast.success('Đã xóa chi nhánh');
                await loadAssignments(userId);
            } else {
                toast.error(res.message || 'Xóa thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    const handleSetPrimary = async (userId: string, assignmentId: string) => {
        setSaving(true);
        try {
            const res = await SystemService.setEmployeePrimaryStore(userId, assignmentId);
            if (res.success) {
                toast.success('Đã đặt chi nhánh chính');
                await loadAssignments(userId);
            } else {
                toast.error(res.message || 'Cập nhật thất bại');
            }
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setSaving(false);
        }
    };

    // Available stores to add (not already assigned)
    const assignedStoreIds = assignments.map(a => a.store_id);
    const availableStores = allStores.filter(s => !assignedStoreIds.includes(s.id) && s.is_active !== false);

    // Filter employees by search query
    const filteredEmployees = employees.filter(emp => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return emp.name.toLowerCase().includes(q) ||
            emp.employee_id?.toLowerCase().includes(q) ||
            emp.username?.toLowerCase().includes(q);
    });

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                {/* ─── Toolbar ─── */}
                <div className="stg-toolbar">
                    <div className="stg-toolbar-left">
                        <div className="stg-search-wrap">
                            <span className="material-symbols-outlined stg-search-icon">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="stg-search-input"
                                placeholder="Tìm nhân viên theo tên, mã, username..."
                                aria-label="Tìm kiếm nhân viên"
                            />
                        </div>
                    </div>
                    <div className="stg-toolbar-right">
                        <span className="stg-badge">{employees.length} nhân viên</span>
                    </div>
                </div>

                {/* ─── Employee List ─── */}
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                    {filteredEmployees.map((emp) => {
                        const isExpanded = expandedUserId === emp.id;
                        const isAdmin = emp.role === 'ADMIN';
                        return (
                            <div key={emp.id}>
                                {/* ─ Employee Row ─ */}
                                <div
                                    className={`stg-emp-row${isExpanded ? ' expanded' : ''}`}
                                    onClick={() => handleExpandEmployee(emp.id)}
                                >
                                    {/* Avatar */}
                                    <div className={`stg-emp-avatar ${isAdmin ? 'admin' : 'staff'}`}>
                                        {emp.name?.charAt(0) || '?'}
                                    </div>

                                    {/* Info */}
                                    <div className="stg-emp-info">
                                        <div className="stg-emp-name">
                                            <span>{emp.name}</span>
                                            <span className={`stg-role-badge ${isAdmin ? 'admin' : 'staff'}`}>
                                                {isAdmin ? 'ADMIN' : 'NHÂN VIÊN'}
                                            </span>
                                        </div>
                                        <div className="stg-emp-meta">
                                            {emp.employee_id && <span>Mã: {emp.employee_id} · </span>}
                                            <span>@{emp.username}</span>
                                        </div>
                                    </div>

                                    {/* Expand arrow */}
                                    <span className={`material-symbols-outlined stg-emp-expand-icon${isExpanded ? ' expanded' : ''}`}>
                                        expand_more
                                    </span>
                                </div>

                                {/* ─ Expanded: Store assignments ─ */}
                                {isExpanded && (
                                    <div className="stg-expand-panel">
                                        <div className="stg-expand-label">
                                            Chi nhánh được gán
                                        </div>

                                        {loadingStores ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0', color: 'var(--stg-text-muted)', fontSize: 13 }}>
                                                <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                                Đang tải...
                                            </div>
                                        ) : (
                                            <>
                                                {assignments.length === 0 && (
                                                    <div style={{ padding: '12px 0', color: 'var(--stg-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                                                        Chưa được gán chi nhánh nào
                                                    </div>
                                                )}

                                                {/* Store chips */}
                                                <div className="stg-chips-grid">
                                                    {assignments.map((assignment) => (
                                                        <div
                                                            key={assignment.id}
                                                            className={`stg-store-chip${assignment.is_primary ? ' primary' : ''}`}
                                                        >
                                                            <span className="material-symbols-outlined stg-chip-icon">
                                                                {assignment.is_primary ? 'star' : 'storefront'}
                                                            </span>

                                                            <span className="stg-chip-code">
                                                                {assignment.store?.code || '?'}
                                                            </span>
                                                            <span className="stg-chip-name">
                                                                {assignment.store?.name || 'Chi nhánh'}
                                                            </span>

                                                            {assignment.is_primary && (
                                                                <span className="stg-chip-primary-tag">CHÍNH</span>
                                                            )}

                                                            {!assignment.is_primary && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(emp.id, assignment.id); }}
                                                                    className="stg-btn-icon"
                                                                    title="Đặt làm chi nhánh chính"
                                                                    disabled={saving}
                                                                    style={{ width: 28, height: 28 }}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>star_outline</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveStore(emp.id, assignment.id, assignment.store?.name || ''); }}
                                                                className="stg-btn-icon stg-btn-danger"
                                                                title="Xóa chi nhánh"
                                                                disabled={saving}
                                                                style={{ width: 28, height: 28 }}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Add store row */}
                                                {addingStoreForUser === emp.id ? (
                                                    <div className="stg-add-store-form">
                                                        <select
                                                            value={selectedStoreId}
                                                            onChange={(e) => setSelectedStoreId(e.target.value)}
                                                            className="stg-input"
                                                            style={{ flex: 1, maxWidth: 300 }}
                                                        >
                                                            <option value="">— Chọn chi nhánh —</option>
                                                            {availableStores.map(s => (
                                                                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleAddStore(emp.id)}
                                                            className="stg-btn stg-btn-primary stg-emerald"
                                                            disabled={saving || !selectedStoreId}
                                                        >
                                                            {saving
                                                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 14 }}>progress_activity</span>
                                                                : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>
                                                            }
                                                            Thêm
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingStoreForUser(null); setSelectedStoreId(''); }}
                                                            className="stg-btn stg-btn-outline"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAddingStoreForUser(emp.id); setSelectedStoreId(''); }}
                                                        className="stg-btn stg-btn-outline stg-emerald"
                                                        disabled={saving || availableStores.length === 0}
                                                        style={{ fontSize: 12, padding: '6px 14px' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span>
                                                        Thêm chi nhánh
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ─── Empty State ─── */}
                {filteredEmployees.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">person_off</span>
                        <p>{searchQuery ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có nhân viên nào'}</p>
                        {searchQuery && (
                            <p style={{ fontSize: 12 }}>Thử tìm kiếm với từ khóa khác</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
