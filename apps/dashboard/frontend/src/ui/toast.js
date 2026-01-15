// src/ui/toast.js
import React from "react";
import "./ui.css";

function uid() {
    return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ToastHost() {
    const [items, setItems] = React.useState([]);

    React.useEffect(() => {
        window.__sbToast = (t) => {
            const toast = {
                id: uid(),
                type: t?.type || "info",
                title: t?.title || "",
                message: t?.message || "",
                ttl: typeof t?.ttl === "number" ? t.ttl : 3000,
            };

            setItems((prev) => [toast, ...prev].slice(0, 4));

            if (toast.ttl > 0) {
                setTimeout(() => {
                    setItems((prev) => prev.filter((x) => x.id !== toast.id));
                }, toast.ttl);
            }
        };

        return () => {
            window.__sbToast = undefined;
        };
    }, []);

    if (!items.length) return null;

    return (
        <div className="sb-toasts">
            {items.map((t) => (
                <div key={t.id} className={`sb-toast sb-toast--${t.type}`}>
                    {!!t.title && <div className="sb-toast__title">{t.title}</div>}
                    {!!t.message && <div className="sb-toast__msg">{t.message}</div>}
                </div>
            ))}
        </div>
    );
}

export const toast = {
    ok: (title, message) => window.__sbToast?.({ type: "ok", title, message }),
    warn: (title, message) => window.__sbToast?.({ type: "warn", title, message }),
    danger: (title, message) => window.__sbToast?.({ type: "danger", title, message }),
};
