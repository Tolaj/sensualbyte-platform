// src/components/Toast.js
import React from "react";

export function useToasts() {
    const [toasts, setToasts] = React.useState([]);

    function pushToast(t) {
        const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
        const toast = { id, type: t.type || "ok", title: t.title || "", message: t.message || "" };
        setToasts((p) => [toast, ...p].slice(0, 5));
        setTimeout(() => {
            setToasts((p) => p.filter((x) => x.id !== id));
        }, 4500);
        return id;
    }

    function removeToast(id) {
        setToasts((p) => p.filter((x) => x.id !== id));
    }

    return { toasts, pushToast, removeToast };
}

export default function ToastHost({ toasts, onClose }) {
    return (
        <div style={{ position: "fixed", right: 16, top: 16, zIndex: 2000, display: "grid", gap: 10 }}>
            {toasts.map((t) => {
                const border =
                    t.type === "danger" ? "rgba(251,113,133,0.35)" :
                        t.type === "warn" ? "rgba(251,191,36,0.35)" :
                            "rgba(52,211,153,0.35)";

                const bg =
                    t.type === "danger" ? "rgba(251,113,133,0.10)" :
                        t.type === "warn" ? "rgba(251,191,36,0.10)" :
                            "rgba(52,211,153,0.10)";

                return (
                    <div
                        key={t.id}
                        style={{
                            width: 360,
                            borderRadius: 14,
                            border: `1px solid ${border}`,
                            background: bg,
                            padding: 12,
                            boxShadow: "var(--shadow)",
                        }}
                    >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ fontWeight: 900 }}>{t.title || "Notice"}</div>
                            <button
                                onClick={() => onClose?.(t.id)}
                                style={{
                                    border: "1px solid var(--border)",
                                    background: "rgba(0,0,0,0.15)",
                                    color: "var(--text)",
                                    borderRadius: 10,
                                    padding: "2px 8px",
                                    cursor: "pointer",
                                }}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>
                            {t.message}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
