import React from 'react';
export interface SubSidebarItem {
    id: string;
    label: string;
    badge?: number | string;
    badgeColor?: 'amber' | 'danger' | 'emerald' | 'muted';
}

export interface SubSidebarGroup {
    label: string;
    items: SubSidebarItem[];
}

interface SubSidebarProps {
    title: string;
    groups: SubSidebarGroup[];
    activeId: string;
    onSelect: (id: string) => void;
    footer?: React.ReactNode;
}

const SubSidebar: React.FC<SubSidebarProps> = ({ title, groups, activeId, onSelect, footer }) => {
    return (
        <aside className="hq-sidebar" role="navigation">
            {/* Page Title */}
            <div className="hq-sidebar-title">{title}</div>

            {/* Navigation Groups */}
            <div className="hq-sidebar-nav">
                {groups.map((group, gi) => (
                    <div key={group.label} className="hq-sidebar-group">
                        <div className="hq-sidebar-group-label">{group.label}</div>
                        {group.items.map(item => {
                            const isActive = activeId === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onSelect(item.id)}
                                    className={`hq-sidebar-item${isActive ? ' active' : ''}`}
                                    aria-selected={isActive}
                                    role="tab"
                                >
                                    <span className="hq-sidebar-label">{item.label}</span>
                                    {item.badge !== undefined && (
                                        <span className={`hq-sidebar-badge${item.badgeColor ? ` ${item.badgeColor}` : ''}`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Footer (date picker, etc.) */}
            {footer && (
                <div className="hq-sidebar-footer">
                    {footer}
                </div>
            )}
        </aside>
    );
};

export default SubSidebar;
