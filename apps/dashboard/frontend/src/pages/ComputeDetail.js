// src/pages/ComputeDetail.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import JsonView from "../components/JsonView";
import { api } from "../api";

const mono = { fontFamily: "var(--mono)" };

function Chip({ tone = "default", children }) {
    const bg =
        tone === "ok"
            ? "rgba(34,197,94,.12)"
            : tone === "warn"
                ? "rgba(234,179,8,.14)"
                : tone === "danger"
                    ? "rgba(239,68,68,.12)"
                    : "rgba(148,163,184,.14)";
    const border =
        tone === "ok"
            ? "rgba(34,197,94,.25)"
            : tone === "warn"
                ? "rgba(234,179,8,.25)"
                : tone === "danger"
                    ? "rgba(239,68,68,.25)"
                    : "rgba(148,163,184,.22)";
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                borderRadius: 999,
                border: `1px solid ${border}`,
                background: bg,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 0.2,
                lineHeight: "16px",
                userSelect: "none",
            }}
        >
            {children}
        </span>
    );
}

function Tab({ active, children, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                border: "1px solid rgba(148,163,184,.22)",
                background: active ? "rgba(148,163,184,.14)" : "transparent",
                color: "inherit",
                padding: "8px 10px",
                borderRadius: 10,
                fontWeight: 900,
                cursor: "pointer",
            }}
        >
            {children}
        </button>
    );
}

function copy(text) {
    if (!text) return false;
    try {
        navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
}

export default function ComputeDetail({ pushToast, params, navigate }) {
    const rid = (params?.resourceId || "").split("?")[0];

    const [loading, setLoading] = React.useState(false);
    const [doc, setDoc] = React.useState(null);

    const [obsLoading, setObsLoading] = React.useState(false);
    const [observed, setObserved] = React.useState(null);

    const [watching, setWatching] = React.useState(false);
    const [sshDownloaded, setSshDownloaded] = React.useState(false);

    const [tab, setTab] = React.useState("overview"); // overview | networking | security | json

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

    async function loadObserved() {
        if (!rid) return;
        setObsLoading(true);
        try {
            const o = await api.getObserved(rid);
            setObserved(o);
        } catch (e) {
            pushToast?.({ type: "warn", title: "Observed failed", message: e.message });
        } finally {
            setObsLoading(false);
        }
    }

    React.useEffect(() => {
        load();
        loadObserved();
        // eslint-disable-next-line
    }, [rid]);

    React.useEffect(() => {
        if (!watching || !rid) return;
        let stop = false;

        async function tick() {
            try {
                const [full, obs] = await Promise.all([
                    api.getResource(rid),
                    api.getObserved(rid).catch(() => null),
                ]);
                if (!stop) setDoc(full);
                if (!stop && obs) setObserved(obs);

                const st = full.status?.state;
                if (st === "ready" || st === "error") {
                    pushToast?.({
                        type: st === "ready" ? "ok" : "danger",
                        title: `Compute ${st}`,
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

    async function doPause() {
        try {
            setLoading(true);
            await api.setDesiredState(rid, "paused");
            pushToast?.({ type: "ok", title: "Requested", message: "desiredState=paused" });
            await load();
            setWatching(true);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Pause failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function doResume() {
        try {
            setLoading(true);
            await api.setDesiredState(rid, "active");
            pushToast?.({ type: "ok", title: "Requested", message: "desiredState=active" });
            await load();
            setWatching(true);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Resume failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function doDelete() {
        const ok = window.confirm(`Delete compute ${rid}? This is irreversible.`);
        if (!ok) return;

        try {
            setLoading(true);
            await api.deleteResource(rid);
            pushToast?.({ type: "ok", title: "Deleted", message: rid });
            navigate("/compute");
        } catch (e) {
            pushToast?.({ type: "danger", title: "Delete failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function downloadSshKey() {
        const secretId = doc?.status?.details?.sshKeySecretRef;
        if (!secretId) {
            pushToast?.({ type: "warn", title: "No SSH key", message: "This compute has no sshKeySecretRef." });
            return;
        }

        try {
            setLoading(true);
            const out = await api.downloadSshKey(secretId);
            setSshDownloaded(true);
            pushToast?.({ type: "ok", title: "Downloaded", message: `Saved as ${out.filename}` });
        } catch (e) {
            if (e.status === 410) {
                setSshDownloaded(true);
                pushToast?.({ type: "warn", title: "Already downloaded", message: "One-time key reveal already used." });
                return;
            }
            pushToast?.({ type: "danger", title: "Download failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    const resource = doc?.resource;
    const status = doc?.status;

    const desired = resource?.desiredState || "unknown";
    const state = status?.state || "unknown";
    const msg = status?.message || "";

    const ssh = status?.details?.ssh;
    const sshKeySecretRef = status?.details?.sshKeySecretRef;

    const image = resource?.spec?.image || "-";
    const cpu = resource?.spec?.resources?.cpu;
    const memoryMb = resource?.spec?.resources?.memoryMb;
    const internalPort = resource?.spec?.network?.internalPort;

    const obs = observed?.observed || observed;
    const actual = obs?.actual || obs?.observed?.actual;

    const sshCmd =
        ssh?.host && ssh?.port ? `ssh -p ${ssh.port} ${ssh.user || "ubuntu"}@${ssh.host}` : "";

    const desiredTone = desired === "active" ? "ok" : desired === "paused" ? "warn" : desired === "deleted" ? "danger" : "default";
    const stateTone = state === "ready" ? "ok" : state === "error" ? "danger" : state === "provisioning" ? "warn" : "default";

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <Card
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 18, fontWeight: 950 }}>Compute</div>
                        <span style={mono} className="muted">{rid}</span>
                        <Chip tone={desiredTone}>desired: {desired}</Chip>
                        <Chip tone={stateTone}>status: {state}</Chip>
                    </div>
                }
                right={
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button variant="secondary" onClick={() => navigate("/compute")}>Back</Button>
                        <Button onClick={() => { load(); loadObserved(); }} disabled={loading || obsLoading}>Refresh</Button>
                        <Button variant="secondary" onClick={() => setWatching((v) => !v)} disabled={!rid}>
                            {watching ? "Stop Watch" : "Watch"}
                        </Button>
                        <Button onClick={doResume} disabled={loading || desired === "active"}>Resume</Button>
                        <Button variant="secondary" onClick={doPause} disabled={loading || desired === "paused"}>Pause</Button>
                        <Button variant="danger" onClick={doDelete} disabled={loading}>Delete</Button>
                    </div>
                }
            >
                <div className="muted">{msg}</div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Tab active={tab === "overview"} onClick={() => setTab("overview")}>Overview</Tab>
                    <Tab active={tab === "networking"} onClick={() => setTab("networking")}>Networking</Tab>
                    <Tab active={tab === "security"} onClick={() => setTab("security")}>Security</Tab>
                    <Tab active={tab === "json"} onClick={() => setTab("json")}>JSON</Tab>
                </div>
            </Card>

            {tab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
                    <Card title="Summary">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <div className="muted small">Image</div>
                                <div style={mono}>{image}</div>
                            </div>
                            <div>
                                <div className="muted small">Resources</div>
                                <div className="muted">
                                    CPU: <b>{cpu ?? "-"}</b> · Memory: <b>{memoryMb ?? "-"}</b> MB
                                </div>
                            </div>
                            <div>
                                <div className="muted small">Internal port</div>
                                <div style={mono}>{internalPort ?? "-"}</div>
                            </div>
                            <div>
                                <div className="muted small">Provisioner</div>
                                <div className="muted">Docker (v1)</div>
                            </div>
                        </div>

                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,.18)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ fontWeight: 950 }}>SSH</div>
                                {sshCmd ? <Chip tone="ok">ready</Chip> : <Chip tone="warn">pending</Chip>}
                            </div>

                            {sshCmd ? (
                                <div style={{ marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                                    <div style={{ ...mono, fontSize: 13, padding: "8px 10px", border: "1px solid rgba(148,163,184,.22)", borderRadius: 10 }}>
                                        {sshCmd}
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() => {
                                            const ok = copy(sshCmd);
                                            pushToast?.({ type: ok ? "ok" : "warn", title: "Copy", message: ok ? "SSH command copied" : "Copy failed" });
                                        }}
                                    >
                                        Copy
                                    </Button>
                                </div>
                            ) : (
                                <div className="muted" style={{ marginTop: 8 }}>No SSH endpoint reported yet.</div>
                            )}
                        </div>
                    </Card>

                    <Card title="Observed state">
                        {obsLoading && <div className="muted">Loading…</div>}
                        {!obsLoading && !observed && <div className="muted">No observed data yet.</div>}

                        {!!observed && (
                            <div style={{ display: "grid", gap: 10 }}>
                                <div>
                                    <div className="muted small">Container</div>
                                    <div style={mono}>{actual?.containerName || actual?.containerId || "-"}</div>
                                </div>
                                <div>
                                    <div className="muted small">Runtime state</div>
                                    <div className="muted">
                                        State: <b>{actual?.state || "-"}</b> · Running: <b>{String(actual?.running ?? "-")}</b>
                                    </div>
                                </div>
                                <div>
                                    <div className="muted small">IP</div>
                                    <div style={mono}>{actual?.ip || "-"}</div>
                                </div>
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {tab === "networking" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Card title="Ports">
                        <div className="muted">
                            Exposure: <b>{resource?.spec?.network?.exposure || "-"}</b>
                        </div>
                        <div style={{ marginTop: 8 }}>
                            <div className="muted small">Internal port</div>
                            <div style={mono}>{internalPort ?? "-"}</div>
                        </div>

                        <div style={{ marginTop: 12 }}>
                            <div className="muted small">Observed ports</div>
                            <div style={{ marginTop: 6 }}>
                                {actual?.ports ? (
                                    <JsonView value={actual.ports} />
                                ) : (
                                    <div className="muted">No ports observed.</div>
                                )}
                            </div>
                        </div>
                    </Card>

                    <Card title="Connectivity">
                        <div className="muted">
                            If exposure is <span style={mono}>internal</span>, the host port is allocated by the provisioner and
                            shown under Observed → ports. SSH is also summarized in Overview.
                        </div>
                    </Card>
                </div>
            )}

            {tab === "security" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Card title="One-time SSH key">
                        <div className="muted">
                            For IaaS compute, a keypair is stored in Secrets and the private key can be revealed exactly once.
                        </div>

                        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                            <div className="muted small">Secret reference</div>
                            <div style={mono}>{sshKeySecretRef || "-"}</div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
                                <Button
                                    onClick={downloadSshKey}
                                    disabled={loading || !sshKeySecretRef || sshDownloaded}
                                    variant={sshDownloaded ? "secondary" : undefined}
                                >
                                    {sshDownloaded ? "SSH key downloaded" : "Download SSH key (one-time)"}
                                </Button>
                            </div>

                            <div className="small muted">
                                After download, the API flips the one-time flag and further downloads return <span style={mono}>410 Gone</span>.
                            </div>
                        </div>
                    </Card>

                    <Card title="Spec security">
                        <div className="muted small">IaaS</div>
                        <div style={{ marginTop: 6 }}>
                            <JsonView value={resource?.spec?.iaas || {}} />
                        </div>
                    </Card>
                </div>
            )}

            {tab === "json" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Card title="Resource document">{doc ? <JsonView value={doc} /> : <div className="muted">Loading…</div>}</Card>
                    <Card title="Observed (worker cache)">{observed ? <JsonView value={observed} /> : <div className="muted">No observed yet.</div>}</Card>
                </div>
            )}
        </div>
    );
}
