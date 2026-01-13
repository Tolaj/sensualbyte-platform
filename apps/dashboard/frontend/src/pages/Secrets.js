// src/pages/Secrets.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { Field, Input, Select } from "../components/Field";
import { api } from "../api";

export default function Secrets({ pushToast }) {
    const [secretId, setSecretId] = React.useState("");
    const [includeCiphertext, setIncludeCiphertext] = React.useState("0");
    const [loading, setLoading] = React.useState(false);
    const [data, setData] = React.useState(null);

    async function fetchSecret() {
        if (!secretId) return;
        setLoading(true);
        try {
            const out = await api.getSecret(secretId, includeCiphertext === "1");
            setData(out);
            pushToast?.({ type: "ok", title: "Secret fetched", message: secretId });
        } catch (e) {
            pushToast?.({ type: "danger", title: "Fetch secret failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div>
                <div style={{ fontSize: 18, fontWeight: 950 }}>Secrets</div>
                <div className="muted">Fetch a secret by ID (debug/admin)</div>
            </div>

            <Card title="Get Secret">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 220px 160px", gap: 12 }}>
                    <Field label="secretId">
                        <Input value={secretId} onChange={(e) => setSecretId(e.target.value)} placeholder="sec_res_xxx_ssh" />
                    </Field>

                    <Field label="includeCiphertext">
                        <Select value={includeCiphertext} onChange={(e) => setIncludeCiphertext(e.target.value)}>
                            <option value="0">0 (safe)</option>
                            <option value="1">1 (debug)</option>
                        </Select>
                    </Field>

                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <Button onClick={fetchSecret} disabled={!secretId || loading}>Fetch</Button>
                    </div>
                </div>
            </Card>

            <Card title="Result">
                {data ? <JsonView value={data} /> : <div className="muted">No secret loaded</div>}
            </Card>
        </div>
    );
}
