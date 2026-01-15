import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import JsonView from "../components/JsonView";
import { Field, Input } from "../components/Field";
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

function fmtBytes(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return "-";
    if (v < 1024) return `${v} B`;
    const kb = v / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    const gb = mb / 1024;
    return `${gb.toFixed(2)} GB`;
}

function fmtTs(s) {
    if (!s) return "";
    return String(s).slice(0, 19).replace("T", " ");
}

export default function BucketDetail({ pushToast, params, navigate }) {
    const rid = (params?.resourceId || "").split("?")[0];

    const [loading, setLoading] = React.useState(false);
    const [doc, setDoc] = React.useState(null);

    const [tab, setTab] = React.useState("objects"); // objects | overview | json

    // objects
    const [prefix, setPrefix] = React.useState("");
    const [objectsLoading, setObjectsLoading] = React.useState(false);
    const [objects, setObjects] = React.useState([]);

    // upload form
    const [uploadPrefix, setUploadPrefix] = React.useState("");
    const [uploadKey, setUploadKey] = React.useState("");
    const [uploadFile, setUploadFile] = React.useState(null);

    async function loadResource() {
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

    async function loadObjects() {
        if (!rid) return;
        setObjectsLoading(true);
        try {
            const out = await api.listBucketObjects(rid, { prefix: prefix || "", recursive: true });
            const arr = out.objects || [];
            // newest first
            arr.sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")));
            setObjects(arr);
        } catch (e) {
            pushToast?.({ type: "danger", title: "List objects failed", message: e.message });
        } finally {
            setObjectsLoading(false);
        }
    }

    React.useEffect(() => {
        loadResource();
        loadObjects();
        // eslint-disable-next-line
    }, [rid]);

    async function doPause() {
        try {
            setLoading(true);
            await api.setDesiredState(rid, "paused");
            pushToast?.({ type: "ok", title: "Requested", message: "desiredState=paused" });
            await loadResource();
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
            await loadResource();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Resume failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function doDelete() {
        const ok = window.confirm(`Delete bucket ${rid}? This is irreversible.`);
        if (!ok) return;

        try {
            setLoading(true);
            await api.deleteResource(rid);
            pushToast?.({ type: "ok", title: "Deleted", message: rid });
            navigate("/buckets");
        } catch (e) {
            pushToast?.({ type: "danger", title: "Delete failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function doUpload() {
        if (!uploadFile) {
            pushToast?.({ type: "warn", title: "Missing file", message: "Choose a file to upload." });
            return;
        }
        try {
            setObjectsLoading(true);
            const out = await api.uploadBucketObject(rid, uploadFile, {
                key: String(uploadKey || "").trim(),
                prefix: String(uploadPrefix || "").trim(),
            });
            pushToast?.({ type: "ok", title: "Uploaded", message: out.key || "OK" });

            // reset
            setUploadFile(null);
            setUploadKey("");
            // keep prefix; it’s useful

            await loadObjects();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Upload failed", message: e.message });
        } finally {
            setObjectsLoading(false);
        }
    }

    async function doDownload(key) {
        try {
            await api.downloadBucketObject(rid, key);
            pushToast?.({ type: "ok", title: "Downloaded", message: key });
        } catch (e) {
            pushToast?.({ type: "danger", title: "Download failed", message: e.message });
        }
    }

    async function doDeleteObject(key) {
        const ok = window.confirm(`Delete object?\n\n${key}`);
        if (!ok) return;
        try {
            setObjectsLoading(true);
            await api.deleteBucketObject(rid, key);
            pushToast?.({ type: "ok", title: "Deleted", message: key });
            await loadObjects();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Delete failed", message: e.message });
        } finally {
            setObjectsLoading(false);
        }
    }

    const resource = doc?.resource;
    const status = doc?.status;

    const desired = resource?.desiredState || "unknown";
    const state = status?.state || "unknown";
    const msg = status?.message || "";

    const bucketName = resource?.spec?.bucketName || status?.details?.bucketName || "-";

    const desiredTone = desired === "active" ? "ok" : desired === "paused" ? "warn" : desired === "deleted" ? "danger" : "default";
    const stateTone = state === "ready" ? "ok" : state === "error" ? "danger" : state === "provisioning" ? "warn" : "default";

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <Card
                title={
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div style={{ fontSize: 18, fontWeight: 950 }}>Bucket</div>
                        <span style={mono} className="muted">{rid}</span>
                        <Chip tone={desiredTone}>desired: {desired}</Chip>
                        <Chip tone={stateTone}>status: {state}</Chip>
                    </div>
                }
                right={
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button variant="secondary" onClick={() => navigate("/buckets")}>Back</Button>
                        <Button onClick={() => { loadResource(); loadObjects(); }} disabled={loading || objectsLoading}>Refresh</Button>
                        <Button onClick={doResume} disabled={loading || desired === "active"}>Resume</Button>
                        <Button variant="secondary" onClick={doPause} disabled={loading || desired === "paused"}>Pause</Button>
                        <Button variant="danger" onClick={doDelete} disabled={loading}>Delete</Button>
                    </div>
                }
            >
                <div className="muted">{msg}</div>

                <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Tab active={tab === "objects"} onClick={() => setTab("objects")}>Objects</Tab>
                    <Tab active={tab === "overview"} onClick={() => setTab("overview")}>Overview</Tab>
                    <Tab active={tab === "json"} onClick={() => setTab("json")}>JSON</Tab>
                </div>
            </Card>

            {tab === "objects" && (
                <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 14 }}>
                    <Card title="Upload">
                        <div className="muted">
                            Bucket: <span style={mono}>{bucketName}</span>
                        </div>

                        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                            <Field label="Prefix (optional)" hint="Auto-prepends to file name if key is empty. Example: test/">
                                <Input value={uploadPrefix} onChange={(e) => setUploadPrefix(e.target.value)} placeholder="test/" />
                            </Field>

                            <Field label="Key (optional)" hint="Full object key. If set, prefix is ignored. Example: a/b/c.txt">
                                <Input value={uploadKey} onChange={(e) => setUploadKey(e.target.value)} placeholder="path/to/file.txt" />
                            </Field>

                            <div>
                                <div className="sb-label">File</div>
                                <input
                                    className="sb-input"
                                    type="file"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                />
                                <div className="small muted" style={{ marginTop: 6 }}>
                                    Upload uses <span style={mono}>POST /v1/product/buckets/:rid/objects</span> (multipart).
                                </div>
                            </div>

                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <Button onClick={doUpload} disabled={objectsLoading || !uploadFile}>
                                    Upload
                                </Button>
                                <Button
                                    variant="secondary"
                                    onClick={() => { setUploadFile(null); setUploadKey(""); }}
                                    disabled={objectsLoading}
                                >
                                    Clear
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <Card
                        title={`Objects (${objects.length})`}
                        right={
                            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                                <input
                                    className="sb-input"
                                    style={{ width: 260 }}
                                    placeholder="prefix filter (e.g. test/)"
                                    value={prefix}
                                    onChange={(e) => setPrefix(e.target.value)}
                                />
                                <Button variant="secondary" onClick={loadObjects} disabled={objectsLoading}>
                                    Apply
                                </Button>
                            </div>
                        }
                    >
                        {objectsLoading && <div className="muted">Loading…</div>}
                        {!objectsLoading && !objects.length && <div className="muted">No objects found.</div>}

                        {!!objects.length && (
                            <Table
                                columns={[
                                    {
                                        key: "key",
                                        title: "Key",
                                        render: (o) => (
                                            <div style={{ display: "grid", gap: 2 }}>
                                                <div style={{ fontWeight: 900 }}>{o.key}</div>
                                                <div className="muted small" style={mono}>
                                                    etag: {o.etag || "-"}
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        key: "size",
                                        title: "Size",
                                        render: (o) => <span className="muted">{fmtBytes(o.size)}</span>,
                                    },
                                    {
                                        key: "lastModified",
                                        title: "Last modified",
                                        render: (o) => <span className="muted small">{fmtTs(o.lastModified)}</span>,
                                    },
                                    {
                                        key: "actions",
                                        title: "Actions",
                                        render: (o) => (
                                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                <Button variant="secondary" onClick={() => doDownload(o.key)}>
                                                    Download
                                                </Button>
                                                <Button variant="danger" onClick={() => doDeleteObject(o.key)}>
                                                    Delete
                                                </Button>
                                            </div>
                                        ),
                                    },
                                ]}
                                rows={objects}
                                onRowClick={null}
                            />
                        )}
                    </Card>
                </div>
            )}

            {tab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Card title="Summary">
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                            <div>
                                <div className="muted small">Bucket name</div>
                                <div style={mono}>{bucketName}</div>
                            </div>
                            <div>
                                <div className="muted small">Provider</div>
                                <div className="muted">MinIO (sb-minio)</div>
                            </div>
                            <div>
                                <div className="muted small">Project</div>
                                <div style={mono}>{resource?.projectId || "-"}</div>
                            </div>
                            <div>
                                <div className="muted small">Visibility</div>
                                <div className="muted">
                                    publicRead: <b>{String(resource?.spec?.publicRead ?? false)}</b>
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,.18)" }}>
                            <div className="muted small">Usage</div>
                            <div className="muted">
                                Objects: <b>{objects.length}</b> (use Objects tab to manage)
                            </div>
                        </div>
                    </Card>

                    <Card title="Notes">
                        <div className="muted">
                            This bucket is a <span style={mono}>resource</span> (kind=bucket). The API uses the resource spec to resolve
                            the underlying MinIO bucket name and then performs object operations against <span style={mono}>sb-minio</span>.
                        </div>
                    </Card>
                </div>
            )}

            {tab === "json" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <Card title="Resource document">{doc ? <JsonView value={doc} /> : <div className="muted">Loading…</div>}</Card>
                    <Card title="Objects (raw)">
                        <JsonView value={{ bucketName, prefix, count: objects.length, objects }} />
                    </Card>
                </div>
            )}
        </div>
    );
}
