// src/pages/Home.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { api } from "../api";

export default function Home({ pushToast }) {
    const [loading, setLoading] = React.useState(false);
    const [health, setHealth] = React.useState(null);
    const [err, setErr] = React.useState(null);

    async function load() {
        setLoading(true);
        setErr(null);
        try {
            const h = await api.health();
            setHealth(h);
            pushToast?.({ type: "ok", title: "Health", message: "API /healthz OK" });
        } catch (e) {
            setErr(e);
            pushToast?.({ type: "danger", title: "Health failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => { load(); }, []);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div>
                    <div style={{ fontSize: 22, fontWeight: 950 }}>Platform Console</div>
                    <div className="muted">Control plane + worker reconciler (v1)</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={load} disabled={loading}>Refresh</Button>
                    <Button variant="secondary" onClick={() => (window.location.hash = "#/resources")}>Go to Resources</Button>
                </div>
            </div>

            <Card title="API Health">
                {err ? (
                    <div>
                        <div style={{ color: "var(--danger)", fontWeight: 800 }}>Error: {err.message}</div>
                        <div className="small muted">Check nginx /api proxy + x-user-id settings.</div>
                    </div>
                ) : health ? (
                    <JsonView value={health} />
                ) : (
                    <div className="muted">Loading…</div>
                )}
            </Card>

            <Card title="Quick Links">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    <Button variant="secondary" onClick={() => (window.location.hash = "#/identity")}>Identity</Button>
                    <Button variant="secondary" onClick={() => (window.location.hash = "#/projects")}>Projects</Button>
                    <Button variant="secondary" onClick={() => (window.location.hash = "#/resources")}>Resources</Button>
                    <Button variant="secondary" onClick={() => (window.location.hash = "#/explorer")}>API Explorer</Button>
                </div>
            </Card>
        </div>
    );
}
