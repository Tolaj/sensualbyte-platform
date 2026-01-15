// src/pages/workspace/WorkspaceBootstrap.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { getSettings, setSettings } from "../utils/storage";
import { Card } from "../ui/Card";

export default function WorkspaceBootstrap() {
    const nav = useNavigate();
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");

    const [teams, setTeams] = React.useState([]);
    const [projects, setProjects] = React.useState([]);

    const [teamName, setTeamName] = React.useState("My Team");
    const [projectName, setProjectName] = React.useState("My Project");

    async function load() {
        const t = await api.listTeams();
        const teamsList = t?.teams || t || [];
        setTeams(teamsList);

        const s = getSettings();
        if (s.teamId) {
            const p = await api.listProjects(s.teamId);
            setProjects(p?.projects || p || []);
        } else {
            setProjects([]);
        }
    }

    React.useEffect(() => {
        load().catch(() => { });
    }, []);

    const s = getSettings();
    const hasTeam = !!s.teamId;
    const hasProject = !!s.projectId;

    const step = !hasTeam ? "need_team" : !hasProject ? "need_project" : "done";

    return (
        <div className="space-y-4">
            <div>
                <div className="text-lg font-semibold">Workspace setup</div>
                <div className="mt-1 text-sm text-neutral-500">Create/select a team and project to start using resources.</div>
            </div>

            {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {teams.length ? (
                <Card title="Select team + project" subtitle="Your resources are scoped to a project.">
                    <div className="space-y-3">
                        <div className="grid gap-3 md:grid-cols-2">
                            <select
                                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                value={s.teamId}
                                onChange={async (e) => {
                                    const teamId = e.target.value;
                                    setSettings({ teamId, projectId: "" });
                                    await load();
                                }}
                                disabled={busy}
                            >
                                <option value="">Select a team…</option>
                                {teams.map((t) => (
                                    <option key={t.teamId} value={t.teamId}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                value={s.projectId}
                                onChange={(e) => {
                                    const projectId = e.target.value;
                                    setSettings({ projectId });
                                    nav("/app/overview", { replace: true });
                                }}
                                disabled={!s.teamId || busy}
                            >
                                <option value="">Select a project…</option>
                                {projects.map((p) => (
                                    <option key={p.projectId} value={p.projectId}>
                                        {p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </Card>
            ) : null}

            {step === "need_team" ? (
                <Card title="Create your first team" subtitle="Teams group projects and members.">
                    <div className="space-y-3">
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                        />
                        <button
                            className="h-10 rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                setError("");
                                try {
                                    const out = await api.createTeam({ name: teamName });
                                    const teamId = out?.team?.teamId;
                                    setSettings({ teamId, projectId: "" });
                                    await load();
                                } catch (e) {
                                    setError(e?.message || "Failed to create team");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            Create team
                        </button>
                    </div>
                </Card>
            ) : null}

            {step === "need_project" ? (
                <Card title="Create your first project" subtitle="Projects contain compute + storage resources.">
                    <div className="space-y-3">
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                            value={projectName}
                            onChange={(e) => setProjectName(e.target.value)}
                        />
                        <button
                            className="h-10 rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                            disabled={busy}
                            onClick={async () => {
                                setBusy(true);
                                setError("");
                                try {
                                    const s2 = getSettings();
                                    const out = await api.createProject({ teamId: s2.teamId, name: projectName });
                                    const projectId = out?.project?.projectId;
                                    setSettings({ projectId });
                                    nav("/app/overview", { replace: true });
                                } catch (e) {
                                    setError(e?.message || "Failed to create project");
                                } finally {
                                    setBusy(false);
                                }
                            }}
                        >
                            Create project
                        </button>
                    </div>
                </Card>
            ) : null}

            {step === "done" ? (
                <Card title="You're all set" subtitle="Go to Overview to start creating resources.">
                    <button
                        className="h-10 rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90"
                        onClick={() => nav("/app/overview", { replace: true })}
                    >
                        Go to Overview
                    </button>
                </Card>
            ) : null}
        </div>
    );
}
