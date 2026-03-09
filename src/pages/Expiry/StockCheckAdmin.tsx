import React, { useState, useEffect } from 'react';
import StockCheckService, { StockCheckCategory } from '../../services/stockCheck';

// ─── Constants & CSS ──────────────────────────────────────────────────────────

const EMPTY_IMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'%3E%3Cpath d='M20 5h-3.17L15 3H9L7.17 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14H4V7h16v12zm-8-3c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0-8c1.65 0 3 1.35 3 3s-1.35 3-3 3-3-1.35-3-3 1.35-3 3-3z'/%3E%3C/svg%3E";

const CSS_ADMIN = `
@keyframes scFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }

.sca-root {
    display: flex; gap: 16px; height: calc(100vh - 80px);
    background: #f8fafc; font-family: 'Inter', sans-serif;
    padding: 16px; box-sizing: border-box; overflow: hidden;
}

/* ── Left Sidebar: Categories ── */
.sca-sidebar {
    width: 280px; background: white; border-radius: 12px;
    border: 1px solid #e5e7eb; display: flex; flex-direction: column;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05); flex-shrink: 0;
}
.sca-sb-header {
    padding: 16px; border-bottom: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
}
.sca-sb-title { font-size: 14px; font-weight: 800; color: #1e293b; text-transform: uppercase; letter-spacing: .05em; }
.sca-btn-add-cat {
    width: 28px; height: 28px; border-radius: 6px; background: #fff;
    border: 1px dashed #cbd5e1; color: #64748b; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: all .2s;
}
.sca-btn-add-cat:hover { border-color: #facc15; color: #eab308; background: #fefce8; }
.sca-btn-add-cat .material-symbols-outlined { font-size: 18px; }

.sca-cat-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 6px; }
.sca-cat-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    border: 1px solid transparent; transition: all .2s;
    background: #fff;
}
.sca-cat-item:hover { background: #f8fafc; border-color: #e5e7eb; }
.sca-cat-item.active { background: #fefce8; border-color: #fde047; box-shadow: 0 2px 4px rgba(250, 204, 21, 0.1); }
.sca-cat-info { display: flex; align-items: center; gap: 10px; overflow: hidden; }
.sca-cat-icon {
    width: 32px; height: 32px; border-radius: 8px;
    background: #f1f5f9; color: #94a3b8;
    display: flex; align-items: center; justify-content: center;
}
.sca-cat-item.active .sca-cat-icon { background: #facc15; color: #fff; }
.sca-cat-icon .material-symbols-outlined { font-size: 18px; }
.sca-cat-name { font-size: 13px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sca-cat-item.active .sca-cat-name { color: #854d0e; }
.sca-cat-status {
    width: 8px; height: 8px; border-radius: 50%;
}
.sca-cat-status.active { background: #22c55e; box-shadow: 0 0 0 3px #dcfce7; }
.sca-cat-status.inactive { background: #cbd5e1; }

/* ── Main Panel ── */
.sca-main {
    flex: 1; background: white; border-radius: 12px; border: 1px solid #e5e7eb;
    display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}
.sca-main-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #94a3b8;
}
.sca-main-empty .material-symbols-outlined { font-size: 48px; color: #cbd5e1; margin-bottom: 16px; }

.sca-main-header {
    padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: flex-start;
}
.sca-mh-left { display: flex; flex-direction: column; gap: 4px; }
.sca-mh-title { font-size: 20px; font-weight: 800; color: #1e293b; display: flex; align-items: center; gap: 8px; }
.sca-mh-desc { font-size: 13px; color: #64748b; }
.sca-toggle-wrap { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.sca-toggle-label { font-size: 13px; font-weight: 600; color: #475569; }
.sca-toggle {
    width: 36px; height: 20px; border-radius: 20px; background: #cbd5e1;
    position: relative; cursor: pointer; transition: background .3s;
}
.sca-toggle.active { background: #22c55e; }
.sca-toggle::after {
    content: ''; position: absolute; top: 2px; left: 2px;
    width: 16px; height: 16px; border-radius: 50%; background: #fff;
    transition: transform .3s; box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}
.sca-toggle.active::after { transform: translateX(16px); }

.sca-mh-actions { display: flex; gap: 8px; }
.sca-btn-save {
    padding: 0 16px; height: 36px; border-radius: 8px; border: none;
    background: #1e293b; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; gap: 6px; transition: background .2s;
}
.sca-btn-save:hover { background: #334155; }
.sca-btn-save:disabled { opacity: .5; cursor: not-allowed; }

/* ── Toolbar ── */
.sca-toolbar {
    padding: 12px 24px; border-bottom: 1px solid #f1f5f9; background: #f8fafc;
    display: flex; justify-content: space-between; align-items: center;
}
.sca-search-bar {
    display: flex; align-items: center; background: #fff;
    border: 1px solid #e5e7eb; border-radius: 8px;
    padding: 0 12px; height: 36px; width: 300px;
}
.sca-search-bar .material-symbols-outlined { color: #94a3b8; font-size: 18px; margin-right: 8px; }
.sca-search-bar input { border: none; outline: none; flex: 1; font-size: 13px; }

/* ── Content Area: Split View ── */
.sca-content { flex: 1; display: flex; overflow: hidden; background: #f8fafc; }

.sca-col { flex: 1; display: flex; flex-direction: column; }
.sca-col.selected { border-right: 1px dotted #cbd5e1; }
.sca-col-header {
    padding: 12px 20px; font-size: 12px; font-weight: 700; color: #475569;
    text-transform: uppercase; letter-spacing: .05em; background: #f1f5f9;
    border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between;
}
.sca-badge { background: #e2e8f0; color: #475569; padding: 2px 8px; border-radius: 12px; font-size: 11px; }
.sca-badge.highlight { background: #fef08a; color: #854d0e; }

.sca-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.sca-prod-item {
    display: flex; align-items: center; padding: 8px 12px;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 8px;
    animation: scFadeIn .2s ease-out; transition: border-color .2s;
}
.sca-prod-item:hover { border-color: #cbd5e1; }
.sca-prod-img {
    width: 40px; height: 40px; border-radius: 6px; object-fit: cover;
    background: #f1f5f9; border: 1px solid #e5e7eb; margin-right: 12px;
}
.sca-prod-info { flex: 1; min-width: 0; }
.sca-prod-name { font-size: 13px; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sca-prod-sp { font-size: 11px; color: #64748b; font-family: monospace; margin-top: 2px; }

.sca-btn-icon {
    width: 28px; height: 28px; border-radius: 6px; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center; transition: all .2s;
}
.sca-btn-icon .material-symbols-outlined { font-size: 18px; }
.sca-btn-icon.add { background: #f0fdf4; color: #16a34a; }
.sca-btn-icon.add:hover { background: #dcfce7; }
.sca-btn-icon.remove { background: #fef2f2; color: #dc2626; }
.sca-btn-icon.remove:hover { background: #fee2e2; }

/* ── Modal ── */
.sca-modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(2px);
    display: flex; align-items: center; justify-content: center; z-index: 999;
}
.sca-modal { width: 400px; background: #fff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); overflow: hidden; animation: scFadeIn .2s ease-out; }
.sca-modal-header { padding: 20px 24px; border-bottom: 1px solid #f1f5f9; font-size: 16px; font-weight: 800; color: #1e293b; }
.sca-modal-body { padding: 24px; display: flex; flex-direction: column; gap: 16px; }
.sca-input-group { display: flex; flex-direction: column; gap: 6px; }
.sca-input-group label { font-size: 12px; font-weight: 600; color: #475569; }
.sca-input-group input, .sca-input-group textarea {
    padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; font-family: inherit; font-size: 13px; outline: none;
}
.sca-input-group input:focus, .sca-input-group textarea:focus { border-color: #facc15; box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.1); }
.sca-modal-footer { padding: 16px 24px; border-top: 1px solid #f1f5f9; background: #f8fafc; display: flex; justify-content: flex-end; gap: 8px; }
.sca-btn { height: 36px; padding: 0 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
.sca-btn.cancel { background: #fff; border: 1px solid #cbd5e1; color: #475569; }
.sca-btn.cancel:hover { background: #f1f5f9; }
.sca-btn.primary { background: #1e293b; color: #fff; }
.sca-btn.primary:hover { background: #334155; }
`;

// ─── Component ────────────────────────────────────────────────────────────────

const StockCheckAdmin: React.FC = () => {
    const [categories, setCategories] = useState<StockCheckCategory[]>([]);
    const [selectedCat, setSelectedCat] = useState<StockCheckCategory | null>(null);

    const [selectedItems, setSelectedItems] = useState<Map<string, any>>(new Map());

    const [searchQ, setSearchQ] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', description: '' });

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        const res = await StockCheckService.getCategories();
        if (res.success) setCategories(res.data);
    };

    useEffect(() => {
        if (!selectedCat) {
            setSelectedItems(new Map());
            return;
        }
        const loadItems = async () => {
            const res = await StockCheckService.getCategoryItems(selectedCat.id);
            if (res.success) {
                const map = new Map();
                res.data.forEach(item => {
                    if (item.product) map.set(item.product_id, item.product);
                });
                setSelectedItems(map);
            }
        };
        loadItems();
    }, [selectedCat]);

    useEffect(() => {
        if (!searchQ.trim()) {
            setSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSearching(true);
            const res = await StockCheckService.searchInventoryProducts(searchQ);
            if (res.success) setSearchResults(res.data);
            setSearching(false);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQ]);

    const handleToggleActive = async () => {
        if (!selectedCat) return;
        const newStatus = !selectedCat.is_active;
        await StockCheckService.updateCategory(selectedCat.id, { is_active: newStatus });
        setSelectedCat({ ...selectedCat, is_active: newStatus });
        loadCategories();
    };

    const handleSaveCatItems = async () => {
        if (!selectedCat) return;
        setIsSaving(true);
        const productIds = Array.from(selectedItems.keys());
        await StockCheckService.updateCategoryItems(selectedCat.id, productIds);
        setIsSaving(false);
        alert('Đã lưu danh mục thành công!');
    };

    const handleCreateCategory = async () => {
        if (!editForm.name.trim()) return;
        const res = await StockCheckService.createCategory({
            name: editForm.name,
            description: editForm.description
        });
        if (res.success) {
            setShowModal(false);
            loadCategories();
            setSelectedCat(res.data);
            setEditForm({ name: '', description: '' });
        }
    };

    const toggleItem = (product: any) => {
        setSelectedItems(prev => {
            const next = new Map(prev);
            if (next.has(product.id)) next.delete(product.id);
            else next.set(product.id, product);
            return next;
        });
    };

    return (
        <div className="sca-root">
            <style>{CSS_ADMIN}</style>

            <div className="sca-sidebar">
                <div className="sca-sb-header">
                    <div className="sca-sb-title">Danh Mục Kiểm Date</div>
                    <button className="sca-btn-add-cat" onClick={() => setShowModal(true)} title="Thêm danh mục">
                        <span className="material-symbols-outlined">add</span>
                    </button>
                </div>
                <div className="sca-cat-list">
                    {categories.map(cat => (
                        <div
                            key={cat.id}
                            className={`sca-cat-item ${selectedCat?.id === cat.id ? 'active' : ''}`}
                            onClick={() => setSelectedCat(cat)}
                        >
                            <div className="sca-cat-info">
                                <div className="sca-cat-icon"><span className="material-symbols-outlined">event_available</span></div>
                                <span className="sca-cat-name" title={cat.name}>{cat.name}</span>
                            </div>
                            <div className={`sca-cat-status ${cat.is_active ? 'active' : 'inactive'}`} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="sca-main">
                {!selectedCat ? (
                    <div className="sca-main-empty">
                        <span className="material-symbols-outlined">event_note</span>
                        <h3>Chọn danh mục kiểm date để cấu hình</h3>
                        <p>Hoặc tạo danh mục mới ở cột bên trái</p>
                    </div>
                ) : (
                    <>
                        <div className="sca-main-header">
                            <div className="sca-mh-left">
                                <div className="sca-mh-title">
                                    {selectedCat.name}
                                </div>
                                {selectedCat.description && <div className="sca-mh-desc">{selectedCat.description}</div>}
                                <div className="sca-toggle-wrap" onClick={handleToggleActive}>
                                    <div className={`sca-toggle ${selectedCat.is_active ? 'active' : ''}`} />
                                    <span className="sca-toggle-label">{selectedCat.is_active ? 'Đang hoạt động' : 'Đã tạm dừng'}</span>
                                </div>
                            </div>
                            <div className="sca-mh-actions">
                                <button className="sca-btn-save" onClick={handleSaveCatItems} disabled={isSaving}>
                                    <span className="material-symbols-outlined">save</span>
                                    {isSaving ? 'Đang lưu...' : 'Lưu Danh Mục'}
                                </button>
                            </div>
                        </div>

                        <div className="sca-toolbar">
                            <div className="sca-search-bar">
                                <span className="material-symbols-outlined">search</span>
                                <input
                                    type="text"
                                    placeholder="Tìm sản phẩm (tên, mã SP)..."
                                    value={searchQ}
                                    onChange={e => setSearchQ(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="sca-content">
                            <div className="sca-col selected">
                                <div className="sca-col-header">
                                    <span>Sản phẩm trong danh mục này</span>
                                    <span className="sca-badge highlight">{selectedItems.size} SP</span>
                                </div>
                                <div className="sca-list">
                                    {Array.from(selectedItems.values()).map(p => (
                                        <div key={p.id} className="sca-prod-item">
                                            <img src={p.image_url || EMPTY_IMG} className="sca-prod-img" alt="" />
                                            <div className="sca-prod-info">
                                                <div className="sca-prod-name">{p.name}</div>
                                                <div className="sca-prod-sp">{p.sp}</div>
                                            </div>
                                            <button className="sca-btn-icon remove" onClick={() => toggleItem(p)}>
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {selectedItems.size === 0 && (
                                        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                                            Chưa có sản phẩm nào.<br />Tìm kiếm và thêm sản phẩm từ bên phải.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="sca-col">
                                <div className="sca-col-header">
                                    <span>Kết quả tìm kiếm</span>
                                    <span className="sca-badge">{searchResults.length} KQ</span>
                                </div>
                                <div className="sca-list">
                                    {searching ? (
                                        <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Đang tìm kiếm...</div>
                                    ) : searchResults.length === 0 && searchQ ? (
                                        <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8' }}>Không tìm thấy sản phẩm</div>
                                    ) : (
                                        searchResults.map(p => {
                                            const isSelected = selectedItems.has(p.id);
                                            return (
                                                <div key={p.id} className="sca-prod-item" style={{ opacity: isSelected ? 0.5 : 1 }}>
                                                    <img src={p.image_url || EMPTY_IMG} className="sca-prod-img" alt="" />
                                                    <div className="sca-prod-info">
                                                        <div className="sca-prod-name">{p.fullName}</div>
                                                        <div className="sca-prod-sp">{p.code}</div>
                                                    </div>
                                                    <button
                                                        className={`sca-btn-icon ${isSelected ? 'remove' : 'add'}`}
                                                        onClick={() => toggleItem({ id: p.id, name: p.fullName, sp: p.code, image_url: p.image_url })}
                                                    >
                                                        <span className="material-symbols-outlined">{isSelected ? 'check' : 'add'}</span>
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {showModal && (
                <div className="sca-modal-overlay">
                    <div className="sca-modal">
                        <div className="sca-modal-header">Tạo Danh Mục Kiểm Date Mới</div>
                        <div className="sca-modal-body">
                            <div className="sca-input-group">
                                <label>Tên danh mục (ví dụ: Sữa Chua, Đồ Hộp)</label>
                                <input
                                    autoFocus
                                    value={editForm.name}
                                    onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Nhập tên danh mục..."
                                />
                            </div>
                            <div className="sca-input-group">
                                <label>Mô tả / Ghi chú</label>
                                <textarea
                                    rows={3}
                                    value={editForm.description}
                                    onChange={e => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                                    placeholder="Ghi chú thêm về danh mục này..."
                                />
                            </div>
                        </div>
                        <div className="sca-modal-footer">
                            <button className="sca-btn cancel" onClick={() => setShowModal(false)}>Hủy</button>
                            <button className="sca-btn primary" onClick={handleCreateCategory} disabled={!editForm.name.trim()}>Tạo Danh Mục</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockCheckAdmin;
