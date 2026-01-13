// src/pages/Projects.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import { Field, Input, Select } from "../components/Field";
import { api } from "../api";

export default function Projects({ pushToast }) {
    const [loading, setLoading] = React.useState(false);
    const [teams, setTeams] = React.useState([]);
    const [projects, setProjects] = React.useState([]);

    const [teamId, setTeamId] = React.useState("");
    const [projectName, setProjectName] = React.useState("demo-project");

    async function load() {
        setLoading(true);
        try {
            const t = await api.listTeams();
            const teamsArr = t.teams || t || [];
            setTeams(teamsArr);

            const chosenTeamId = teamId || teamsArr[0]?.teamId || "";
            if (!teamId && chosenTeamId) setTeamId(chosenTeamId);

            // ✅ projects list requires teamId
            const p = await api.listProjects(chosenTeamId);
            const projArr = p.projects || p || [];
            setProjects(projArr);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Load failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }


    React.useEffect(() => { load(); }, []);

    // add this:
    React.useEffect(() => {
        if (teamId) {
            (async () => {
                try {
                    const p = await api.listProjects(teamId);
                    setProjects(p.projects || p || []);
                } catch (e) {
                    pushToast?.({ type: "danger", title: "Load projects failed", message: e.message });
                }
            })();
        }
        // eslint-disable-next-line
    }, [teamId]);


    async function createProject() {
        try {
            const out = await api.createProject({ teamId, name: projectName });
            pushToast?.({ type: "ok", title: "Project created", message: out.project?.projectId || "OK" });
            await load();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create project failed", message: e.message });
        }
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Projects</div>
                    <div className="muted">Create and list projects</div>
                </div>
                <Button onClick={load} disabled={loading}>Refresh</Button>
            </div>

            <Card title="Create Project">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 160px", gap: 12 }}>
                    <Field label="Team">
                        <Select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                            {teams.map((t) => (
                                <option key={t.teamId} value={t.teamId}>{t.name} ({t.teamId})</option>
                            ))}
                        </Select>
                    </Field>
                    <Field label="Project name">
                        <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                    </Field>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                        <Button onClick={createProject} disabled={!teamId}>Create</Button>
                    </div>
                </div>
            </Card>

            <Card title={`Projects (${projects.length})`}>
                <Table
                    columns={[
                        { key: "projectId", title: "projectId", render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.projectId}</span> },
                        { key: "teamId", title: "teamId", render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.teamId}</span> },
                        { key: "name", title: "name" },
                        { key: "createdAt", title: "createdAt" },
                    ]}
                    rows={projects}
                    onRowClick={(r) => {
                        pushToast?.({ type: "ok", title: "Selected project", message: r.projectId });
                        // store in hash for quick navigation
                        window.location.hash = `#/resources?projectId=${encodeURIComponent(r.projectId)}`;
                    }}
                />
                <div className="small muted" style={{ marginTop: 10 }}>
                    Click a project to jump to Resources filtered by projectId.
                </div>
            </Card>
        </div>
    );
}
