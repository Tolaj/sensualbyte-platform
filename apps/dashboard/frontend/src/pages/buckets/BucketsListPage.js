// src/pages/buckets/BucketsListPage.js
import React from "react";
import { Link } from "react-router-dom";
import { api } from "../../api";
import { getWorkspace } from "../../utils/storage";
import { toast } from "../../ui/toast";
import { Card, CardBody, CardHeader } from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";

export default function BucketsListPage() {
    const ws = getWorkspace();
    const [rows, setRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const [name, setName] = React.useState("demo-bucket");

    async function load() {
        setLoading(true);
        try {
            const out = await api.listResources(ws.projectId);
            const items = out?.resources || out || [];
            setRows(items.filter((r) => r.kind === "bucket"));
        } catch (e) {
            toast.danger("Load failed", e.message);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        if (!ws.projectId) return;
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ws.projectId]);

    async function create() {
        try {
            const out = await api.createResource({
                projectId: ws.projectId,
                catalogId: "object_bucket",
                name: String(name || "").trim(),
                overrides: {},
            });
            toast.ok("Bucket created", out?.resource?.resourceId || "OK");
            await load();
        } catch (e) {
            toast.danger("Create failed", e.message);
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-lg font-semibold">Buckets</div>
                    <div className="mt-1 text-sm text-neutral-500">S3-compatible object storage via MinIO.</div>
                </div>
                <Button variant="secondary" onClick={load} disabled={loading}>
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader title="Create bucket" subtitle="Backed by MinIO." />
                    <CardBody>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <div className="text-xs font-medium text-neutral-600">Name</div>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-bucket" />
                            </div>
                            <Button onClick={create} disabled={!ws.projectId || !String(name || "").trim()}>
                                Create
                            </Button>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Buckets" subtitle={`Project: ${ws.projectId || "—"}`} />
                    <CardBody>
                        {loading ? <div className="text-sm text-neutral-500">Loading…</div> : null}
                        {!loading && rows.length === 0 ? <div className="text-sm text-neutral-500">No buckets yet.</div> : null}

                        <div className="mt-3 space-y-2">
                            {rows.map((r) => (
                                <Link
                                    key={r.resourceId}
                                    to={`/app/buckets/${encodeURIComponent(r.resourceId)}`}
                                    className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-3 hover:bg-neutral-50"
                                >
                                    <div>
                                        <div className="text-sm font-medium text-neutral-900">{r.name}</div>
                                        <div className="text-xs text-neutral-500">{r.resourceId}</div>
                                    </div>
                                    <div className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">bucket</div>
                                </Link>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
