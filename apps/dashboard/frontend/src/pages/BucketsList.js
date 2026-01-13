import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import { Field, Select } from "../components/Field";
import { api } from "../api";

export default function BucketsList({ pushToast, navigate }) {
    const [loading, setLoading] = React.useState(false);
    const [teams, setTeams] = React.useState([]);
    const [teamId, setTeamId] = React.useState("");
    const [projects, setProjects] = React.useState([]);
    const [projectId, setProjectId] = React.useState("");
    const [items, setItems] = React.useState([]);

    async function reload(pid = projectId) {
        if (!pid) return;
        setLoading(true);
        try {
            const r = await api.listResources(pid);
            const arr = (r.resources || r || []).filter((x) => x.kind === "bucket");
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

    React.useEffect(() => { bootstrap(); /* eslint-disable-next-line */ }, []);

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

    React.useEffect(() => { if (projectId) reload(projectId); /* eslint-disable-next-line */ }, [projectId]);

    // inside BucketsList.js
    function onRowClick(r) {
        const rid = r.resourceId || r.id || r._id;
        if (!rid) return;
        window.location.hash = `#/buckets/${rid}`;
    }



    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Buckets</div>
                    <div className="muted">Object storage buckets (MinIO-backed)</div>
                </div>
                <Button onClick={() => reload(projectId)} disabled={loading || !projectId}>Refresh</Button>
            </div>

            <Card title="Scope">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Field label="Team">
                        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={loading}>
                            {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.name} ({t.teamId})</option>)}
                        </Select>
                    </Field>
                    <Field label="Project">
                        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={loading || !projects.length}>
                            {projects.map((p) => <option key={p.projectId} value={p.projectId}>{p.name} ({p.projectId})</option>)}
                        </Select>
                    </Field>
                </div>
            </Card>

            <Card title={`Buckets (${items.length})`} right={<span className="small muted">Click to open</span>}>
                <Table
                    columns={[
                        { key: "resourceId", title: "resourceId", render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.resourceId}</span> },
                        { key: "name", title: "name" },
                        { key: "desiredState", title: "desired" },
                        { key: "generation", title: "gen" },
                    ]}
                    rows={items}
                    onRowClick={onRowClick}
                />
            </Card>
        </div>
    );
}
