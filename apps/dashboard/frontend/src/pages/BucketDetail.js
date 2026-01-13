import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { api } from "../api";

export default function BucketDetail({ pushToast, params, navigate }) {
    const rid = params?.resourceId;
    const [loading, setLoading] = React.useState(false);
    const [doc, setDoc] = React.useState(null);
    const [watching, setWatching] = React.useState(false);

    async function load() {
        if (!rid) return;
        setLoading(true);
        try {
            const full = await api.getResource(rid);
            setDoc(full);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Load failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => { load(); /* eslint-disable-next-line */ }, [rid]);

    React.useEffect(() => {
        if (!watching || !rid) return;
        let stop = false;

        async function tick() {
            try {
                const full = await api.getResource(rid);
                if (!stop) setDoc(full);
                const st = full.status?.state;
                if (st === "ready" || st === "error") {
                    pushToast?.({
                        type: st === "ready" ? "ok" : "danger",
                        title: `Bucket ${st}`,
                        message: full.status?.message || rid,
                    });
                    setWatching(false);
                    return;
                }
            } catch (e) {
                if (!stop) pushToast?.({ type: "warn", title: "Watch error", message: e.message });
            }
            if (!stop) setTimeout(tick, 1200);
        }

        tick();
        return () => { stop = true; };
    }, [watching, rid, pushToast]);

    const bucketName = doc?.status?.details?.bucketName || doc?.status?.details?.bucket || doc?.resource?.spec?.bucketName;

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Bucket detail</div>
                    <div className="muted" style={{ fontFamily: "var(--mono)" }}>{rid}</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button variant="secondary" onClick={() => navigate("/buckets")}>Back</Button>
                    <Button onClick={load} disabled={loading}>Refresh</Button>
                    <Button variant="secondary" onClick={() => setWatching((v) => !v)} disabled={!rid}>
                        {watching ? "Stop Watch" : "Watch"}
                    </Button>
                </div>
            </div>

            <Card title="Quick info">
                <div className="muted">
                    Status: <b>{doc?.status?.state || "unknown"}</b> — {doc?.status?.message || ""}
                </div>
                {bucketName ? (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ fontWeight: 800 }}>Bucket name</div>
                        <div style={{ fontFamily: "var(--mono)", marginTop: 6 }}>{bucketName}</div>
                    </div>
                ) : (
                    <div style={{ marginTop: 10 }} className="muted">Bucket name not reported yet.</div>
                )}
            </Card>

            <Card title="Full document">
                {doc ? <JsonView value={doc} /> : <div className="muted">Loading…</div>}
            </Card>
        </div>
    );
}
