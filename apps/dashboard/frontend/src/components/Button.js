// src/components/Button.js
import React from "react";

const variants = {
    primary: {
        background: "rgba(96,165,250,0.18)",
        border: "rgba(96,165,250,0.35)",
        color: "var(--text)",
    },
    secondary: {
        background: "rgba(255,255,255,0.04)",
        border: "var(--border)",
        color: "var(--text)",
    },
    danger: {
        background: "rgba(251,113,133,0.14)",
        border: "rgba(251,113,133,0.30)",
        color: "var(--text)",
    },
};

export default function Button({ children, onClick, variant = "primary", disabled, type = "button" }) {
    const v = variants[variant] || variants.primary;
    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `1px solid ${v.border}`,
                background: v.background,
                color: v.color,
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.6 : 1,
                fontWeight: 700,
            }}
        >
            {children}
        </button>
    );
}
