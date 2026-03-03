import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { User, Store } from '../../types';
import { useToast } from '../../contexts';
import { supabase } from '../../lib/supabase';
import SubSidebar, { SubSidebarGroup } from '../../components/SubSidebar';
import { SettingsChecklist } from '../Settings/SettingsChecklist';
import { SettingsHandoverProducts } from '../Settings/SettingsHandoverProducts';
import { SettingsAssets } from '../Settings/SettingsAssets';
import { TaskMonitor } from './TaskMonitor';
import '../../styles/hq-sidebar.css';
import '../../styles/settings.css';

/* ═══════════════════════════════════════════════
   TASK HQ — Nhiệm Vụ Trong Ca
   ═══════════════════════════════════════════════ */

type TaskSection = 'monitor' | 'checklist' | 'handover' | 'assets';

const TAB_META: Record<TaskSection, { label: string; desc: string }> = {
    monitor: { label: 'Giám Sát Tiến Độ', desc: 'Xem tiến độ nhiệm vụ trong ca' },
    checklist: { label: 'Cấu Hình Công Việc', desc: 'Thiết lập checklist theo ca & thứ' },
    handover: { label: 'Kiểm Tồn Giao Ca', desc: 'Danh sách SP cố định kiểm tồn' },
    assets: { label: 'Vật Tư Cửa Hàng', desc: 'Công cụ & thiết bị kiểm kê' },
};

const TaskHQ: React.FC<{ user: User }> = ({ user }) => {
    const toast = useToast();
    const [activeSection, setActiveSection] = useState<TaskSection>('monitor');
    const [topbarNode, setTopbarNode] = useState<HTMLElement | null>(null);
    const [stores, setStores] = useState<Store[]>([]);
    const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
    }, []);

    // Load stores
    useEffect(() => {
        const loadStores = async () => {
            const { data } = await supabase
                .from('stores')
                .select('id, code, name')
                .eq('is_active', true)
                .order('sort_order');
            setStores((data as Store[]) || []);
        };
        loadStores();
    }, []);

    const sidebarGroups: SubSidebarGroup[] = [
        {
            label: 'GIÁM SÁT',
            items: [
                { id: 'monitor', label: 'Tiến Độ Nhiệm Vụ' },
            ]
        },
        {
            label: 'CẤU HÌNH',
            items: [
                { id: 'checklist', label: 'Công Việc Trong Ca' },
                { id: 'handover', label: 'Kiểm Tồn Giao Ca' },
                { id: 'assets', label: 'Vật Tư Cửa Hàng' },
            ]
        },
    ];

    const meta = TAB_META[activeSection];

    // Store filter — shown in config tabs
    const storeFilter = activeSection !== 'monitor' ? (
        <div className="hq-store-filter">
            <span className="material-symbols-outlined hq-store-filter-icon">storefront</span>
            <div className="hq-store-filter-body">
                <div className="hq-store-filter-label">Cửa hàng</div>
                <select
                    className="hq-store-filter-select"
                    value={selectedStoreId}
                    onChange={e => setSelectedStoreId(e.target.value)}
                >
                    <option value="all">🌐 Tất cả (chung)</option>
                    {stores.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                </select>
            </div>
        </div>
    ) : null;

    const renderContent = () => {
        // Pass storeId to config components (undefined = all stores)
        const storeId = selectedStoreId !== 'all' ? selectedStoreId : undefined;

        switch (activeSection) {
            case 'monitor':
                return <TaskMonitor user={user} toast={toast} />;
            case 'checklist':
                return <SettingsChecklist toast={toast} storeId={storeId} key={selectedStoreId} />;
            case 'handover':
                return <SettingsHandoverProducts toast={toast} storeId={storeId} key={selectedStoreId} />;
            case 'assets':
                return <SettingsAssets toast={toast} storeId={storeId} key={selectedStoreId} />;
            default:
                return null;
        }
    };

    return (
        <div className="hq-page">
            {/* Breadcrumb */}
            {topbarNode && createPortal(
                <div className="hq-breadcrumb">
                    <span className="material-symbols-outlined hq-breadcrumb-icon">checklist</span>
                    <span className="hq-breadcrumb-title">Nhiệm Vụ Trong Ca</span>
                    <span className="material-symbols-outlined hq-breadcrumb-sep">chevron_right</span>
                    <span className="hq-breadcrumb-current">{meta.label}</span>
                </div>,
                topbarNode
            )}

            <div className="hq-layout">
                <SubSidebar
                    title="Quản Lý Nhiệm Vụ"
                    groups={sidebarGroups}
                    activeId={activeSection}
                    onSelect={(id) => setActiveSection(id as TaskSection)}
                    footer={storeFilter}
                />
                <div className="hq-content" key={activeSection}>
                    <div className="hq-section-animate">
                        {renderContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TaskHQ;
