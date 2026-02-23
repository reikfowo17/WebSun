import React, { useState, useEffect, useCallback } from 'react';
import { SystemService, ShiftConfig, StoreConfig, EmployeeConfig } from '../../services/system';
import PortalHeader from '../../components/PortalHeader';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import '../../styles/hq-sidebar.css';
import '../../styles/settings.css';
import { SettingsShifts } from './SettingsShifts';
import { SettingsStores } from './SettingsStores';
import { SettingsEmployees } from './SettingsEmployees';

interface SettingsTabProps {
    toast: any;
}

type SettingsSection = 'shifts' | 'stores' | 'employees';

const SECTION_META: Record<SettingsSection, { label: string; desc: string }> = {
    shifts: { label: 'Ca Làm Việc', desc: 'Khung giờ & quy trình' },
    stores: { label: 'Cửa Hàng', desc: 'Danh sách cơ sở' },
    employees: { label: 'Nhân Viên', desc: 'Phân quyền & chi nhánh' },
};

const SettingsTab: React.FC<SettingsTabProps> = ({ toast }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [employees, setEmployees] = useState<EmployeeConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<SettingsSection>('shifts');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedShifts, fetchedStores, fetchedEmployees] = await Promise.all([
                SystemService.getShifts(),
                SystemService.getStores(),
                SystemService.getEmployees()
            ]);
            setShifts(fetchedShifts);
            setStores(fetchedStores);
            setEmployees(fetchedEmployees);
        } catch (e: unknown) {
            toast.error('Lỗi khi tải cấu hình: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setLoading(false);
        }
    };

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'HỆ THỐNG',
            items: [
                { id: 'shifts', label: 'Ca Làm Việc', badge: shifts.length },
                { id: 'stores', label: 'Cửa Hàng', badge: stores.length },
            ]
        },
        {
            label: 'NHÂN SỰ',
            items: [
                { id: 'employees', label: 'Nhân Viên', badge: employees.length },
            ]
        }
    ];

    const meta = SECTION_META[activeSection];

    const renderSkeletonLoader = useCallback(() => (
        <div className="hq-skeleton">
            <div className="hq-sk-wrap">
                <div className="hq-sk-toolbar">
                    <div className="hq-sk-pill" />
                    <div style={{ flex: 1 }} />
                    <div className="hq-sk-btn" />
                    <div className="hq-sk-btn" />
                </div>
                <div className="hq-sk-table-head" />
                <div className="hq-sk-body">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="hq-sk-row">
                            <div className="hq-sk-circle" />
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                                <div className="hq-sk-line" style={{ width: `${70 - i * 10}%` }} />
                                <div className="hq-sk-line" style={{ width: `${40 + i * 5}%`, height: 10 }} />
                            </div>
                            <div className="hq-sk-pill" style={{ width: 48 }} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    ), []);

    const renderContent = () => {
        if (loading) return renderSkeletonLoader();
        switch (activeSection) {
            case 'shifts':
                return <SettingsShifts toast={toast} initialShifts={shifts} />;
            case 'stores':
                return <SettingsStores toast={toast} initialStores={stores} />;
            case 'employees':
                return <SettingsEmployees toast={toast} initialEmployees={employees} allStores={stores} />;
            default:
                return null;
        }
    };

    return (
        <div className="hq-page">
            {/* Breadcrumb */}
            <PortalHeader>
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">settings</span>
                    <span className="hq-breadcrumb-title">Thiết Lập</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{meta.label}</span>
                </div>
            </PortalHeader>

            <div className="hq-layout">
                <SubSidebar
                    title="Cấu Hình Hệ Thống"
                    groups={sidebarGroups}
                    activeId={activeSection}
                    onSelect={(id) => setActiveSection(id as SettingsSection)}
                />
                <div className="hq-content" key={activeSection}>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default SettingsTab;
