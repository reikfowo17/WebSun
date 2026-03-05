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

    useEffect(() => {
        setTopbarNode(document.getElementById('topbar-left'));
    }, []);

    // Load stores for multi-select in child components
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

    const renderContent = () => {
        switch (activeSection) {
            case 'monitor':
                return <TaskMonitor user={user} toast={toast} />;
            case 'checklist':
                return <SettingsChecklist toast={toast} stores={stores} />;
            case 'handover':
                return <SettingsHandoverProducts toast={toast} stores={stores} />;
            case 'assets':
                return <SettingsAssets toast={toast} stores={stores} />;
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

