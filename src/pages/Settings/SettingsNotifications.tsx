import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import { SystemService, NotificationSettings } from '../../services/system';

interface Props {
    toast: ToastContextType;
}

const DEFAULTS: NotificationSettings = { retention_days: 30, auto_cleanup: true };

export const SettingsNotifications: React.FC<Props> = ({ toast }) => {
    const [config, setConfig] = useState<NotificationSettings>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            const data = await SystemService.getSetting<NotificationSettings>('notification_config');
            if (data) setConfig(data);
            setLoaded(true);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await SystemService.saveSetting('notification_config', config);
            if (res.success) toast.success('Lưu cấu hình thông báo thành công');
            else toast.error(res.message || 'Lưu thất bại');
        } catch (e: unknown) {
            toast.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)));
        } finally { setSaving(false); }
    };

    if (!loaded) return <div className="stg-section-animate"><div className="stg-empty"><span className="material-symbols-outlined stg-spin">hourglass_empty</span><p>Đang tải...</p></div></div>;

    return (
        <div className="stg-section-animate">
            <div className="stg-table-wrap" style={{ padding: 24 }}>
                <div className="stg-config-group">
                    <h3 className="stg-config-title">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications_active</span>
                        Quản lý Thông báo
                    </h3>

                    <div className="stg-config-row">
                        <div className="stg-config-label">
                            <strong>Số ngày lưu trữ</strong>
                            <span className="stg-config-desc">Thông báo đã đọc quá số ngày này sẽ được tự động xoá</span>
                        </div>
                        <div className="stg-config-control">
                            <input type="number" min="7" max="365" value={config.retention_days}
                                onChange={e => setConfig(c => ({ ...c, retention_days: parseInt(e.target.value) || 30 }))}
                                className="stg-input stg-input-mono" style={{ width: 80, textAlign: 'center' }} />
                            <span style={{ fontSize: 13, color: 'var(--stg-text-muted)' }}>ngày</span>
                        </div>
                    </div>

                    <div className="stg-config-row">
                        <div className="stg-config-label">
                            <strong>Tự động dọn dẹp</strong>
                            <span className="stg-config-desc">Bật để hệ thống tự xoá thông báo cũ theo chu kỳ</span>
                        </div>
                        <div className="stg-config-control">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className={`stg-status-dot ${config.auto_cleanup ? 'active' : 'inactive'}`} />
                                <button className={`stg-toggle-btn ${config.auto_cleanup ? 'active' : 'inactive'}`}
                                    onClick={() => setConfig(c => ({ ...c, auto_cleanup: !c.auto_cleanup }))}>
                                    <span className="stg-toggle-knob" />
                                </button>
                                <span className={`stg-status-label ${config.auto_cleanup ? 'active' : 'inactive'}`}>
                                    {config.auto_cleanup ? 'Bật' : 'Tắt'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--stg-border)' }}>
                        <button onClick={handleSave} disabled={saving} className="stg-btn stg-btn-primary">
                            {saving
                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                            }
                            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
