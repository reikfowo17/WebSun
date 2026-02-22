import React, { useState, useEffect, useCallback } from 'react';
import { SystemService, ShiftConfig, StoreConfig } from '../services/system';
import PortalHeader from '../components/PortalHeader';
import '../styles/settings.css';
import { SettingsShifts } from './Settings/SettingsShifts';
import { SettingsStores } from './Settings/SettingsStores';

interface SettingsTabProps {
    toast: any;
}

type SettingsSection = 'shifts' | 'stores';

const SettingsTab: React.FC<SettingsTabProps> = ({ toast }) => {
    const [shifts, setShifts] = useState<ShiftConfig[]>([]);
    const [stores, setStores] = useState<StoreConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeSection, setActiveSection] = useState<SettingsSection>('shifts');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [fetchedShifts, fetchedStores] = await Promise.all([
                SystemService.getShifts(),
                SystemService.getStores()
            ]);
            setShifts(fetchedShifts);
            setStores(fetchedStores);
        } catch (e: any) {
            toast.error('Lỗi khi tải cấu hình: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const NAV_ITEMS: { id: SettingsSection; label: string; icon: string; desc: string; count?: number }[] = [
        { id: 'shifts', label: 'CA LÀM', icon: 'schedule', desc: 'Khung giờ & quy trình', count: shifts.length },
        { id: 'stores', label: 'CỬA HÀNG', icon: 'storefront', desc: 'Danh mục cơ sở', count: stores.length },
    ];

    const renderSkeletonLoader = useCallback(() => (
        <div className="stg-skeleton">
            <div className="stg-sk-header" />
            <div className="stg-sk-body">
                <div className="stg-sk-line" style={{ width: '75%' }} />
                <div className="stg-sk-line" style={{ width: '50%' }} />
                <div className="stg-sk-card" />
                <div className="stg-sk-card" />
            </div>
        </div>
    ), []);

    return (
        <div className="stg-root">
            {/* ─── Tabs injected into global topbar via Portal ─── */}
            <PortalHeader>
                <div className="stg-portal-tabs">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveSection(item.id)}
                            className={`stg-tab${activeSection === item.id ? ' active' : ''}`}
                        >
                            <span className="material-symbols-outlined stg-tab-icon">{item.icon}</span>
                            <span className="stg-tab-label">{item.label}</span>
                            {item.count !== undefined && (
                                <span className="stg-tab-badge">{item.count}</span>
                            )}
                        </button>
                    ))}
                </div>
            </PortalHeader>

            {/* ─── Content ─── */}
            <div className="stg-content">
                {loading ? renderSkeletonLoader() : (
                    activeSection === 'shifts'
                        ? <SettingsShifts toast={toast} initialShifts={shifts} />
                        : <SettingsStores toast={toast} initialStores={stores} />
                )}
            </div>
        </div>
    );
};

export default SettingsTab;
