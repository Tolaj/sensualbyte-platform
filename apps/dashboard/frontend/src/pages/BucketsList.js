// src/pages/BucketsList.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import { Field, Input, Select, Textarea } from "../components/Field";
import { api } from "../api";

const mono = { fontFamily: "var(--mono)" };

function fmtTs(s) {
    if (!s) return "";
    return String(s).slice(0, 19).replace("T", " ");
}

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

export default function BucketsList({ pushToast, navigate }) {
    const [loading, setLoading] = React.useState(false);

    const [teams, setTeams] = React.useState([]);
    const [teamId, setTeamId] = React.useState("");

    const [projects, setProjects] = React.useState([]);
    const [projectId, setProjectId] = React.useState("");

    const [items, setItems] = React.useState([]);

    // create form
    const [createOpen, setCreateOpen] = React.useState(false);
    const [name, setName] = React.useState("bucket");
    const [bucketName, setBucketName] = React.useState("");
    const [publicRead, setPublicRead] = React.useState(false);
    const [labelsJson, setLabelsJson] = React.useState("{\n  \n}");

    async function reload(pid = projectId) {
        if (!pid) return;
        setLoading(true);
        try {
            const r = await api.listResources(pid);
            const arr = (r.resources || r || []).filter((x) => x.kind === "bucket");
            arr.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
            setItems(arr);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Reload failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function bootstrap() {
        setLoading(true);
        try {
            const t = await api.listTeams();
            const tArr = t.teams || t || [];
            setTeams(tArr);

            const tid = tArr[0]?.teamId || "";
            setTeamId(tid);

            if (tid) {
                const p = await api.listProjects(tid);
                const pArr = p.projects || p || [];
                setProjects(pArr);

                const pid = pArr[0]?.projectId || "";
                setProjectId(pid);

                if (pid) await reload(pid);
            }
        } catch (e) {
            pushToast?.({ type: "danger", title: "Load failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        bootstrap();
        // eslint-disable-next-line
    }, []);

    React.useEffect(() => {
        if (!teamId) return;
        (async () => {
            setLoading(true);
            try {
                const p = await api.listProjects(teamId);
                const pArr = p.projects || p || [];
                setProjects(pArr);

                const pid = pArr[0]?.projectId || "";
                setProjectId(pid);

                if (pid) await reload(pid);
                else setItems([]);
            } catch (e) {
                pushToast?.({ type: "danger", title: "Projects failed", message: e.message });
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line
    }, [teamId]);

    React.useEffect(() => {
        if (projectId) reload(projectId);
        // eslint-disable-next-line
    }, [projectId]);

    function openRow(r) {
        const rid = r.resourceId || r.id;
        if (!rid) return;
        navigate?.(`/buckets/${rid}`);
    }

    function resetForm() {
        setName("bucket");
        setBucketName("");
        setPublicRead(false);
        setLabelsJson("{\n  \n}");
    }

    async function createBucket() {
        if (!projectId) {
            pushToast?.({ type: "danger", title: "Missing project", message: "Select a project first." });
            return;
        }
        const nm = String(name || "").trim();
        if (!nm) {
            pushToast?.({ type: "danger", title: "Name required", message: "Enter a bucket resource name." });
            return;
        }

        let labels = {};
        try {
            labels = labelsJson.trim() ? JSON.parse(labelsJson) : {};
            if (!labels || typeof labels !== "object" || Array.isArray(labels)) throw new Error("labels must be an object");
        } catch (e) {
            pushToast?.({ type: "danger", title: "Invalid labels JSON", message: e.message });
            return;
        }

        const bkt = String(bucketName || "").trim();

        const payload = {
            projectId,
            catalogId: "object_bucket",
            name: nm,
            overrides: {
                ...(bkt ? { bucketName: bkt } : {}),
                publicRead: !!publicRead,
                labels,
            },
        };

        setLoading(true);
        try {
            const out = await api.createResource(payload);
            const rid = out?.resource?.resourceId;
            pushToast?.({ type: "ok", title: "Bucket created", message: rid || "OK" });

            await reload(projectId);
            setCreateOpen(false);

            if (rid) navigate?.(`/buckets/${rid}`);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    const total = items.length;
    const activeCount = items.filter((x) => x.desiredState === "active").length;
    const pausedCount = items.filter((x) => x.desiredState === "paused").length;

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <Card
                title="Buckets"
                right={
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button variant="secondary" onClick={() => setCreateOpen((v) => !v)}>
                            {createOpen ? "Close create" : "Create bucket"}
                        </Button>
                        <Button onClick={() => reload(projectId)} disabled={loading || !projectId}>
                            Refresh
                        </Button>
                    </div>
                }
            >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div className="muted" style={{ maxWidth: 900 }}>
                        Buckets map to catalog item <span style={mono}>object_bucket</span> and are backed by shared MinIO{" "}
                        (<span style={mono}>sb-minio</span>). Use buckets for artifacts, files, and object storage.
                    </div>
                    <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
                        <Chip>{total} total</Chip>
                        <Chip tone="ok">{activeCount} active</Chip>
                        <Chip tone="warn">{pausedCount} paused</Chip>
                    </div>
                </div>
            </Card>

            <Card title="Scope">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Team">
                        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={loading}>
                            {teams.map((t) => (
                                <option key={t.teamId} value={t.teamId}>
                                    {t.name} ({t.teamId})
                                </option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Project">
                        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loading || !projects.length}>
                            {projects.map((p) => (
                                <option key={p.projectId} value={p.projectId}>
                                    {p.name} ({p.projectId})
                                </option>
                            ))}
                        </Select>
                    </Field>
                </div>
            </Card>

            {createOpen && (
                <Card title="Create bucket (MinIO)">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Resource name" hint="Name shown in the dashboard">
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="bucket" />
                        </Field>

                        <Field label="Bucket name (optional)" hint="If empty, the platform auto-generates one">
                            <Input value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="my-bucket-name" />
                        </Field>

                        <Field label="Public read" hint="v1 flag (policy wiring later)">
                            <Select value={publicRead ? "1" : "0"} onChange={(e) => setPublicRead(e.target.value === "1")}>
                                <option value="0">false</option>
                                <option value="1">true</option>
                            </Select>
                        </Field>

                        <Field label="Provider">
                            <Input value="MinIO (sb-minio)" disabled />
                        </Field>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <Field label="Labels (JSON object)" hint='Example: {"env":"dev","owner":"swapnil"}'>
                            <Textarea value={labelsJson} onChange={(e) => setLabelsJson(e.target.value)} />
                        </Field>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button onClick={createBucket} disabled={loading || !projectId}>
                            Create bucket
                        </Button>
                        <Button variant="secondary" onClick={resetForm} disabled={loading}>
                            Reset
                        </Button>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={loading}>
                            Cancel
                        </Button>
                    </div>

                    <div className="small muted" style={{ marginTop: 10 }}>
                        Request: <span style={mono}>POST /v1/resources</span> with <span style={mono}>catalogId=object_bucket</span> and overrides{" "}
                        <span style={mono}>bucketName/publicRead/labels</span>.
                    </div>
                </Card>
            )}

            <Card title={`Buckets (${items.length})`} right={<span className="small muted">Click a row to open</span>}>
                <Table
                    columns={[
                        {
                            key: "name",
                            title: "Name",
                            render: (r) => (
                                <div style={{ display: "grid", gap: 2 }}>
                                    <div style={{ fontWeight: 900 }}>{r.name || "-"}</div>
                                    <div className="muted small" style={mono}>
                                        {r.resourceId}
                                    </div>
                                </div>
                            ),
                        },
                        {
                            key: "bucketName",
                            title: "Bucket",
                            render: (r) => <span style={mono}>{r?.spec?.bucketName || "-"}</span>,
                        },
                        {
                            key: "desiredState",
                            title: "Desired",
                            render: (r) => {
                                const d = r.desiredState || "unknown";
                                const tone = d === "active" ? "ok" : d === "paused" ? "warn" : d === "deleted" ? "danger" : "default";
                                return <Chip tone={tone}>{d}</Chip>;
                            },
                        },
                        {
                            key: "gen",
                            title: "Gen",
                            render: (r) => <span className="muted">{r.generation ?? "-"}</span>,
                        },
                        {
                            key: "createdAt",
                            title: "Created",
                            render: (r) => <span className="muted small">{fmtTs(r.createdAt)}</span>,
                        },
                    ]}
                    rows={items}
                    onRowClick={openRow}
                />
                {!items.length && <div className="muted" style={{ marginTop: 10 }}>No buckets in this project yet.</div>}
            </Card>
        </div>
    );
}
