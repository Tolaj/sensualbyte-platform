// src/components/Card.js
import React from "react";

export default function Card({ title, right, children }) {
    return (
        <div
            style={{
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)",
                borderRadius: "var(--radius)",
                padding: 14,
                boxShadow: "var(--shadow)",
            }}
        >
            {(title || right) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>{title}</div>
                    <div>{right}</div>
                </div>
            )}
            {(title || right) && <div className="hr" />}
            {children}
        </div>
    );
}
