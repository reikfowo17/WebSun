import React, { useState, useEffect } from 'react';
import { ToastContextType } from '../../contexts/ToastContext';
import { SystemService, GeneralSettings } from '../../services/system';

interface Props {
    toast: ToastContextType;
}

const DEFAULTS: GeneralSettings = { system_name: 'SunMart', timezone: 'Asia/Ho_Chi_Minh' };
const TIMEZONES = [
    { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (GMT+7)' },
    { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
    { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
    { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
];

export const SettingsGeneral: React.FC<Props> = ({ toast }) => {
    const [config, setConfig] = useState<GeneralSettings>(DEFAULTS);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        (async () => {
            const data = await SystemService.getSetting<GeneralSettings>('general_config');
            if (data) setConfig(data);
            setLoaded(true);
        })();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await SystemService.saveSetting('general_config', config);
            if (res.success) toast.success('Lưu cài đặt chung thành công');
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
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
                        Cài đặt chung
                    </h3>

                    <div className="stg-config-row">
                        <div className="stg-config-label">
                            <strong>Tên hệ thống</strong>
                            <span className="stg-config-desc">Hiển thị trên giao diện, tiêu đề trang</span>
                        </div>
                        <div className="stg-config-control">
                            <input type="text" value={config.system_name}
                                onChange={e => setConfig(c => ({ ...c, system_name: e.target.value }))}
                                className="stg-input" style={{ width: 200 }} placeholder="SunMart" />
                        </div>
                    </div>

                    <div className="stg-config-row">
                        <div className="stg-config-label">
                            <strong>Múi giờ</strong>
                            <span className="stg-config-desc">Ảnh hưởng tới tính ngày kiểm kho, lịch làm việc</span>
                        </div>
                        <div className="stg-config-control">
                            <select value={config.timezone}
                                onChange={e => setConfig(c => ({ ...c, timezone: e.target.value }))}
                                className="stg-input" style={{ width: 200 }}>
                                {TIMEZONES.map(tz => (
                                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--stg-border)' }}>
                        <button onClick={handleSave} disabled={saving} className="stg-btn stg-btn-primary">
                            {saving
                                ? <span className="material-symbols-outlined stg-spin" style={{ fontSize: 16 }}>progress_activity</span>
                                : <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                            }
                            {saving ? 'Đang lưu...' : 'Lưu cài đặt'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
