// src/pages/ComputeList.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import { Field, Input, Select, Textarea } from "../components/Field";
import { api } from "../api";

const mono = { fontFamily: "var(--mono)" };

function toInt(v, fallback) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

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

export default function ComputeList({ pushToast, navigate }) {
    const [loading, setLoading] = React.useState(false);

    const [teams, setTeams] = React.useState([]);
    const [teamId, setTeamId] = React.useState("");

    const [projects, setProjects] = React.useState([]);
    const [projectId, setProjectId] = React.useState("");

    const [items, setItems] = React.useState([]);

    // create form
    const [createOpen, setCreateOpen] = React.useState(false);
    const [name, setName] = React.useState("ssh-box");
    const [image, setImage] = React.useState("linuxserver/openssh-server:latest");
    const [sshUser, setSshUser] = React.useState("ubuntu");
    const [internalPort, setInternalPort] = React.useState(2222);
    const [cpu, setCpu] = React.useState(1);
    const [memoryMb, setMemoryMb] = React.useState(512);
    const [envJson, setEnvJson] = React.useState("{\n  \n}");

    async function reload(pid = projectId) {
        if (!pid) return;
        setLoading(true);
        try {
            const r = await api.listResources(pid);
            const arr = (r.resources || r || []).filter((x) => x.kind === "compute");
            // newest first
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
        navigate?.(`/compute/${rid}`);
    }

    async function createCompute() {
        if (!projectId) {
            pushToast?.({ type: "danger", title: "Missing project", message: "Select a project first." });
            return;
        }
        const nm = String(name || "").trim();
        if (!nm) {
            pushToast?.({ type: "danger", title: "Name required", message: "Enter a compute name." });
            return;
        }

        let env = {};
        try {
            env = envJson.trim() ? JSON.parse(envJson) : {};
            if (!env || typeof env !== "object" || Array.isArray(env)) throw new Error("env must be an object");
        } catch (e) {
            pushToast?.({ type: "danger", title: "Invalid env JSON", message: e.message });
            return;
        }

        // ✅ payload shape that matches your compute_instance catalog + overrides
        const payload = {
            projectId,
            catalogId: "compute_instance",
            name: nm,
            overrides: {
                mode: "iaas",
                image: String(image || "").trim() || "linuxserver/openssh-server:latest",
                resources: {
                    cpu: toInt(cpu, 1),
                    memoryMb: toInt(memoryMb, 512),
                },
                network: {
                    exposure: "internal",
                    internalPort: toInt(internalPort, 2222),
                },
                iaas: {
                    sshUser: String(sshUser || "ubuntu").trim() || "ubuntu",
                },
                env,
            },
        };

        setLoading(true);
        try {
            const out = await api.createResource(payload);
            const rid = out?.resource?.resourceId;
            pushToast?.({ type: "ok", title: "Compute created", message: rid || "OK" });
            await reload(projectId);
            setCreateOpen(false);
            if (rid) navigate?.(`/compute/${rid}`);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    function resetForm() {
        setName("ssh-box");
        setImage("linuxserver/openssh-server:latest");
        setSshUser("ubuntu");
        setInternalPort(2222);
        setCpu(1);
        setMemoryMb(512);
        setEnvJson("{\n  \n}");
    }

    const total = items.length;
    const activeCount = items.filter((x) => x.desiredState === "active").length;
    const pausedCount = items.filter((x) => x.desiredState === "paused").length;

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <Card
                title="Compute"
                right={
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Button variant="secondary" onClick={() => setCreateOpen((v) => !v)}>
                            {createOpen ? "Close create" : "Create instance"}
                        </Button>
                        <Button onClick={() => reload(projectId)} disabled={loading || !projectId}>
                            Refresh
                        </Button>
                    </div>
                }
            >
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div className="muted" style={{ maxWidth: 820 }}>
                        Compute instances map to catalog item <span style={mono}>compute_instance</span>. Use this to provision SSH
                        boxes and workloads inside your platform.
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
                <Card title="Create instance (IaaS SSH)">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <Field label="Name" hint="Resource name shown in list">
                            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ssh-box" />
                        </Field>

                        <Field label="Image" hint="Container image used by the compute provisioner">
                            <Input value={image} onChange={(e) => setImage(e.target.value)} placeholder="linuxserver/openssh-server:latest" />
                        </Field>

                        <Field label="SSH user" hint="User inside the container">
                            <Input value={sshUser} onChange={(e) => setSshUser(e.target.value)} placeholder="ubuntu" />
                        </Field>

                        <Field label="Internal SSH port" hint="Port inside the container (default 2222)">
                            <Input value={String(internalPort)} onChange={(e) => setInternalPort(e.target.value)} placeholder="2222" />
                        </Field>

                        <Field label="CPU" hint="Requested CPU (v1: informational)">
                            <Input value={String(cpu)} onChange={(e) => setCpu(e.target.value)} placeholder="1" />
                        </Field>

                        <Field label="Memory (MB)" hint="Requested memory (v1: informational)">
                            <Input value={String(memoryMb)} onChange={(e) => setMemoryMb(e.target.value)} placeholder="512" />
                        </Field>
                    </div>

                    <div style={{ marginTop: 12 }}>
                        <Field label="Environment (JSON object)" hint='Example: {"FOO":"bar"}'>
                            <Textarea value={envJson} onChange={(e) => setEnvJson(e.target.value)} />
                        </Field>
                    </div>

                    <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button onClick={createCompute} disabled={loading || !projectId}>
                            Create instance
                        </Button>
                        <Button variant="secondary" onClick={resetForm} disabled={loading}>
                            Reset
                        </Button>
                        <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={loading}>
                            Cancel
                        </Button>
                    </div>

                    <div className="small muted" style={{ marginTop: 10 }}>
                        Request: <span style={mono}>POST /v1/resources</span> with <span style={mono}>catalogId=compute_instance</span>{" "}
                        and overrides: <span style={mono}>mode/image/resources/network/iaas/env</span>.
                    </div>
                </Card>
            )}

            <Card title={`Instances (${items.length})`} right={<span className="small muted">Click a row to open</span>}>
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
                            key: "desiredState",
                            title: "Desired",
                            render: (r) => {
                                const d = r.desiredState || "unknown";
                                const tone = d === "active" ? "ok" : d === "paused" ? "warn" : d === "deleted" ? "danger" : "default";
                                return <Chip tone={tone}>{d}</Chip>;
                            },
                        },
                        {
                            key: "image",
                            title: "Image",
                            render: (r) => <span style={mono}>{r?.spec?.image || "-"}</span>,
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
                {!items.length && <div className="muted" style={{ marginTop: 10 }}>No compute resources in this project yet.</div>}
            </Card>
        </div>
    );
}
