import React from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api";
import { toast } from "../../ui/toast";
import { Card, CardBody, CardHeader } from "../../ui/Card";
import Button from "../../ui/Button";
import { safeStringify, fmtTime } from "../../utils/format";

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

function Copy({ text }) {
    return (
        <button
            className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
            onClick={() => navigator.clipboard.writeText(String(text || ""))}
        >
            Copy
        </button>
    );
}

export default function ComputeDetailPage() {
    const { resourceId } = useParams();
    const [resource, setResource] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [tab, setTab] = React.useState("overview");

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

    React.useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resourceId]);

    async function setState(desiredState) {
        try {
            await api.setDesiredState(resourceId, desiredState);
            toast.ok("Updated", `desiredState=${desiredState}`);
            await load();
        } catch (e) {
            toast.danger("Update failed", e.message);
        }
    }

    const name = resource?.name || "Compute";
    const desired = resource?.desiredState || "active";
    const statusMsg = resource?.status?.message || "";
    const lastKnown = resource?.status?.lastKnown || resource?.lastKnown || null;

    const ssh = lastKnown?.ssh;
    const sshCmd = ssh?.host && ssh?.port && ssh?.user ? `ssh ${ssh.user}@${ssh.host} -p ${ssh.port}` : "";

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="text-lg font-semibold">{name}</div>
                        <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700">desired: {desired}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                        <span>{resourceId}</span>
                        <Copy text={resourceId} />
                    </div>
                    {statusMsg ? <div className="text-sm text-neutral-600">{statusMsg}</div> : null}
                </div>

                <div className="flex gap-2">
                    <Button variant="secondary" onClick={load} disabled={loading}>
                        Refresh
                    </Button>
                    <Link to="/app/compute">
                        <Button variant="ghost">Back</Button>
                    </Link>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <Tabs
                    value={tab}
                    onChange={setTab}
                    items={[
                        { value: "overview", label: "Overview" },
                        { value: "observability", label: "Observability" },
                        { value: "json", label: "JSON" },
                    ]}
                />

                <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setState("active")}>Activate</Button>
                    <Button variant="secondary" onClick={() => setState("paused")}>
                        Pause
                    </Button>
                    <Button variant="danger" onClick={() => setState("deleted")}>
                        Delete
                    </Button>
                </div>
            </div>

            {tab === "overview" ? (
                <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                        <CardHeader title="Summary" subtitle="Key resource fields." />
                        <CardBody>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-3">
                                    <span className="text-neutral-500">Kind</span>
                                    <span className="text-neutral-900">{resource?.kind || "compute"}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-neutral-500">Desired state</span>
                                    <span className="text-neutral-900">{desired}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-neutral-500">Created</span>
                                    <span className="text-neutral-900">{fmtTime(resource?.createdAt)}</span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-neutral-500">Updated</span>
                                    <span className="text-neutral-900">{fmtTime(resource?.updatedAt)}</span>
                                </div>
                            </div>
                        </CardBody>
                    </Card>

                    <Card>
                        <CardHeader title="SSH" subtitle="If available from lastKnown status." />
                        <CardBody>
                            {sshCmd ? (
                                <div className="space-y-2">
                                    <div className="rounded-xl border border-black/10 bg-neutral-50 px-3 py-2 text-sm font-mono">
                                        {sshCmd}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(sshCmd)}>
                                            Copy command
                                        </Button>
                                        {lastKnown?.sshKeySecretRef ? <Copy text={lastKnown.sshKeySecretRef} /> : null}
                                    </div>
                                    {lastKnown?.sshKeySecretRef ? (
                                        <div className="text-xs text-neutral-500">sshKeySecretRef: {lastKnown.sshKeySecretRef}</div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="text-sm text-neutral-500">SSH details not available yet.</div>
                            )}
                        </CardBody>
                    </Card>
                </div>
            ) : null}

            {tab === "observability" ? (
                <Card>
                    <CardHeader title="Last known runtime" subtitle="Controller-observed state snapshot." />
                    <CardBody>
                        {lastKnown ? (
                            <pre className="text-xs leading-5 text-neutral-800">{safeStringify(lastKnown)}</pre>
                        ) : (
                            <div className="text-sm text-neutral-500">No lastKnown runtime state yet.</div>
                        )}
                    </CardBody>
                </Card>
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
