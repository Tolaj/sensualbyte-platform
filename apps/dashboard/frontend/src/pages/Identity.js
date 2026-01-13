// src/pages/Identity.js
import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Table from "../components/Table";
import JsonView from "../components/JsonView";
import { Field, Input, Textarea } from "../components/Field";
import { api } from "../api";

export default function Identity({ pushToast }) {
    const [users, setUsers] = React.useState([]);
    const [teams, setTeams] = React.useState([]);
    const [roles, setRoles] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    const [newUserJson, setNewUserJson] = React.useState(`{
  "email": "user_${Date.now()}@sensualbyte.local",
  "displayName": "New User"
}`);
    const [newTeamName, setNewTeamName] = React.useState("demo-team");

    async function load() {
        setLoading(true);
        try {
            const [u, t, r] = await Promise.all([
                api.listUsers(),
                api.listTeams(),
                api.listIamRoles(),
            ]);

            setUsers(u.users || u || []);
            setTeams(t.teams || t || []);
            setRoles(r.roles || r || []);
        } catch (e) {
            pushToast?.({ type: "danger", title: "Identity load failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => { load(); }, []);

    async function createTeam() {
        try {
            const out = await api.createTeam({ name: newTeamName });
            pushToast?.({ type: "ok", title: "Team created", message: out.team?.teamId || "OK" });
            await load();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create team failed", message: e.message });
        }
    }

    async function createUser() {
        try {
            const payload = JSON.parse(newUserJson);
            const out = await api.createUser(payload);
            pushToast?.({ type: "ok", title: "User created", message: out.user?.userId || "OK" });
            await load();
        } catch (e) {
            pushToast?.({ type: "danger", title: "Create user failed", message: e.message });
        }
    }

    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                    <div style={{ fontSize: 18, fontWeight: 950 }}>Identity</div>
                    <div className="muted">Users, Teams, IAM Roles</div>
                </div>
                <Button onClick={load} disabled={loading}>Refresh</Button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Card title="Create Team">
                    <Field label="Team name">
                        <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                    </Field>
                    <div style={{ height: 10 }} />
                    <Button onClick={createTeam}>Create</Button>
                </Card>

                <Card title="Create User (JSON)">
                    <Field label="Payload" hint="POST /v1/identity/users">
                        <Textarea value={newUserJson} onChange={(e) => setNewUserJson(e.target.value)} />
                    </Field>
                    <div style={{ height: 10 }} />
                    <Button onClick={createUser}>Create</Button>
                </Card>
            </div>

            <Card title={`Teams (${teams.length})`}>
                <Table
                    columns={[
                        { key: "teamId", title: "teamId", render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.teamId || r.id || ""}</span> },
                        { key: "name", title: "name" },
                        { key: "createdAt", title: "createdAt" },
                    ]}
                    rows={teams}
                />
            </Card>

            <Card title={`Users (${users.length})`}>
                <Table
                    columns={[
                        { key: "userId", title: "userId", render: (r) => <span style={{ fontFamily: "var(--mono)" }}>{r.userId || r.id || ""}</span> },
                        { key: "email", title: "email" },
                        { key: "displayName", title: "displayName" },
                    ]}
                    rows={users}
                />
            </Card>

            <Card title={`IAM Roles (${roles.length})`}>
                <JsonView value={roles} />
            </Card>
        </div>
    );
}
