// src/pages/workspace/WorkspaceSetupPage.js
import React from "react";
import { api } from "../api";
import { toast } from "../ui/toast";
import { getWorkspace, setWorkspace } from "../utils/storage";
import "../pages.css";

export default function WorkspaceSetupPage({ me, onWorkspaceReady, onLogout }) {
    const ws = getWorkspace();

    const [teams, setTeams] = React.useState([]);
    const [projects, setProjects] = React.useState([]);
    const [teamId, setTeamId] = React.useState(ws.teamId || "");
    const [projectId, setProjectId] = React.useState(ws.projectId || "");

    const [teamName, setTeamName] = React.useState("my-team");
    const [projectName, setProjectName] = React.useState("my-project");

    const [loading, setLoading] = React.useState(true);

    async function load() {
        setLoading(true);
        try {
            const t = await api.listTeams();
            const tArr = t?.teams || t || [];
            setTeams(tArr);

            const chosenTeam = teamId || tArr[0]?.teamId || "";
            if (chosenTeam && !teamId) setTeamId(chosenTeam);

            if (chosenTeam) {
                const p = await api.listProjects(chosenTeam); // requires teamId
                const pArr = p?.projects || p || [];
                setProjects(pArr);

                const chosenProject = projectId || pArr[0]?.projectId || "";
                if (chosenProject && !projectId) setProjectId(chosenProject);
            } else {
                setProjects([]);
            }
        } catch (e) {
            toast.danger("Workspace load failed", e.message);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    React.useEffect(() => {
        (async () => {
            try {
                if (!teamId) return;
                const p = await api.listProjects(teamId);
                const pArr = p?.projects || p || [];
                setProjects(pArr);
                const chosenProject = pArr[0]?.projectId || "";
                setProjectId((prev) => (prev && pArr.some((x) => x.projectId === prev) ? prev : chosenProject));
            } catch (e) {
                toast.danger("Projects load failed", e.message);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamId]);

    async function createTeam() {
        try {
            const out = await api.createTeam({ name: String(teamName || "").trim() });
            toast.ok("Team created", out?.team?.teamId || "OK");
            await load();
        } catch (e) {
            toast.danger("Create team failed", e.message);
        }
    }

    async function createProject() {
        try {
            if (!teamId) return toast.warn("Select a team", "Pick a team first.");
            const out = await api.createProject({ teamId, name: String(projectName || "").trim() });
            toast.ok("Project created", out?.project?.projectId || "OK");
            await load();
        } catch (e) {
            toast.danger("Create project failed", e.message);
        }
    }

    function continueIntoApp() {
        if (!teamId || !projectId) {
            toast.warn("Workspace required", "Select or create a team and project.");
            return;
        }
        setWorkspace({ teamId, projectId });
        onWorkspaceReady?.({ teamId, projectId });
    }

    return (
        <div className="sb-setup">
            <div className="sb-setup__head">
                <div>
                    <div className="sb-setup__title">Set up your workspace</div>
                    <div className="sb-setup__sub">
                        Choose a team and project. Resources are created inside projects (which belong to teams).
                    </div>
                </div>
                <button className="sb-btn sb-btn--ghost" onClick={onLogout}>
                    Sign out
                </button>
            </div>

            <div className="sb-grid2">
                <div className="sb-card">
                    <div className="sb-card__title">Team</div>
                    <div className="sb-card__sub">Teams contain projects.</div>

                    {loading ? (
                        <div className="sb-muted">Loading…</div>
                    ) : (
                        <>
                            <label className="sb-field">
                                <div className="sb-label">Select team</div>
                                <select className="sb-select" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                                    <option value="">— Select —</option>
                                    {teams.map((t) => (
                                        <option key={t.teamId} value={t.teamId}>
                                            {t.name} ({t.teamId})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="sb-divider" />

                            <label className="sb-field">
                                <div className="sb-label">Create team</div>
                                <input className="sb-input" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                            </label>
                            <button className="sb-btn sb-btn--secondary" onClick={createTeam}>
                                Create team
                            </button>
                        </>
                    )}
                </div>

                <div className="sb-card">
                    <div className="sb-card__title">Project</div>
                    <div className="sb-card__sub">Projects contain compute and buckets.</div>

                    {loading ? (
                        <div className="sb-muted">Loading…</div>
                    ) : (
                        <>
                            <label className="sb-field">
                                <div className="sb-label">Select project</div>
                                <select className="sb-select" value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!teamId}>
                                    <option value="">— Select —</option>
                                    {projects.map((p) => (
                                        <option key={p.projectId} value={p.projectId}>
                                            {p.name} ({p.projectId})
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <div className="sb-divider" />

                            <label className="sb-field">
                                <div className="sb-label">Create project</div>
                                <input className="sb-input" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                            </label>
                            <button className="sb-btn sb-btn--secondary" onClick={createProject} disabled={!teamId}>
                                Create project
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="sb-setup__cta">
                <div className="sb-muted">
                    Signed in as <b>{me?.email || "user"}</b>
                </div>
                <button className="sb-btn sb-btn--primary" onClick={continueIntoApp}>
                    Continue
                </button>
            </div>
        </div>
    );
}
