// src/components/Modal.js
import React from "react";

export default function Modal({ open, title, children, footer, onClose }) {
    if (!open) return null;
    return (
        <div
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.55)",
                display: "grid",
                placeItems: "center",
                zIndex: 999,
                padding: 18,
            }}
        >
            <div
                style={{
                    width: "min(720px, 100%)",
                    borderRadius: "var(--radius)",
                    border: "1px solid var(--border)",
                    background: "rgba(17,24,39,0.92)",
                    boxShadow: "var(--shadow)",
                    overflow: "hidden",
                }}
            >
                <div style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 900 }}>{title}</div>
                    <button
                        onClick={onClose}
                        style={{
                            border: "1px solid var(--border)",
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--text)",
                            borderRadius: 10,
                            padding: "6px 10px",
                            cursor: "pointer",
                            fontWeight: 800,
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div className="hr" style={{ margin: 0 }} />
                <div style={{ padding: 14 }}>{children}</div>
                {footer ? (
                    <>
                        <div className="hr" style={{ margin: 0 }} />
                        <div style={{ padding: 14, display: "flex", justifyContent: "flex-end" }}>{footer}</div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
