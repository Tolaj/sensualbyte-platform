// src/pages/buckets/BucketDetailPage.js
import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { toast } from "../../ui/toast";
import { Card, CardBody, CardHeader } from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { safeStringify } from "../../utils/format";

function Tabs({ value, onChange, items }) {
    return (
        <div className="inline-flex rounded-xl border border-black/10 bg-white p-1">
            {items.map((it) => {
                const active = it.value === value;
                return (
                    <button
                        key={it.value}
                        onClick={() => onChange(it.value)}
                        className={[
                            "rounded-lg px-3 py-1.5 text-sm transition",
                            active ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100",
                        ].join(" ")}
                    >
                        {it.label}
                    </button>
                );
            })}
        </div>
    );
}

export default function BucketDetailPage() {
    const { resourceId } = useParams();

    const [resource, setResource] = React.useState(null);
    const [objects, setObjects] = React.useState([]);
    const [prefix, setPrefix] = React.useState("");
    const [file, setFile] = React.useState(null);

    const [loading, setLoading] = React.useState(true);
    const [objectsLoading, setObjectsLoading] = React.useState(false);
    const [tab, setTab] = React.useState("objects");

    async function load() {
        setLoading(true);
        try {
            const out = await api.getResource(resourceId);
            setResource(out?.resource || out);
        } catch (e) {
            toast.danger("Load failed", e.message);
        } finally {
            setLoading(false);
        }
    }

    async function loadObjects() {
        setObjectsLoading(true);
        try {
            const out = await api.bucketListObjects(resourceId, { prefix });
            setObjects(out?.objects || []);
        } catch (e) {
            toast.danger("List objects failed", e.message);
        } finally {
            setObjectsLoading(false);
        }
    }

    React.useEffect(() => {
        if (!resourceId) return;
        load();
        loadObjects();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resourceId]);

    async function upload() {
        try {
            if (!file) return;
            await api.bucketUploadObject(resourceId, file, { prefix });
            toast.ok("Uploaded", file.name);
            setFile(null);
            await loadObjects();
        } catch (e) {
            toast.danger("Upload failed", e.message);
        }
    }

    async function download(key) {
        try {
            await api.bucketDownloadObject(resourceId, key);
        } catch (e) {
            toast.danger("Download failed", e.message);
        }
    }

    async function del(key) {
        try {
            await api.bucketDeleteObject(resourceId, key);
            toast.ok("Deleted", key);
            await loadObjects();
        } catch (e) {
            toast.danger("Delete failed", e.message);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="text-lg font-semibold">Bucket</div>
                    <div className="text-xs text-neutral-500">{resourceId}</div>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                    <Link to="/app/buckets">
                        <Button variant="ghost">Back</Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs
                    value={tab}
                    onChange={setTab}
                    items={[
                        { value: "objects", label: "Objects" },
                        { value: "json", label: "JSON" },
                    ]}
                />
                <Button variant="secondary" onClick={loadObjects} disabled={objectsLoading}>
                    {objectsLoading ? "Loading…" : "Refresh list"}
                </Button>
            </div>

            {tab === "objects" ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader title="Upload" subtitle="Uses multipart upload." />
                        <CardBody>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-neutral-600">Prefix (optional)</div>
                                    <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="folder/" />
                                </div>

                                <div className="space-y-1">
                                    <div className="text-xs font-medium text-neutral-600">File</div>
                                    <input
                                        className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                        type="file"
                                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                                    />
                                </div>

                                <Button onClick={upload} disabled={!file || objectsLoading}>
                                    Upload
                                </Button>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader title="Objects" subtitle={`${objects.length} items`} />
                        <CardBody>
                            {objectsLoading ? <div className="text-sm text-neutral-500">Loading…</div> : null}
                            {!objectsLoading && objects.length === 0 ? (
                                <div className="text-sm text-neutral-500">No objects found.</div>
                            ) : null}

                            <div className="mt-3 space-y-2">
                                {objects.map((o) => (
                                    <div
                                        key={o.key}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white px-3 py-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-neutral-900">{o.key}</div>
                                            <div className="text-xs text-neutral-500">{o.size} bytes</div>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <Button variant="secondary" onClick={() => download(o.key)}>
                                                Download
                                            </Button>
                                            <Button variant="danger" onClick={() => del(o.key)}>
                                                Delete
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardBody>
                    </Card>
                </div>
            ) : null}

            {tab === "json" ? (
                <Card>
                    <CardHeader title="Resource JSON" subtitle="Full document." />
                    <CardBody>
                        <pre className="text-xs leading-5 text-neutral-800">{safeStringify(resource)}</pre>
                    </CardBody>
                </Card>
            ) : null}
        </div>
    );
}
