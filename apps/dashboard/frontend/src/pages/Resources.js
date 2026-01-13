// src/pages/Resources.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import JsonView from "../components/JsonView";
import { Field, Input, Select, Textarea } from "../components/Field";
import { api } from "../api";

function parseQuery() {
    const hash = window.location.hash || "";
    const idx = hash.indexOf("?");
    if (idx === -1) return {};
    const q = hash.slice(idx + 1);
    const params = new URLSearchParams(q);
    const out = {};
    for (const [k, v] of params.entries()) out[k] = v;
    return out;
}

export default function Resources({ pushToast }) {
    const [loading, setLoading] = React.useState(false);

    const [teams, setTeams] = React.useState([]);
    const [teamId, setTeamId] = React.useState("");

    const [projects, setProjects] = React.useState([]);
    const [projectId, setProjectId] = React.useState(() => parseQuery().projectId || "");

    const [catalog, setCatalog] = React.useState([]);
    const [resources, setResources] = React.useState([]);

    const [selected, setSelected] = React.useState(null);
    const [watching, setWatching] = React.useState(false);

    const [catalogId, setCatalogId] = React.useState("object_bucket");
    const [name, setName] = React.useState("demo-resource");
    const [overridesJson, setOverridesJson] = React.useState(`{
  "bucketName": "demo-bkt-CHANGE_ME",
  "publicRead": false
}`);

    async function loadTeams() {
        const t = await api.listTeams();
        const arr = t.teams || t || [];
        setTeams(arr);
        return arr;
    }

    async function loadProjectsForTeam(tid) {
        if (!tid) throw new Error("teamId required");
        const p = await api.listProjects(tid); // ✅ FIX: pass teamId
        const projArr = p.projects || p || [];
        setProjects(projArr);
        return projArr;
    }

    async function loadCatalog() {
        const c = await api.listCatalog();
        const catArr = c.items || c.catalog || c || [];
        setCatalog(catArr);
        return catArr;
    }

    async function loadResources(pid = projectId) {
        if (!pid) return;
        setLoading(true);
        try {
            const r = await api.listResources(pid);
            setResources(r.resources || r || []);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Load resources failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    async function loadBootstrap() {
        setLoading(true);
        try {
            // 1) teams
            const tArr = await loadTeams();

            // choose team
            const initialTeamId = teamId || tArr[0]?.teamId || "";
            setTeamId(initialTeamId);

            // 2) projects (requires teamId)
            let projArr = [];
            if (initialTeamId) {
                projArr = await loadProjectsForTeam(initialTeamId);
            } else {
                setProjects([]);
            }

            // choose project
            const qProjectId = parseQuery().projectId || "";
            const initialProjectId = qProjectId || projectId || projArr[0]?.projectId || "";
            if (initialProjectId !== projectId) setProjectId(initialProjectId);

            // 3) catalog
            const catArr = await loadCatalog();
            if (!catalogId && catArr[0]?.catalogId) setCatalogId(catArr[0].catalogId);

            // 4) resources
            if (initialProjectId) await loadResources(initialProjectId);
            else setResources([]);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Bootstrap failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    // first load
    React.useEffect(() => {
        loadBootstrap();
        // eslint-disable-next-line
    }, []);

    // when team changes -> reload projects -> pick first project -> reload resources
    React.useEffect(() => {
        if (!teamId) return;

        let cancelled = false;

        (async () => {
            setLoading(true);
            try {
                const projArr = await loadProjectsForTeam(teamId);

                const nextProjectId = projArr[0]?.projectId || "";
                if (!cancelled) {
                    setProjectId(nextProjectId);
                    setSelected(null);
                    setWatching(false);
                    if (nextProjectId) await loadResources(nextProjectId);
                    else setResources([]);
                }
            } catch (e) {
                if (!cancelled) pushToast?.({ type: "danger", title: "Load projects failed", message: e.message });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line
    }, [teamId]);

    // when project changes -> reload resources
    React.useEffect(() => {
        if (projectId) loadResources(projectId);
        // eslint-disable-next-line
    }, [projectId]);

    async function create() {
        try {
            if (!projectId) throw new Error("projectId required");
            const overrides = overridesJson.trim() ? JSON.parse(overridesJson) : {};
            const payload = {
                projectId,
                catalogId,
                name,
                overrides,
            };
            const out = await api.createResource(payload);
            const rid = out.resource?.resourceId;
            pushToast?.({ type: "ok", title: "Resource created", message: rid || "OK" });

            await loadResources(projectId);

            if (rid) {
                const full = await api.getResource(rid);
                setSelected(full);
            }
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create failed", message: e.message });
        }
    }

    async function openResource(r) {
        try {
            const rid = r.resourceId || r.id;
            const full = await api.getResource(rid);
            setSelected(full);
            setWatching(false);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Open failed", message: e.message });
        }
    }

    // watch status
    React.useEffect(() => {
        if (!watching || !selected?.resource?.resourceId) return;
        let stop = false;

        async function tick() {
            try {
                const rid = selected.resource.resourceId;
                const full = await api.getResource(rid);
                if (!stop) setSelected(full);

                const st = full.status?.state;
                if (st === "ready" || st === "error") {
                    pushToast?.({
                        type: st === "ready" ? "ok" : "danger",
                        title: `Resource ${st}`,
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
        return () => {
            stop = true;
        };
    }, [watching, selected, pushToast]);

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Resources</div>
                    <div className="muted">Create from catalog + inspect status</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <Button onClick={() => loadResources(projectId)} disabled={loading || !projectId}>
                        Refresh
                    </Button>
                    <Button variant="secondary" onClick={() => setSelected(null)}>
                        Clear Selection
                    </Button>
                </div>
            </div>

            <Card title="Create Resource">
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
                        <Select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            disabled={loading || !projects.length}
                        >
                            {projects.map((p) => (
                                <option key={p.projectId} value={p.projectId}>
                                    {p.name} ({p.projectId})
                                </option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Catalog Item">
                        <Select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} disabled={loading}>
                            {(catalog.length
                                ? catalog
                                : [
                                    { catalogId: "persistent_volume" },
                                    { catalogId: "object_bucket" },
                                    { catalogId: "compute_instance" },
                                    { catalogId: "http_route" },
                                ]
                            ).map((c) => (
                                <option key={c.catalogId} value={c.catalogId}>
                                    {c.catalogId}
                                </option>
                            ))}
                        </Select>
                    </Field>

                    <Field label="Name">
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </Field>

                    <Field label="Overrides (JSON)" hint="This becomes .overrides in POST /v1/resources">
                        <Textarea value={overridesJson} onChange={(e) => setOverridesJson(e.target.value)} />
                    </Field>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 10 }}>
                    <Button onClick={create} disabled={!projectId || !catalogId || loading}>
                        Create
                    </Button>
                    <Button variant="secondary" onClick={() => setOverridesJson("{\n  \n}")}>
                        Clear overrides
                    </Button>
                </div>
            </Card>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14 }}>
                <Card
                    title={`Resources (${resources.length})`}
                    right={<span className="small muted">Click row to inspect</span>}
                >
                    <Table
                        columns={[
                            {
                                key: "resourceId",
                                title: "resourceId",
                                render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.resourceId}</span>,
                            },
                            { key: "kind", title: "kind" },
                            { key: "name", title: "name" },
                            { key: "desiredState", title: "desired" },
                            { key: "generation", title: "gen" },
                        ]}
                        rows={resources}
                        onRowClick={openResource}
                    />
                </Card>

                <Card
                    title="Selected"
                    right={
                        selected?.resource?.resourceId ? (
                            <div style={{ display: "flex", gap: 10 }}>
                                <Button variant="secondary" onClick={() => setWatching((v) => !v)}>
                                    {watching ? "Stop Watch" : "Watch Status"}
                                </Button>
                            </div>
                        ) : null
                    }
                >
                    {selected ? <JsonView value={selected} /> : <div className="muted">Select a resource to see full details + status.</div>}
                </Card>
            </div>
        </div>
    );
}
