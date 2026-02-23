import React from "react";

export interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const variantMap = {
  danger: {
    icon: "delete_forever",
    iconBg: "#fef2f2",
    iconColor: "#dc2626",
    btnBg: "#dc2626",
    btnHover: "#b91c1c",
  },
  warning: {
    icon: "warning",
    iconBg: "#fffbeb",
    iconColor: "#d97706",
    btnBg: "#d97706",
    btnHover: "#b45309",
  },
  info: {
    icon: "help",
    iconBg: "#eef2ff",
    iconColor: "#4f46e5",
    btnBg: "#4f46e5",
    btnHover: "#4338ca",
  },
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = "Xác nhận",
  message,
  confirmText = "Xác nhận",
  cancelText = "Hủy",
  variant = "warning",
  onConfirm,
  onCancel,
  loading = false,
}) => {
  if (!isOpen) return null;
  const v = variantMap[variant];

  return (
    <div style={S.overlay} onClick={onCancel}>
      <div style={S.card} onClick={(e) => e.stopPropagation()}>
        <div style={{ ...S.iconWrap, background: v.iconBg }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 28, color: v.iconColor }}
          >
            {v.icon}
          </span>
        </div>
        <h3 style={S.title}>{title}</h3>
        <p style={S.msg}>{message}</p>
        <div style={S.actions}>
          <button style={S.cancelBtn} onClick={onCancel} disabled={loading}>
            {cancelText}
          </button>
          <button
            style={{
              ...S.confirmBtn,
              background: v.btnBg,
              opacity: loading ? 0.6 : 1,
            }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && (
              <span
                className="material-symbols-outlined"
                style={{ fontSize: 16, animation: "spin 1s linear infinite" }}
              >
                sync
              </span>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,0.45)",
    backdropFilter: "blur(6px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    animation: "fadeIn .15s ease",
  },
  card: {
    background: "#fff",
    borderRadius: 20,
    width: "100%",
    maxWidth: 380,
    padding: "32px 28px 24px",
    textAlign: "center",
    boxShadow: "0 25px 60px -12px rgba(0,0,0,.25)",
    animation: "fadeIn .2s ease",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: 800, color: "#1e293b", margin: "0 0 8px" },
  msg: { fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 20px" },
  actions: { display: "flex", gap: 10 },
  cancelBtn: {
    flex: 1,
    padding: "11px 16px",
    background: "#f1f5f9",
    color: "#475569",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
  },
  confirmBtn: {
    flex: 1,
    padding: "11px 16px",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    boxShadow: "0 4px 14px -3px rgba(0,0,0,.25)",
  },
};

export default ConfirmModal;
