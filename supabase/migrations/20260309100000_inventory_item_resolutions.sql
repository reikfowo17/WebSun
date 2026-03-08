-- Thêm trường resolution và admin_note cho inventory_items và inventory_history
ALTER TABLE
    inventory_items
ADD
    COLUMN resolution varchar(50) DEFAULT 'PENDING',
ADD
    COLUMN admin_note text;

ALTER TABLE
    inventory_history
ADD
    COLUMN resolution varchar(50) DEFAULT 'PENDING',
ADD
    COLUMN admin_note text;

-- Cập nhật data cũ nếu cần (những báo cáo đã duyệt thì update resolution thành APPROVED)
-- UPDATE inventory_history h
-- SET resolution = 'APPROVED'
-- FROM inventory_reports r
-- WHERE h.store_id = r.store_id AND h.check_date = r.check_date AND h.shift = r.shift AND r.status = 'APPROVED';
