// src/ui/WorkspaceSwitcher.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import { api } from "../api";
import { setSettings } from "../utils/storage";
import { useSettings } from "../utils/useSettings";

export default function WorkspaceSwitcher() {
    const nav = useNavigate();
    const s = useSettings();

    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");

    const [teams, setTeams] = React.useState([]);
    const [projects, setProjects] = React.useState([]);

    const loadedRef = React.useRef(false);

    async function loadTeamsAndProjects() {
        setBusy(true);
        setError("");
        try {
            const t = await api.listTeams();
            const teamRows = t?.teams || t || [];
            setTeams(teamRows);

            const teamId = s.teamId || teamRows?.[0]?.teamId || "";
            if (teamId && teamId !== s.teamId) setSettings({ teamId, projectId: "" });

            if (teamId) {
                const p = await api.listProjects(teamId);
                const projRows = p?.projects || p || [];
                setProjects(projRows);

                const projectId = s.projectId || projRows?.[0]?.projectId || "";
                if (projectId && projectId !== s.projectId) setSettings({ projectId });
            } else {
                setProjects([]);
            }
        } catch (e) {
            setError(e?.message || "Failed to load workspace");
        } finally {
            setBusy(false);
        }
    }

    // Fetch only when the dropdown opens the first time
    React.useEffect(() => {
        if (!open) return;
        if (loadedRef.current) return;
        loadedRef.current = true;
        loadTeamsAndProjects().catch(() => { });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // close on outside click
    const ref = React.useRef(null);
    React.useEffect(() => {
        function onDoc(e) {
            if (!open) return;
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener("mousedown", onDoc);
        return () => document.removeEventListener("mousedown", onDoc);
    }, [open]);

    const hasWorkspace = !!(s.teamId && s.projectId);
    const teamName = teams.find((t) => t.teamId === s.teamId)?.name || s.teamId || "No team";
    const projectName = projects.find((p) => p.projectId === s.projectId)?.name || s.projectId || "No project";

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((v) => !v)}
                className={clsx(
                    "hidden md:flex items-center gap-2 rounded-xl border border-black/5 bg-white px-3 py-2 text-sm hover:bg-neutral-50",
                    busy && "opacity-70"
                )}
            >
                <div className="flex flex-col items-start leading-4">
                    <span className="text-neutral-900 font-medium">{hasWorkspace ? teamName : "Workspace"}</span>
                    <span className="text-neutral-500 text-xs">{hasWorkspace ? projectName : "Select team + project"}</span>
                </div>
                <ChevronDown size={16} className="text-neutral-400" />
            </button>

            {open ? (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-black/5 bg-white shadow-soft">
                    <div className="p-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Workspace
                    </div>

                    <div className="px-3 pb-3 space-y-3">
                        {error ? (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                {error}
                                <div className="mt-2 text-xs text-red-700/80">
                                    Backend is returning 500 on <code>/v1/identity/teams</code> — likely missing <code>req.ctx.db</code>.
                                </div>
                            </div>
                        ) : null}

                        <button
                            className="h-10 w-full rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                            disabled={busy}
                            onClick={() => {
                                setOpen(false);
                                nav("/app/workspace", { replace: true });
                            }}
                        >
                            Open workspace setup
                        </button>

                        {teams.length ? (
                            <>
                                <div>
                                    <div className="mb-1 text-xs font-medium text-neutral-600">Team</div>
                                    <select
                                        className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                        value={s.teamId || ""}
                                        onChange={async (e) => {
                                            const teamId = e.target.value;
                                            setSettings({ teamId, projectId: "" });
                                            setOpen(false);
                                            nav("/app/workspace", { replace: true });
                                        }}
                                    >
                                        <option value="">Select a team…</option>
                                        {teams.map((t) => (
                                            <option key={t.teamId} value={t.teamId}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <div className="mb-1 text-xs font-medium text-neutral-600">Project</div>
                                    <select
                                        className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                        value={s.projectId || ""}
                                        onChange={(e) => {
                                            const projectId = e.target.value;
                                            setSettings({ projectId });
                                            setOpen(false);
                                            nav("/app/overview", { replace: true });
                                        }}
                                        disabled={!s.teamId}
                                    >
                                        <option value="">Select a project…</option>
                                        {projects.map((p) => (
                                            <option key={p.projectId} value={p.projectId}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : null}

                        {!teams.length && !busy && !error ? (
                            <div className="text-sm text-neutral-500">Open to load teams.</div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
