import { useState, useEffect, useMemo, useCallback } from "react";
import { InventoryProduct, User } from "../types";
import { InventoryService } from "../services";
import { SystemService, ShiftConfig } from "../services/system";
import { useToast } from "../contexts";

export const INVENTORY_CONFIG = {
  SHIFTS: [
    {
      id: 1,
      name: "Ca 1",
      time: "06:00 - 14:00",
      icon: "wb_sunny",
      color: "from-amber-400 to-orange-400",
    },
    {
      id: 2,
      name: "Ca 2",
      time: "14:00 - 22:00",
      icon: "wb_twilight",
      color: "from-blue-400 to-indigo-400",
    },
    {
      id: 3,
      name: "Ca 3",
      time: "22:00 - 02:00",
      icon: "dark_mode",
      color: "from-purple-400 to-violet-400",
    },
  ],
  STATUS_CONFIG: {
    MATCHED: {
      label: "Khớp",
      emoji: "✓",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-200",
      icon: "check_circle",
    },
    MISSING: {
      label: "Thiếu",
      emoji: "↓",
      bg: "bg-red-50",
      text: "text-red-600",
      border: "border-red-200",
      icon: "trending_down",
    },
    OVER: {
      label: "Thừa",
      emoji: "↑",
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-200",
      icon: "trending_up",
    },
    PENDING: {
      label: "Chờ",
      emoji: "•",
      bg: "bg-gray-50",
      text: "text-gray-400",
      border: "border-gray-200",
      icon: "pending",
    },
  },
};

export const useInventory = (user: User) => {
  const toast = useToast();
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  const [shift, setShift] = useState(1);

  useEffect(() => {
    SystemService.getShifts().then((data) => {
      const loadedShifts =
        data && data.length > 0 ? data : INVENTORY_CONFIG.SHIFTS;
      setShifts(loadedShifts);
      setShiftsLoading(false);

      const hour = new Date().getHours();
      if (hour >= 6 && hour < 14) setShift(loadedShifts[0]?.id || 1);
      else if (hour >= 14 && hour < 22) setShift(loadedShifts[1]?.id || 2);
      else setShift(loadedShifts[2]?.id || 3);
    });
  }, []);
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [shiftSubmitted, setShiftSubmitted] = useState<{
    submitted: boolean;
    submittedBy?: string;
    submittedAt?: string;
    status?: string;
    viewingData?: boolean;
  }>({ submitted: false });
  const [confirmSubmit, setConfirmSubmit] = useState<{
    show: boolean;
    message: string;
    title: string;
  }>({ show: false, message: "", title: "" });

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setShiftSubmitted({ submitted: false });
    try {
      const reportStatus = await InventoryService.getReportStatus(
        user.store || "BEE",
        shift,
      );
      if (reportStatus.submitted && reportStatus.report) {
        setShiftSubmitted({
          submitted: true,
          submittedBy: reportStatus.report.submittedBy,
          submittedAt: reportStatus.report.submittedAt,
          status: reportStatus.report.status,
        });
      }

      const result = await InventoryService.getItems(
        user.store || "BEE",
        shift,
      );
      if (result.success && result.products) {
        setProducts(result.products);
      }
    } catch (error) {
      toast.error("Không thể tải dữ liệu kho");
    } finally {
      setLoading(false);
    }
  }, [user.store, shift, toast]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const updateField = useCallback(
    (productId: string, field: string, value: string) => {
      setProducts((prev) =>
        prev.map((p) => {
          if (String(p.id) !== productId) return p;

          const updated = { ...p };

          if (field === "actualStock") {
            const actual = value === "" ? null : parseInt(value);
            updated.actualStock = actual;

            if (
              actual !== null &&
              updated.systemStock !== undefined &&
              updated.systemStock !== null
            ) {
              const diff = actual - updated.systemStock;
              updated.diff = diff;
              updated.status =
                diff === 0 ? "MATCHED" : diff < 0 ? "MISSING" : "OVER";
            } else {
              updated.diff = null;
              updated.status = "PENDING";
            }
          } else if (field === "note") {
            updated.note = value;
          } else if (field === "diffReason") {
            (updated as any).diffReason = value || null;
          }

          const backendField =
            field === "actualStock"
              ? "actual_stock"
              : field === "diffReason"
                ? "diff_reason"
                : field;
          InventoryService.updateItem(
            String(p.id),
            backendField,
            value,
            user.id,
            (user as any).role || "EMPLOYEE",
          );
          return updated;
        }),
      );
    },
    [user.id, user],
  );

  const stats = useMemo(
    () => ({
      total: products.length,
      checked: products.filter((p) => p.status !== "PENDING").length,
      matched: products.filter((p) => p.status === "MATCHED").length,
      missing: products.filter((p) => p.status === "MISSING").length,
      over: products.filter((p) => p.status === "OVER").length,
      pending: products.filter((p) => p.status === "PENDING").length,
      missingValue: products
        .filter((p) => p.status === "MISSING")
        .reduce((sum, p) => sum + Math.abs(p.diff || 0), 0),
    }),
    [products],
  );

  const handleSubmit = useCallback(() => {
    const pending = stats.pending;
    const missing = stats.missing;

    let message = "";
    let title = "";

    if (pending > 0) {
      title = "Còn sản phẩm chưa kiểm";
      message = `Còn ${pending} sản phẩm chưa kiểm.\n\nVẫn nộp báo cáo?`;
    } else if (missing > 0) {
      title = "Tổng kết kiểm kho";
      message = `• Khớp: ${stats.matched}\n• Thiếu: ${stats.missing}\n• Thừa: ${stats.over}\n\nXác nhận nộp báo cáo?`;
    } else {
      title = "Hoàn thành kiểm kho";
      message = "Xác nhận nộp báo cáo kiểm kho?";
    }

    setConfirmSubmit({ show: true, message, title });
  }, [stats]);

  const doSubmit = useCallback(async () => {
    setConfirmSubmit({ show: false, message: "", title: "" });
    setSubmitting(true);
    try {
      const res = await InventoryService.submitReport(
        user.store || "BEE",
        shift,
        user.id,
      );
      if (res.success) {
        toast.success(res.message || "Đã nộp báo cáo thành công!");
        setShiftSubmitted({
          submitted: true,
          submittedBy: user.name || "Bạn",
          submittedAt: new Date().toISOString(),
          status: "PENDING",
        });
      } else {
        toast.error(res.message || "Lỗi khi nộp báo cáo");
      }
    } catch (e) {
      toast.error("Lỗi kết nối");
    } finally {
      setSubmitting(false);
    }
  }, [user.store, shift, user.id, user.name, toast]);

  const handlePrint = useCallback(() => {
    if (products.length === 0) {
      toast.error("Không có sản phẩm nào để in");
      return;
    }

    const currentShiftInfo =
      shifts.find((s) => s.id === shift) || INVENTORY_CONFIG.SHIFTS[0];
    const now = new Date();

    const tableRows = products
      .map((p, i) => {
        const sapoStr = p.systemStock != null ? String(p.systemStock) : "";
        const thucTeStr = p.actualStock != null ? String(p.actualStock) : "";
        const isChecked = sapoStr.trim() !== "" && thucTeStr.trim() !== "";
        const nameStr = p.productName?.trim() || "";
        const barcodeStr = p.barcode ? String(p.barcode).trim() : "";
        const barcodeLast6 =
          barcodeStr.length >= 6 ? "....." + barcodeStr.slice(-6) : barcodeStr;

        return `<tr class="${isChecked ? "checked-row" : ""}">
        <td class="stt-col">${i + 1}</td>
        <td class="name-col">${nameStr}</td>
        <td class="barcode-col">${barcodeLast6}</td>
        <td class="sapo-col">${sapoStr}</td>
        <td class="thucte-col">${thucTeStr}</td>
      </tr>`;
      })
      .join("");

    const printCSS = `*{box-sizing:border-box}@media print{body{margin:0;padding:3mm;font-size:9px}.no-print{display:none}@page{size:80mm auto;margin:2mm}}body{font-family:"Segoe UI","Arial Unicode MS","Tahoma","Arial",sans-serif;margin:0;padding:3mm;font-size:9px;width:100%;max-width:80mm;line-height:1.2;color:#000}.header{text-align:center;margin-bottom:1mm;border-bottom:2px solid #000;padding-bottom:0.5mm}.header h2{margin:0;font-size:12px;font-weight:800;text-transform:uppercase;padding:0.5mm 1mm}.info{margin-bottom:2mm;font-size:8px;border-bottom:1px solid #ccc;padding:1mm 2mm}.info p{margin:1px 0;font-weight:500}.product-table{width:100%;border-collapse:collapse;font-size:8px;margin-bottom:2mm}.product-table th{background:#fff;color:#000;font-weight:900;text-align:center;padding:1mm;border-bottom:1px solid #000;font-size:9px;text-transform:uppercase;white-space:nowrap}.product-table td{padding:1mm;border-bottom:1px solid #ccc;vertical-align:top;font-weight:600;color:#000}.product-table tr:nth-child(even){background:#f8f8f8}.stt-col{width:7%;text-align:center;font-weight:900;font-size:10px}.name-col{width:42%;text-align:left;padding-left:2mm;word-wrap:break-word;line-height:1.4;font-weight:700;font-size:9px}.barcode-col{width:15%;text-align:center;font-weight:800;font-size:10px;color:#333}.sapo-col,.thucte-col{width:18%;text-align:center;font-weight:800;font-size:10px}.checked-row{background:#e8f5e8!important}.checked-row .sapo-col,.checked-row .thucte-col{background:#d4edda;font-weight:bold;color:#155724}.footer{margin-top:2mm;text-align:center;font-size:7px;border-top:1px solid #ccc;padding:1mm}.footer p{margin:1px 0}`;

    const html = `<!DOCTYPE html><html><head><title>Danh sách kiểm tra - ${user.store}</title><meta charset="UTF-8"><style>${printCSS}</style></head><body>
      <div class="header"><h2>DANH SÁCH KIỂM TRA SẢN PHẨM</h2></div>
      <div class="info"><p><strong>Ca:</strong> ${currentShiftInfo.name} (${currentShiftInfo.time}) | <strong>Cửa hàng:</strong> ${user.store} | <strong>Tổng SP:</strong> ${products.length}</p></div>
      <table class="product-table">
        <thead><tr><th class="stt-col">STT</th><th class="name-col">TÊN SẢN PHẨM</th><th class="barcode-col">BARCODE</th><th class="sapo-col">SAPO</th><th class="thucte-col">THỰC TẾ</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
      <div class="footer"><p>In lúc: ${now.toLocaleString("vi-VN")}</p></div>
    </body></html>`;

    const existingFrame = document.getElementById(
      "printFrame",
    ) as HTMLIFrameElement;
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement("iframe");
    iframe.id = "printFrame";
    iframe.style.cssText =
      "position:fixed;width:0;height:0;border:none;left:-9999px;top:-9999px;";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.print();
      }, 300);
    }
  }, [products, shift, user.store, toast]);

  const handleSync = useCallback(async () => {
    setShowSyncModal(false);
    setSyncing(true);
    try {
      const result = await InventoryService.syncKiotVietStock(
        user.store || "BEE",
        shift,
      );
      if (result.success) {
        toast.success(result.message || "Đồng bộ thành công!");
        await loadProducts(); // reload to show updated system_stock
      } else {
        toast.error(result.message || "Đồng bộ thất bại");
      }
    } catch {
      toast.error("Lỗi kết nối KiotViet");
    } finally {
      setSyncing(false);
    }
  }, [user.store, shift, toast, loadProducts]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.productName.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode || "").includes(search);
      const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [products, search, filterStatus]);

  const progressPercent = shiftSubmitted.submitted
    ? 100
    : stats.total > 0
      ? Math.round((stats.checked / stats.total) * 100)
      : 0;
  const currentShift =
    shifts.find((s) => s.id === shift) || INVENTORY_CONFIG.SHIFTS[0];

  const getStatusConfig = (status: string) => {
    return (
      INVENTORY_CONFIG.STATUS_CONFIG[
        status as keyof typeof INVENTORY_CONFIG.STATUS_CONFIG
      ] || INVENTORY_CONFIG.STATUS_CONFIG.PENDING
    );
  };

  return {
    shifts,
    shiftsLoading,
    shift,
    setShift,
    products,
    loading,
    submitting,
    syncing,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    showSyncModal,
    setShowSyncModal,
    shiftSubmitted,
    setShiftSubmitted,
    confirmSubmit,
    setConfirmSubmit,
    stats,
    filteredProducts,
    progressPercent,
    currentShift,
    getStatusConfig,
    updateField,
    handleSubmit,
    doSubmit,
    handlePrint,
    handleSync,
  };
};
