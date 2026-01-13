// src/components/Table.js
import React from "react";

export default function Table({ columns, rows, onRowClick }) {
    const safeRows = Array.isArray(rows) ? rows : [];

    if (!Array.isArray(rows)) {
        console.error("Table expected rows to be an array, got:", rows);
    }

    return (
        <div style={{ overflow: "auto", border: "1px solid var(--border)", borderRadius: 12 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                    <tr style={{ background: "rgba(255,255,255,0.03)" }}>
                        {columns.map((c) => (
                            <th
                                key={c.key}
                                style={{
                                    textAlign: "left",
                                    padding: "10px 10px",
                                    borderBottom: "1px solid var(--border)",
                                    color: "var(--muted)",
                                    fontWeight: 800,
                                }}
                            >
                                {c.title}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {safeRows.map((r, idx) => (
                        <tr
                            key={idx}
                            onClick={onRowClick ? () => onRowClick(r) : undefined}
                            style={{
                                cursor: onRowClick ? "pointer" : "default",
                                borderBottom: "1px solid rgba(255,255,255,0.06)",
                            }}
                        >
                            {columns.map((c) => (
                                <td key={c.key} style={{ padding: "10px 10px", verticalAlign: "top" }}>
                                    {typeof c.render === "function"
                                        ? c.render(r)
                                        : String(r?.[c.key] ?? "")}
                                </td>
                            ))}
                        </tr>
                    ))}

                    {safeRows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} style={{ padding: 12 }} className="muted">
                                No rows
                            </td>
                        </tr>
                    ) : null}
                </tbody>
            </table>
        </div>
    );
}
