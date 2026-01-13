// src/components/Field.js
import React from "react";

export function Field({ label, hint, children }) {
    return (
        <div style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 700 }}>{label}</div>
                {hint ? <div className="small muted">{hint}</div> : null}
            </div>
            {children}
        </div>
    );
}

export function Input(props) {
    return (
        <input
            {...props}
            className="sb-input"
            style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.18)",
                color: "var(--text)",
                outline: "none",
            }}
        />
    );
}

export function Textarea(props) {
    return (
        <textarea
            {...props}
            className="sb-input"
            style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.18)",
                color: "var(--text)",
                outline: "none",
                minHeight: 120,
                fontFamily: "var(--mono)",
            }}
        />
    );
}

export function Select(props) {
    return (
        <select
            {...props}
            className="sb-input"
            style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--border)",
                background: "rgba(0,0,0,0.18)",
                color: "var(--text)",
                outline: "none",
            }}
        />
    );
}
