// src/pages/Explorer.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { Field, Input, Select, Textarea } from "../components/Field";
import { apiFetch } from "../api";

export default function Explorer({ pushToast }) {
    const [method, setMethod] = React.useState("GET");
    const [path, setPath] = React.useState("/healthz");
    const [body, setBody] = React.useState("{\n  \n}");
    const [result, setResult] = React.useState(null);
    const [loading, setLoading] = React.useState(false);

    async function send() {
        setLoading(true);
        setResult(null);
        try {
            const opts = { method };
            if (method !== "GET" && method !== "HEAD") {
                const b = body.trim();
                opts.body = b ? JSON.stringify(JSON.parse(b)) : undefined;
            }
            const out = await apiFetch(path, opts);
            setResult(out);
            pushToast?.({ type: "ok", title: "OK", message: `${method} ${path}` });
        } catch (e) {
            setResult({ error: e.message, status: e.status, body: e.body });
            pushToast?.({ type: "danger", title: "Request failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div>
                <div style={{ fontSize: 18, fontWeight: 950 }}>API Explorer</div>
                <div className="muted">Hit any endpoint quickly with x-user-id automatically attached.</div>
            </div>

            <Card title="Request">
                <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 160px", gap: 12 }}>
                    <Field label="Method">
                        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
                            {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Path" hint="relative to API base (e.g. /api)">
                        <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/v1/resources" />
                    </Field>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <Button onClick={send} disabled={loading}>Send</Button>
                    </div>
                </div>

                {method !== "GET" && method !== "HEAD" ? (
                    <div style={{ marginTop: 12 }}>
                        <Field label="Body (JSON)">
                            <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
                        </Field>
                    </div>
                ) : null}
            </Card>

            <Card title="Response">
                {result ? <JsonView value={result} /> : <div className="muted">No response yet</div>}
            </Card>
        </div>
    );
}
