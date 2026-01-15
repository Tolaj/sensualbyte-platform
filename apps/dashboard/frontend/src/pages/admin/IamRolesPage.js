import React from "react";
import { api } from "../../api";
import { toast } from "../../ui/toast";
import { Card, CardBody, CardHeader } from "../../ui/Card";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { useAuth } from "../../auth/AuthProvider";

function parsePerms(text) {
    return String(text || "")
        .split(/[\n,]+/g)
        .map((s) => s.trim())
        .filter(Boolean);
}

export default function IamRolesPage() {
    const { me } = useAuth();
    const isSuperAdmin = me?.globalRole === "super_admin";

    const [roles, setRoles] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    const [name, setName] = React.useState("project_viewer_custom");
    const [scopeType, setScopeType] = React.useState("project");
    const [permissionsText, setPermissionsText] = React.useState("project.read\nresource.read");

    async function load() {
        setLoading(true);
        try {
            const out = await api.listIamRoles();
            setRoles(out?.roles || out || []);
        } catch (e) {
            toast.danger("Load failed", e.message);
        } finally {
            setLoading(false);
        }
    }

    React.useEffect(() => {
        load();
    }, []);

    async function create() {
        try {
            const permissions = parsePerms(permissionsText);
            const out = await api.createIamRole({ name, scopeType, permissions });
            toast.ok("Role created", out?.role?.roleId || name);
            await load();
        } catch (e) {
            toast.danger("Create failed", e.message);
        }
    }

    async function remove(roleId) {
        try {
            await api.deleteIamRole(roleId);
            toast.ok("Deleted", roleId);
            await load();
        } catch (e) {
            toast.danger("Delete failed", e.message);
        }
    }

    if (!isSuperAdmin) {
        return (
            <div className="rounded-xl border border-black/5 bg-white p-4 text-sm text-neutral-700">
                You don’t have access to Admin pages (super_admin only).
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="text-lg font-semibold">IAM Roles</div>
                    <div className="mt-1 text-sm text-neutral-500">
                        Create and manage role permission sets.
                    </div>
                </div>
                <Button variant="secondary" onClick={load} disabled={loading}>
                    Refresh
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader title="Create role" subtitle="Roles are permission bundles; scopeType must match bindings." />
                    <CardBody>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <div className="text-xs font-medium text-neutral-600">Name</div>
                                <Input value={name} onChange={(e) => setName(e.target.value)} />
                            </div>

                            <div className="space-y-1">
                                <div className="text-xs font-medium text-neutral-600">Scope type</div>
                                <select
                                    className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm"
                                    value={scopeType}
                                    onChange={(e) => setScopeType(e.target.value)}
                                >
                                    <option value="global">global</option>
                                    <option value="user">user</option>
                                    <option value="team">team</option>
                                    <option value="project">project</option>
                                    <option value="resource">resource</option>
                                    <option value="secret">secret</option>
                                    <option value="bucket">bucket</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <div className="text-xs font-medium text-neutral-600">Permissions</div>
                                <textarea
                                    className="min-h-[120px] w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-300 focus:ring-4 focus:ring-black/5"
                                    value={permissionsText}
                                    onChange={(e) => setPermissionsText(e.target.value)}
                                    placeholder={"project.read\nproject.list\nresource.read\nresource.create"}
                                />
                                <div className="text-xs text-neutral-500">One per line (or comma-separated).</div>
                            </div>

                            <Button onClick={create} disabled={!name.trim()}>
                                Create role
                            </Button>
                        </div>
                    </CardBody>
                </Card>

                <Card>
                    <CardHeader title="Existing roles" subtitle={`${roles.length} total`} />
                    <CardBody>
                        {loading ? <div className="text-sm text-neutral-500">Loading…</div> : null}
                        {!loading && roles.length === 0 ? (
                            <div className="text-sm text-neutral-500">No roles found.</div>
                        ) : null}

                        <div className="mt-3 space-y-2">
                            {roles.map((r) => (
                                <div
                                    key={r.roleId || r.name}
                                    className="rounded-xl border border-black/5 bg-white px-3 py-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-medium text-neutral-900">
                                                {r.name}{" "}
                                                <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700">
                                                    {r.scopeType}
                                                </span>
                                            </div>
                                            <div className="mt-1 text-xs text-neutral-500">{r.roleId}</div>
                                        </div>

                                        {r.system ? (
                                            <div className="text-xs text-neutral-500">system</div>
                                        ) : (
                                            <Button variant="danger" size="sm" onClick={() => remove(r.roleId)}>
                                                Delete
                                            </Button>
                                        )}
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {(r.permissions || []).slice(0, 12).map((p) => (
                                            <span
                                                key={p}
                                                className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
                                            >
                                                {p}
                                            </span>
                                        ))}
                                        {(r.permissions || []).length > 12 ? (
                                            <span className="text-xs text-neutral-500">
                                                +{(r.permissions || []).length - 12} more
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardBody>
                </Card>
            </div>
        </div>
    );
}
