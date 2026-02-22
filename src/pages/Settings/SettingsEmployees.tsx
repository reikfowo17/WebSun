import React, { useState, useEffect, useCallback } from 'react';
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

    const getRoleBadge = (role: string) => {
        if (role === 'ADMIN') {
            return <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>ADMIN</span>;
        }
        return <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px' }}>NHÂN VIÊN</span>;
    };

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0', background: '#fff', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1, maxWidth: '320px' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px' }}>search</span>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="stg-input"
                            placeholder="Tìm nhân viên..."
                            style={{ paddingLeft: '34px', width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0', height: '36px', fontSize: '13px' }}
                        />
                    </div>
                    <div className="stg-badge">{employees.length} nhân viên</div>
                </div>

                {/* Employee List */}
                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {filteredEmployees.map((emp) => {
                        const isExpanded = expandedUserId === emp.id;
                        return (
                            <div key={emp.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                {/* Employee Row */}
                                <div
                                    onClick={() => handleExpandEmployee(emp.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '16px 20px',
                                        cursor: 'pointer',
                                        background: isExpanded ? '#f8fafc' : '#ffffff',
                                        transition: 'all 0.2s',
                                        gap: '16px',
                                    }}
                                    onMouseEnter={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = '#fafbfc'; }}
                                    onMouseLeave={(e) => { if (!isExpanded) (e.currentTarget as HTMLDivElement).style.background = '#ffffff'; }}
                                >
                                    {/* Avatar circle */}
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '50%',
                                        background: `linear-gradient(135deg, ${emp.role === 'ADMIN' ? '#f59e0b, #d97706' : '#3b82f6, #2563eb'})`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#fff',
                                        fontWeight: 700,
                                        fontSize: '15px',
                                        flexShrink: 0,
                                        textTransform: 'uppercase',
                                    }}>
                                        {emp.name?.charAt(0) || '?'}
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                                            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>{emp.name}</span>
                                            {getRoleBadge(emp.role)}
                                        </div>
                                        <div style={{ color: '#94a3b8', fontSize: '12px' }}>
                                            {emp.employee_id && <span>Mã: {emp.employee_id} • </span>}
                                            <span>@{emp.username}</span>
                                        </div>
                                    </div>

                                    {/* Expand arrow */}
                                    <span
                                        className="material-symbols-outlined"
                                        style={{
                                            color: '#94a3b8',
                                            fontSize: '20px',
                                            transition: 'transform 0.3s',
                                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        }}
                                    >expand_more</span>
                                </div>

                                {/* Expanded: Store assignments */}
                                {isExpanded && (
                                    <div style={{
                                        padding: '0 20px 20px 76px',
                                        background: '#f8fafc',
                                        animation: 'fadeIn 0.2s ease',
                                    }}>
                                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
                                            Chi nhánh được gán
                                        </div>

                                        {loadingStores ? (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: '#94a3b8', fontSize: '13px' }}>
                                                <span className="material-symbols-outlined stg-spin" style={{ fontSize: '16px' }}>progress_activity</span>
                                                Đang tải...
                                            </div>
                                        ) : (
                                            <>
                                                {assignments.length === 0 && (
                                                    <div style={{ padding: '12px 0', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
                                                        Chưa được gán chi nhánh nào
                                                    </div>
                                                )}

                                                {/* Store chips */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                                    {assignments.map((assignment) => (
                                                        <div
                                                            key={assignment.id}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '6px',
                                                                padding: '6px 12px',
                                                                borderRadius: '8px',
                                                                background: assignment.is_primary ? '#ecfdf5' : '#ffffff',
                                                                border: `1px solid ${assignment.is_primary ? '#a7f3d0' : '#e2e8f0'}`,
                                                                fontSize: '13px',
                                                                transition: 'all 0.2s',
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined" style={{
                                                                fontSize: '16px',
                                                                color: assignment.is_primary ? '#059669' : '#94a3b8',
                                                            }}>
                                                                {assignment.is_primary ? 'star' : 'storefront'}
                                                            </span>

                                                            <span style={{ fontWeight: 600, color: '#334155' }}>
                                                                {assignment.store?.code || '?'}
                                                            </span>
                                                            <span style={{ color: '#64748b' }}>
                                                                {assignment.store?.name || 'Chi nhánh'}
                                                            </span>

                                                            {assignment.is_primary && (
                                                                <span style={{ background: '#059669', color: '#fff', padding: '1px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 700 }}>
                                                                    CHÍNH
                                                                </span>
                                                            )}

                                                            {!assignment.is_primary && (
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); handleSetPrimary(emp.id, assignment.id); }}
                                                                    className="stg-btn-icon"
                                                                    title="Đặt làm chi nhánh chính"
                                                                    disabled={saving}
                                                                    style={{ width: '28px', height: '28px' }}
                                                                >
                                                                    <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>star_outline</span>
                                                                </button>
                                                            )}

                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleRemoveStore(emp.id, assignment.id, assignment.store?.name || ''); }}
                                                                className="stg-btn-icon stg-btn-danger"
                                                                title="Xóa chi nhánh"
                                                                disabled={saving}
                                                                style={{ width: '28px', height: '28px' }}
                                                            >
                                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>close</span>
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Add store row */}
                                                {addingStoreForUser === emp.id ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <select
                                                            value={selectedStoreId}
                                                            onChange={(e) => setSelectedStoreId(e.target.value)}
                                                            className="stg-input"
                                                            style={{ flex: 1, maxWidth: '300px', height: '36px', borderRadius: '8px', fontSize: '13px', border: '1px solid #e2e8f0' }}
                                                        >
                                                            <option value="">-- Chọn chi nhánh --</option>
                                                            {availableStores.map(s => (
                                                                <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => handleAddStore(emp.id)}
                                                            className="stg-btn stg-btn-primary stg-emerald"
                                                            disabled={saving || !selectedStoreId}
                                                            style={{ height: '36px', fontSize: '13px' }}
                                                        >
                                                            {saving
                                                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: '14px' }}>progress_activity</span>
                                                                : <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>check</span>
                                                            }
                                                            Thêm
                                                        </button>
                                                        <button
                                                            onClick={() => { setAddingStoreForUser(null); setSelectedStoreId(''); }}
                                                            className="stg-btn stg-btn-outline"
                                                            style={{ height: '36px', fontSize: '13px' }}
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setAddingStoreForUser(emp.id); setSelectedStoreId(''); }}
                                                        className="stg-btn stg-btn-outline stg-emerald"
                                                        disabled={saving || availableStores.length === 0}
                                                        style={{ fontSize: '12px', padding: '5px 12px' }}
                                                    >
                                                        <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>add</span>
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

                {filteredEmployees.length === 0 && (
                    <div className="stg-empty">
                        <span className="material-symbols-outlined">person_off</span>
                        <p>{searchQuery ? 'Không tìm thấy nhân viên phù hợp' : 'Chưa có nhân viên nào'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};
