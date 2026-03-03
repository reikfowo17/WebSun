import React, { useState, useEffect, useCallback } from 'react';
import { SystemService, ShiftConfig, StoreConfig, EmployeeConfig, ExpiryConfigItem, ProductConfig } from '../../services/system';
import PortalHeader from '../../components/PortalHeader';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import '../../styles/hq-sidebar.css';
import '../../styles/settings.css';
import { SettingsShifts } from './SettingsShifts';
import { SettingsStores } from './SettingsStores';
import { SettingsEmployees } from './SettingsEmployees';
import { SettingsExpiryConfig } from './SettingsExpiryConfig';
import { SettingsProducts } from './SettingsProducts';
import { SettingsNotifications } from './SettingsNotifications';
import { SettingsGeneral } from './SettingsGeneral';

interface SettingsTabProps {
    toast: any;
}

type SettingsSection = 'shifts' | 'stores' | 'employees' | 'expiry' | 'products' | 'notifications' | 'general';

const SECTION_META: Record<SettingsSection, { label: string; desc: string; icon: string }> = {
    shifts: { label: 'Ca Làm Việc', desc: 'Khung giờ & quy trình', icon: 'schedule' },
    stores: { label: 'Cửa Hàng', desc: 'Danh sách cơ sở', icon: 'storefront' },
    products: { label: 'Sản Phẩm', desc: 'Danh mục & quản lý SP', icon: 'inventory_2' },
    expiry: { label: 'Cấu hình HSD', desc: 'Kiểm soát hạn sử dụng', icon: 'event_available' },
    employees: { label: 'Nhân Viên', desc: 'Phân quyền & chi nhánh', icon: 'badge' },
    notifications: { label: 'Thông Báo', desc: 'Cấu hình thông báo', icon: 'notifications' },
    general: { label: 'Cài Đặt Chung', desc: 'Tên hệ thống, múi giờ', icon: 'tune' },
};

const SettingsTab: React.FC<SettingsTabProps> = ({ toast }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [employees, setEmployees] = useState<EmployeeConfig[]>([]);
    const [expiryConfigs, setExpiryConfigs] = useState<ExpiryConfigItem[]>([]);
    const [products, setProducts] = useState<ProductConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<SettingsSection>('shifts');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedShifts, fetchedStores, fetchedEmployees, fetchedExpiry, fetchedProducts] = await Promise.all([
                SystemService.getShifts(),
                SystemService.getStores(),
                SystemService.getEmployees(),
                SystemService.getExpiryConfigs(),
                SystemService.getProducts(),
            ]);
            setShifts(fetchedShifts);
            setStores(fetchedStores);
            setEmployees(fetchedEmployees);
            setExpiryConfigs(fetchedExpiry);
            setProducts(fetchedProducts);
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
            label: 'KIỂM SOÁT',
            items: [
                { id: 'products', label: 'Sản Phẩm', badge: products.length },
                { id: 'expiry', label: 'Cấu hình HSD', badge: expiryConfigs.length },
            ]
        },
        {
            label: 'NHÂN SỰ',
            items: [
                { id: 'employees', label: 'Nhân Viên', badge: employees.length },
            ]
        },
        {
            label: 'NÂNG CAO',
            items: [
                { id: 'notifications', label: 'Thông Báo' },
                { id: 'general', label: 'Cài Đặt Chung' },
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
            case 'expiry':
                return <SettingsExpiryConfig toast={toast} initialConfigs={expiryConfigs} allStores={stores} />;
            case 'products':
                return <SettingsProducts toast={toast} initialProducts={products} />;
            case 'notifications':
                return <SettingsNotifications toast={toast} />;
            case 'general':
                return <SettingsGeneral toast={toast} />;
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
