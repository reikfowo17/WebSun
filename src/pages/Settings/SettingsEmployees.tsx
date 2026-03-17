import React, { useState, useCallback, useMemo } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import { SystemService, EmployeeConfig, UserStoreAssignment, StoreConfig } from '../../services/system';
import ConfirmDialog from '../../components/ConfirmDialog';

interface SettingsEmployeesProps {
    toast: ToastContextType;
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
    const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

    // Table Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
        setConfirmDialog({
            title: 'Xóa chi nhánh',
            message: `Xóa chi nhánh "${storeName}" khỏi nhân viên này?`,
            onConfirm: async () => {
                setConfirmDialog(null);
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
            },
        });
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

    const assignedStoreIds = assignments.map(a => a.store_id);
    const availableStores = allStores.filter(s => !assignedStoreIds.includes(s.id) && s.is_active !== false);

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return emp.name.toLowerCase().includes(q) ||
                emp.employee_id?.toLowerCase().includes(q) ||
                emp.username?.toLowerCase().includes(q);
        });
    }, [employees, searchQuery]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredEmployees.map(e => e.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const allSelected = filteredEmployees.length > 0 && selectedIds.length === filteredEmployees.length;

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap" style={{ position: 'relative' }}>
                {/* ─── Toolbar ─── */}
                <div className="stg-toolbar">
                    <div className="stg-toolbar-left" style={{ gap: 12 }}>
                        <button className="stg-btn stg-btn-outline" style={{ background: '#fff', gap: 8, padding: '8px 12px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6B7280' }}>table_view</span>
                            Table View
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9CA3AF' }}>expand_more</span>
                        </button>
                        <button className="stg-btn stg-btn-outline" style={{ background: '#fff', gap: 8, padding: '8px 12px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6B7280' }}>filter_list</span>
                            Filter
                        </button>
                        <button className="stg-btn stg-btn-outline" style={{ background: '#fff', gap: 8, padding: '8px 12px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#6B7280' }}>swap_vert</span>
                            Sort
                        </button>
                    </div>
                    <div className="stg-toolbar-right" style={{ flex: 1, maxWidth: 320 }}>
                        <div className="stg-search-wrap" style={{ width: '100%' }}>
                            <span className="material-symbols-outlined stg-search-icon">search</span>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="stg-search-input"
                                placeholder="Tìm kiếm nhân viên..."
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Table ─── */}
                <div style={{ maxHeight: 600, overflowY: 'auto' }}>
                    <table className="stg-table">
                        <thead>
                            <tr>
                                <th style={{ width: 44, paddingLeft: 20 }}>
                                    <input
                                        type="checkbox"
                                        className="stg-checkbox"
                                        checked={allSelected}
                                        onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                </th>
                                <th>Nhân viên</th>
                                <th>Mã NV / Username</th>
                                <th>Vị trí</th>
                                <th style={{ width: 80, textAlign: 'right' }}>Thao tác</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={5}>
                                        <div className="stg-empty">
                                            <span className="material-symbols-outlined">person_off</span>
                                            <p>{searchQuery ? 'Không tìm thấy nhân viên' : 'Chưa có nhân viên nào'}</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp) => {
                                    const isExpanded = expandedUserId === emp.id;
                                    const isSelected = selectedIds.includes(emp.id);
                                    const isAdmin = emp.role === 'ADMIN';

                                    return (
                                        <React.Fragment key={emp.id}>
                                            <tr className={`stg-table-row ${isSelected ? 'selected' : ''}`}>
                                                <td style={{ paddingLeft: 20 }}>
                                                    <input
                                                        type="checkbox"
                                                        className="stg-checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => handleSelectOne(emp.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div className={`stg-emp-avatar ${isAdmin ? 'admin' : 'staff'}`} style={{ width: 36, height: 36, fontSize: 13, cursor: 'pointer' }} onClick={() => handleExpandEmployee(emp.id)}>
                                                            {emp.name?.charAt(0) || '?'}
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: isSelected ? '#3730A3' : '#111827', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => handleExpandEmployee(emp.id)}>
                                                                {emp.name}
                                                                <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#9CA3AF' }}>arrow_outward</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ color: '#4B5563' }}>
                                                    {emp.employee_id} <span style={{ color: '#9CA3AF', margin: '0 4px' }}>•</span> {emp.username}
                                                </td>
                                                <td>
                                                    <span className={`stg-role-badge ${isAdmin ? 'admin' : 'staff'}`}>
                                                        {isAdmin ? 'MƯỚN NHÂN VIÊN' : emp.role}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button
                                                        onClick={() => handleExpandEmployee(emp.id)}
                                                        className="stg-btn-icon"
                                                        title="Gán phân ca / chi nhánh"
                                                        style={{ display: 'inline-flex' }}
                                                    >
                                                        <span className={`material-symbols-outlined stg-emp-expand-icon ${isExpanded ? 'expanded' : ''}`} style={{ fontSize: 20 }}>
                                                            expand_more
                                                        </span>
                                                    </button>
                                                </td>
                                            </tr>

                                            {/* Expand row for Store Assignment */}
                                            {isExpanded && (
                                                <tr className="stg-expand-row">
                                                    <td colSpan={5} style={{ padding: 0 }}>
                                                        <div className="stg-expand-inner">
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
                                                                        <div style={{ padding: '0 0 12px 0', color: 'var(--stg-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                                                                            Chưa được gán chi nhánh nào
                                                                        </div>
                                                                    )}

                                                                    <div className="stg-chips-grid" style={{ marginBottom: 16 }}>
                                                                        {assignments.map((assignment) => (
                                                                            <div key={assignment.id} className={`stg-store-chip${assignment.is_primary ? ' primary' : ''}`}>
                                                                                <span className="material-symbols-outlined stg-chip-icon">
                                                                                    {assignment.is_primary ? 'star' : 'storefront'}
                                                                                </span>
                                                                                <span className="stg-chip-code">{assignment.store?.code || '?'}</span>
                                                                                <span className="stg-chip-name">{assignment.store?.name || 'Chi nhánh'}</span>
                                                                                {assignment.is_primary && <span className="stg-chip-primary-tag">CHÍNH</span>}
                                                                                {!assignment.is_primary && (
                                                                                    <button onClick={() => handleSetPrimary(emp.id, assignment.id)} className="stg-btn-icon" title="Đặt làm chi nhánh chính" disabled={saving} style={{ width: 28, height: 28 }}>
                                                                                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>star_outline</span>
                                                                                    </button>
                                                                                )}
                                                                                <button onClick={() => handleRemoveStore(emp.id, assignment.id, assignment.store?.name || '')} className="stg-btn-icon stg-btn-danger" title="Xóa chi nhánh" disabled={saving} style={{ width: 28, height: 28 }}>
                                                                                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    {addingStoreForUser === emp.id ? (
                                                                        <div className="stg-add-store-form">
                                                                            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)} className="stg-input" style={{ flex: 1, maxWidth: 300 }}>
                                                                                <option value="">— Chọn chi nhánh —</option>
                                                                                {availableStores.map(s => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
                                                                            </select>
                                                                            <button onClick={() => handleAddStore(emp.id)} className="stg-btn stg-btn-primary stg-emerald" disabled={saving || !selectedStoreId}>
                                                                                {saving ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 14 }}>progress_activity</span> : <span className="material-symbols-outlined" style={{ fontSize: 14 }}>check</span>}
                                                                                Thêm
                                                                            </button>
                                                                            <button onClick={() => { setAddingStoreForUser(null); setSelectedStoreId(''); }} className="stg-btn stg-btn-outline">
                                                                                Hủy
                                                                            </button>
                                                                        </div>
                                                                    ) : (
                                                                        <button onClick={() => { setAddingStoreForUser(emp.id); setSelectedStoreId(''); }} className="stg-btn stg-btn-outline stg-emerald" disabled={saving || availableStores.length === 0} style={{ fontSize: 12, padding: '8px 16px' }}>
                                                                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
                                                                            Thêm chi nhánh
                                                                        </button>
                                                                    )}
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                    
                    <div style={{ padding: '16px 20px', borderTop: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', color: '#6B7280', fontSize: 13, background: '#fff' }}>
                        Showing {filteredEmployees.length > 0 ? 1 : 0}-{filteredEmployees.length} of {employees.length} entries
                    </div>
                </div>

                {/* ─── Floating Action Bar ─── */}
                {selectedIds.length > 0 && (
                    <div className="stg-floating-bar stg-floating-animate">
                        <span className="stg-floating-count" style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8, background: '#F3F4F6', padding: '4px 8px', borderRadius: 6 }}>
                            <span style={{ fontWeight: 800, color: '#111827' }}>{selectedIds.length}</span> Selected
                        </span>
                        <div className="stg-floating-actions">
                            <button onClick={() => toast.success('Phím tắt: Gửi email cho ' + selectedIds.length + ' nhân viên')} className="stg-btn stg-btn-outline" style={{ border: 'none', background: 'transparent' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span>
                                Send Email
                            </button>
                            <button onClick={() => toast.error('Phím tắt: Xóa ' + selectedIds.length + ' nhân viên (Tính năng đang khóa)')} className="stg-btn stg-btn-danger" style={{ border: 'none', background: 'transparent', color: '#DC2626' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                                Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {confirmDialog && (
                <ConfirmDialog
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    onConfirm={confirmDialog.onConfirm}
                    onCancel={() => setConfirmDialog(null)}
                />
            )}
        </div>
    );
};

