// apps/api/src/controllers/identity.controller.js
import bcrypt from "bcryptjs";

import { usersRepo } from "../repos/users.repo.js";
import { teamsRepo } from "../repos/teams.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";
import { iamRolesRepo } from "../repos/iamRoles.repo.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
const badRequest = (m, d) => httpError(400, m, d);
const forbidden = (m = "Forbidden", d) => httpError(403, m, d);
const conflict = (m, d) => httpError(409, m, d);

function isMongoDup(err) {
    return err?.code === 11000 || /E11000 duplicate key/i.test(String(err?.message || ""));
}

function normStr(v) {
    return String(v ?? "").trim();
}

function normalizeEmail(email) {
    return normStr(email).toLowerCase();
}

function safeUser(doc) {
    if (!doc) return doc;
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, ...safe } = doc;
    return safe;
}

function safeErrDetails(details) {
    return isProd() ? null : details;
}

function actorFromReq(req) {
    return {
        userId: normStr(req.userId),
        isSuperAdmin: !!req.isSuperAdmin,
    };
}

/**
 * Authorization helpers (v1 preserved):
 * - super_admin can do everything
 * - global scope read/write requires super_admin
 * - user scope read/write: only self
 * - team scope read: any binding on team
 * - team scope write: requires team_owner on that team
 * - project scope read: project binding OR owning team binding
 * - project scope write: project_owner OR owning team team_owner
 */
async function requireTeamOwner(db, teamId, actorUserId) {
    const b = await db.collection("iam_bindings").findOne({
        scopeType: "team",
        scopeId: String(teamId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: "team_owner",
    });
    if (!b) throw forbidden("Forbidden: team_owner required", safeErrDetails({ teamId }));
}

async function requireScopeRead(db, { scopeType, scopeId }, actor) {
    const st = normStr(scopeType);
    const sid = normStr(scopeId);
    if (!st || !sid) throw badRequest("scopeType and scopeId required", { scopeType, scopeId });

    if (actor?.isSuperAdmin) return;

    if (st === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (st === "user") {
        if (String(sid) !== String(actor.userId)) throw forbidden("Forbidden");
        return;
    }

    if (st === "team") {
        const b = await db.collection("iam_bindings").findOne({
            scopeType: "team",
            scopeId: String(sid),
            subjectType: "user",
            subjectId: String(actor.userId),
        });
        if (!b) throw forbidden("Forbidden");
        return;
    }

    if (st === "project") {
        const project = await db.collection("projects").findOne({ projectId: String(sid) });
        if (!project) throw badRequest("Unknown project scopeId", safeErrDetails({ scopeId: sid }));

        const b = await db.collection("iam_bindings").findOne({
            subjectType: "user",
            subjectId: String(actor.userId),
            $or: [
                { scopeType: "project", scopeId: String(sid) },
                { scopeType: "team", scopeId: String(project.teamId) },
            ],
        });
        if (!b) throw forbidden("Forbidden");
        return;
    }

    throw badRequest("Unsupported scopeType", safeErrDetails({ scopeType: st }));
}

async function requireScopeWrite(db, { scopeType, scopeId }, actor) {
    const st = normStr(scopeType);
    const sid = normStr(scopeId);
    if (!st || !sid) throw badRequest("scopeType and scopeId required", { scopeType, scopeId });

    if (actor?.isSuperAdmin) return;

    if (st === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (st === "user") {
        if (String(sid) !== String(actor.userId)) throw forbidden("Forbidden");
        return;
    }

    if (st === "team") {
        await requireTeamOwner(db, sid, actor.userId);
        return;
    }

    if (st === "project") {
        const project = await db.collection("projects").findOne({ projectId: String(sid) });
        if (!project) throw badRequest("Unknown project scopeId", safeErrDetails({ scopeId: sid }));

        const projectOwner = await db.collection("iam_bindings").findOne({
            scopeType: "project",
            scopeId: String(sid),
            subjectType: "user",
            subjectId: String(actor.userId),
            roleId: "project_owner",
        });
        if (projectOwner) return;

        await requireTeamOwner(db, project.teamId, actor.userId);
        return;
    }

    throw badRequest("Unsupported scopeType", safeErrDetails({ scopeType: st }));
}

async function requireRoleMatchesScope(db, scopeType, roleId) {
    const st = normStr(scopeType);
    const rid = normStr(roleId);
    if (!st || !rid) throw badRequest("scopeType and roleId required", { scopeType, roleId });

    const role = await db.collection("iam_roles").findOne({ roleId: String(rid) });
    if (!role) throw badRequest("Unknown roleId", safeErrDetails({ roleId: rid }));

    if (String(role.scopeType) !== String(st)) {
        throw badRequest(
            "roleId does not match scopeType",
            safeErrDetails({ roleId: rid, roleScopeType: role.scopeType, scopeType: st })
        );
    }

    return role;
}

function validateScope(scopeType, scopeId) {
    const st = normStr(scopeType);
    const sid = normStr(scopeId);
    if (!st || !sid) throw badRequest("scopeType and scopeId required");

    const allowed = new Set(["global", "user", "team", "project"]);
    if (!allowed.has(st)) throw badRequest("Unsupported scopeType", safeErrDetails({ scopeType: st }));

    if (st === "global" && sid !== "global") {
        throw badRequest("Invalid global scopeId (must be 'global')", safeErrDetails({ scopeId: sid }));
    }

    return { scopeType: st, scopeId: sid };
}

// role id guardrails (for CRUD endpoints)
function normRoleId(v) {
    const rid = normStr(v);
    if (!rid) throw badRequest("roleId required");
    if (rid.length > 120) throw badRequest("roleId too long", safeErrDetails({ roleId: rid }));
    if (!/^[a-zA-Z0-9._-]+$/.test(rid)) throw badRequest("Invalid roleId", safeErrDetails({ roleId: rid }));
    return rid;
}

export function identityController(db) {
    const users = usersRepo(db);
    const teams = teamsRepo(db);
    const audit = auditService(db);
    const iamRoles = iamRolesRepo(db);
    const iamBindings = iamBindingsRepo(db);

    async function upsertUserBinding({ scopeType, scopeId, subjectId, roleId, createdBy }) {
        const now = new Date();
        const bindingId = newId("bind");

        const doc = {
            bindingId,
            scopeType: String(scopeType),
            scopeId: String(scopeId),
            subjectType: "user",
            subjectId: String(subjectId),
            roleId: String(roleId),
            createdBy: String(createdBy),
            createdAt: now,
        };

        await db.collection("iam_bindings").updateOne(
            {
                scopeType: doc.scopeType,
                scopeId: doc.scopeId,
                subjectType: doc.subjectType,
                subjectId: doc.subjectId,
            },
            { $set: { roleId: doc.roleId, createdBy: doc.createdBy }, $setOnInsert: { ...doc } },
            { upsert: true }
        );

        return db.collection("iam_bindings").findOne({
            scopeType: doc.scopeType,
            scopeId: doc.scopeId,
            subjectType: doc.subjectType,
            subjectId: doc.subjectId,
        });
    }

    async function ensureUserExistsOrThrow(userId) {
        const uid = normStr(userId);
        if (!uid) throw badRequest("userId required");
        const u = await db.collection("users").findOne({ userId: String(uid) });
        if (!u) throw badRequest("Unknown userId", safeErrDetails({ userId: uid }));
        return u;
    }

    async function ensureTeamExistsOrThrow(teamId) {
        const tid = normStr(teamId);
        if (!tid) throw badRequest("teamId required");
        const t = await db.collection("teams").findOne({ teamId: String(tid) });
        if (!t) throw badRequest("Unknown teamId", safeErrDetails({ teamId: tid }));
        return t;
    }

    async function ensureProjectExistsOrThrow(projectId) {
        const pid = normStr(projectId);
        if (!pid) throw badRequest("projectId required");
        const p = await db.collection("projects").findOne({ projectId: String(pid) });
        if (!p) throw badRequest("Unknown projectId", safeErrDetails({ projectId: pid }));
        return p;
    }

    function requireSuperAdmin(req) {
        if (!req.isSuperAdmin) throw forbidden("Forbidden: super_admin required");
    }

    return {
        // USERS
        listUsers: async (req, res) => {
            if (!req.isSuperAdmin) {
                const me = await db
                    .collection("users")
                    .findOne({ userId: String(req.userId) }, { projection: { passwordHash: 0 } });
                return res.json({ users: me ? [me] : [] });
            }

            const rows = await db
                .collection("users")
                .find({})
                .project({ passwordHash: 0 })
                .sort({ createdAt: -1 })
                .limit(500)
                .toArray();

            return res.json({ users: rows });
        },

        createUser: async (req, res) => {
            requireSuperAdmin(req);

            const { email, password, passwordHash, displayName, name, username, active } = req.body || {};
            const em = normalizeEmail(email);
            if (!em) throw badRequest("email required");

            let ph = null;
            if (password && String(password).length >= 8) {
                ph = await bcrypt.hash(String(password), 10);
            } else if (passwordHash && String(passwordHash).trim()) {
                ph = String(passwordHash).trim();
            } else {
                throw badRequest("password (min 8 chars) OR passwordHash required");
            }

            const now = new Date();
            const userId = newId("user");
            const doc = {
                userId,
                email: em,
                passwordHash: ph,
                displayName:
                    displayName !== undefined
                        ? String(displayName)
                        : name !== undefined
                            ? String(name)
                            : null,
                name:
                    name !== undefined
                        ? String(name)
                        : displayName !== undefined
                            ? String(displayName)
                            : null,
                username: username !== undefined ? String(username) : em.split("@")[0],
                globalRole: "user",
                active: active === undefined ? true : Boolean(active),
                createdAt: now,
                lastLoginAt: null,
            };

            try {
                await users.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("User already exists", safeErrDetails({ email: doc.email }));
                throw err;
            }

            await audit.log({
                actorUserId: req.userId,
                action: "user.create",
                resourceType: "user",
                resourceId: userId,
                metadata: { email: doc.email },
            });

            return res.status(201).json({ user: safeUser(doc) });
        },

        // IAM ROLES
        listIamRoles: async (req, res) => {
            const scopeType =
                typeof req.query.scopeType === "string" && req.query.scopeType.trim()
                    ? req.query.scopeType.trim()
                    : undefined;

            const rows = await iamRoles.list({ scopeType });
            return res.json({ roles: rows });
        },

        getIamRole: async (req, res) => {
            requireSuperAdmin(req);

            const roleId = normRoleId(req.params.roleId);
            const role = await iamRoles.get(roleId);
            if (!role) throw httpError(404, "Role not found", safeErrDetails({ roleId }));
            return res.json({ role });
        },

        // create custom role (system=false)
        createIamRole: async (req, res) => {
            requireSuperAdmin(req);

            const body = req.body || {};

            const roleId = body.roleId ? normRoleId(body.roleId) : newId("role");
            const name = normStr(body.name);
            if (!name) throw badRequest("name required");

            const scopeType = normStr(body.scopeType);
            if (!scopeType) throw badRequest("scopeType required");

            const permissions = body.permissions;
            if (!Array.isArray(permissions) || permissions.length === 0) {
                throw badRequest("permissions must be a non-empty array");
            }

            const inherits = body.inherits === undefined ? null : body.inherits;
            const description = body.description === undefined ? null : String(body.description ?? "").trim() || null;

            if (body.system === true) {
                throw badRequest("system roles cannot be created via API", safeErrDetails({ roleId }));
            }

            if (Array.isArray(inherits)) {
                for (const rid of inherits.map((x) => String(x ?? "").trim()).filter(Boolean)) {
                    const r = await iamRoles.get(rid);
                    if (!r) throw badRequest("inherits references unknown roleId", safeErrDetails({ roleId: rid }));
                    if (String(r.scopeType) !== String(scopeType)) {
                        throw badRequest(
                            "inherits role scopeType must match",
                            safeErrDetails({ roleId: rid, roleScopeType: r.scopeType, scopeType })
                        );
                    }
                }
            }

            const doc = await iamRoles.upsert({
                roleId,
                name,
                scopeType,
                permissions,
                inherits,
                description,
                system: false,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.role.create",
                resourceType: "iam_role",
                resourceId: roleId,
                metadata: { roleId, scopeType, system: false },
            });

            return res.status(201).json({ role: doc });
        },

        // update custom role (system=false) and scopeType immutable
        updateIamRole: async (req, res) => {
            requireSuperAdmin(req);

            const roleId = normRoleId(req.params.roleId);
            const existing = await iamRoles.get(roleId);
            if (!existing) throw httpError(404, "Role not found", safeErrDetails({ roleId }));

            if (existing.system === true) {
                throw forbidden("Cannot modify system role", safeErrDetails({ roleId }));
            }

            const body = req.body || {};

            if (body.scopeType !== undefined && String(body.scopeType) !== String(existing.scopeType)) {
                throw badRequest(
                    "scopeType cannot be changed after creation",
                    safeErrDetails({ roleId, from: existing.scopeType, to: body.scopeType })
                );
            }

            const nextName = body.name !== undefined ? normStr(body.name) : existing.name;
            if (!nextName) throw badRequest("name required");

            const nextPermissions = body.permissions !== undefined ? body.permissions : existing.permissions;
            if (!Array.isArray(nextPermissions) || nextPermissions.length === 0) {
                throw badRequest("permissions must be a non-empty array");
            }

            const nextInherits = body.inherits !== undefined ? body.inherits : existing.inherits ?? null;
            const nextDescription =
                body.description !== undefined
                    ? String(body.description ?? "").trim() || null
                    : existing.description ?? null;

            if (Array.isArray(nextInherits)) {
                for (const rid of nextInherits.map((x) => String(x ?? "").trim()).filter(Boolean)) {
                    const r = await iamRoles.get(rid);
                    if (!r) throw badRequest("inherits references unknown roleId", safeErrDetails({ roleId: rid }));
                    if (String(r.scopeType) !== String(existing.scopeType)) {
                        throw badRequest(
                            "inherits role scopeType must match",
                            safeErrDetails({ roleId: rid, roleScopeType: r.scopeType, scopeType: existing.scopeType })
                        );
                    }
                }
            }

            const doc = await iamRoles.upsert({
                roleId,
                name: nextName,
                scopeType: existing.scopeType,
                permissions: nextPermissions,
                inherits: nextInherits,
                description: nextDescription,
                system: false,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.role.update",
                resourceType: "iam_role",
                resourceId: roleId,
                metadata: { roleId, scopeType: doc.scopeType },
            });

            return res.json({ role: doc });
        },

        // delete custom role (system=false) and must not be referenced by any iam_bindings
        deleteIamRole: async (req, res) => {
            requireSuperAdmin(req);

            const roleId = normRoleId(req.params.roleId);
            const existing = await iamRoles.get(roleId);
            if (!existing) throw httpError(404, "Role not found", safeErrDetails({ roleId }));

            if (existing.system === true) {
                throw forbidden("Cannot delete system role", safeErrDetails({ roleId }));
            }

            const out = await iamRoles.remove(roleId);
            if (!out?.ok) throw httpError(500, "Failed to delete role", safeErrDetails({ roleId }));
            if (out.deletedCount !== 1) throw httpError(404, "Role not found", safeErrDetails({ roleId }));

            await audit.log({
                actorUserId: req.userId,
                action: "iam.role.delete",
                resourceType: "iam_role",
                resourceId: roleId,
                metadata: { roleId },
            });

            return res.json({ ok: true, roleId });
        },

        // IAM BINDINGS
        listIamBindings: async (req, res) => {
            const scopeType =
                typeof req.query.scopeType === "string" && req.query.scopeType.trim()
                    ? req.query.scopeType.trim()
                    : null;
            const scopeId =
                typeof req.query.scopeId === "string" && req.query.scopeId.trim()
                    ? req.query.scopeId.trim()
                    : null;

            const scope = validateScope(scopeType, scopeId);
            await requireScopeRead(db, scope, actorFromReq(req));

            const bindings = await iamBindings.listForScope(String(scope.scopeType), String(scope.scopeId));
            return res.json({ bindings });
        },

        grantIamBinding: async (req, res) => {
            const { scopeType, scopeId, subjectId, roleId } = req.body || {};
            if (!scopeType || !scopeId || !subjectId || !roleId) {
                throw badRequest("scopeType, scopeId, subjectId, roleId required");
            }

            const scope = validateScope(scopeType, scopeId);

            if (scope.scopeType === "team") await ensureTeamExistsOrThrow(scope.scopeId);
            if (scope.scopeType === "project") await ensureProjectExistsOrThrow(scope.scopeId);
            if (scope.scopeType === "user") await ensureUserExistsOrThrow(scope.scopeId);

            await requireScopeWrite(db, scope, actorFromReq(req));

            const role = await requireRoleMatchesScope(db, scope.scopeType, String(roleId));
            const u = await ensureUserExistsOrThrow(subjectId);

            if (String(role.roleId) === "super_admin") {
                throw badRequest("super_admin cannot be granted via IAM binding (use user.globalRole)");
            }

            if (!req.isSuperAdmin && String(u.userId) === String(req.userId)) {
                const existing = await db.collection("iam_bindings").findOne({
                    scopeType: scope.scopeType,
                    scopeId: scope.scopeId,
                    subjectType: "user",
                    subjectId: String(u.userId),
                });

                if (existing && String(existing.roleId) !== String(role.roleId)) {
                    throw forbidden("Forbidden: cannot change your own role on this scope");
                }
            }

            const doc = await upsertUserBinding({
                scopeType: scope.scopeType,
                scopeId: scope.scopeId,
                subjectId: String(u.userId),
                roleId: String(role.roleId),
                createdBy: req.userId,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.binding.grant",
                resourceType: "iam_binding",
                resourceId: doc?.bindingId || null,
                metadata: {
                    scopeType: scope.scopeType,
                    scopeId: scope.scopeId,
                    subjectId: String(u.userId),
                    roleId: String(role.roleId),
                },
            });

            return res.status(201).json({ binding: doc });
        },

        revokeIamBinding: async (req, res) => {
            const { scopeType, scopeId, subjectId, roleId } = req.body || {};
            if (!scopeType || !scopeId || !subjectId) {
                throw badRequest("scopeType, scopeId, subjectId required");
            }

            const scope = validateScope(scopeType, scopeId);
            await requireScopeWrite(db, scope, actorFromReq(req));

            if (!req.isSuperAdmin && scope.scopeType === "team") {
                const currentOwnerCount = await db.collection("iam_bindings").countDocuments({
                    scopeType: "team",
                    scopeId: scope.scopeId,
                    subjectType: "user",
                    roleId: "team_owner",
                });

                const targetIsOwner = await db.collection("iam_bindings").findOne({
                    scopeType: "team",
                    scopeId: scope.scopeId,
                    subjectType: "user",
                    subjectId: String(subjectId),
                    roleId: "team_owner",
                });

                if (targetIsOwner && currentOwnerCount <= 1) {
                    throw conflict("Cannot remove the last team_owner from a team");
                }
            }

            const out = await iamBindings.removeOne({
                scopeType: String(scope.scopeType),
                scopeId: String(scope.scopeId),
                subjectType: "user",
                subjectId: String(subjectId),
                roleId: roleId ? String(roleId) : undefined,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.binding.revoke",
                resourceType: "iam_binding",
                resourceId: null,
                metadata: {
                    scopeType: scope.scopeType,
                    scopeId: scope.scopeId,
                    subjectId: String(subjectId),
                    roleId: roleId ?? null,
                },
            });

            return res.json(out);
        },

        // TEAMS
        listTeams: async (req, res) => {
            if (req.isSuperAdmin) return res.json({ teams: await teams.list() });

            const binds = await db
                .collection("iam_bindings")
                .find({ scopeType: "team", subjectType: "user", subjectId: req.userId })
                .project({ scopeId: 1 })
                .toArray();

            const teamIds = binds.map((b) => b.scopeId).filter(Boolean);
            if (!teamIds.length) return res.json({ teams: [] });

            const rows = await db.collection("teams").find({ teamId: { $in: teamIds } }).toArray();
            return res.json({ teams: rows });
        },

        createTeam: async (req, res) => {
            const { name } = req.body || {};
            if (!name || !String(name).trim()) throw badRequest("name required");

            const now = new Date();
            const teamId = newId("team");
            const doc = { teamId, name: String(name).trim(), createdBy: req.userId, createdAt: now };

            try {
                await teams.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("Team already exists", safeErrDetails({ name: doc.name }));
                throw err;
            }

            await requireRoleMatchesScope(db, "team", "team_owner");

            await upsertUserBinding({
                scopeType: "team",
                scopeId: teamId,
                subjectId: req.userId,
                roleId: "team_owner",
                createdBy: req.userId,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.create",
                resourceType: "team",
                resourceId: teamId,
                metadata: { name: doc.name },
            });

            return res.status(201).json({ team: doc });
        },

        listTeamMembers: async (req, res) => {
            const teamId = normStr(req.params.teamId);

            await requireScopeRead(db, { scopeType: "team", scopeId: teamId }, actorFromReq(req));

            const bindings = await iamBindings.listForScope("team", teamId);
            const userIds = bindings.map((b) => b.subjectId).filter(Boolean);

            const userRows = await db
                .collection("users")
                .find({ userId: { $in: userIds } })
                .project({ passwordHash: 0 })
                .toArray();

            const userMap = new Map(userRows.map((u) => [u.userId, u]));
            const members = bindings.map((b) => ({
                user: userMap.get(b.subjectId) || { userId: b.subjectId },
                roleId: b.roleId,
                bindingId: b.bindingId,
                createdAt: b.createdAt,
            }));

            return res.json({ members });
        },

        addTeamMember: async (req, res) => {
            const teamId = normStr(req.params.teamId);
            const bodyUserId = normStr(req.body?.userId);
            if (!bodyUserId) throw badRequest("userId required");

            const rid = req.body?.roleId ? normStr(req.body.roleId) : "team_member";
            if (!["team_owner", "team_member", "team_viewer"].includes(rid)) {
                throw badRequest("Invalid roleId for team", safeErrDetails({ roleId: rid }));
            }

            if (!req.isSuperAdmin) await requireTeamOwner(db, teamId, req.userId);

            await requireRoleMatchesScope(db, "team", rid);

            const u = await ensureUserExistsOrThrow(bodyUserId);

            if (!req.isSuperAdmin && rid !== "team_owner") {
                const existing = await db.collection("iam_bindings").findOne({
                    scopeType: "team",
                    scopeId: teamId,
                    subjectType: "user",
                    subjectId: String(u.userId),
                });

                const isDemotingOwner = existing && String(existing.roleId) === "team_owner" && rid !== "team_owner";
                if (isDemotingOwner) {
                    const ownerCount = await db.collection("iam_bindings").countDocuments({
                        scopeType: "team",
                        scopeId: teamId,
                        subjectType: "user",
                        roleId: "team_owner",
                    });
                    if (ownerCount <= 1) {
                        throw conflict("Cannot demote the last team_owner in a team");
                    }
                }
            }

            const doc = await upsertUserBinding({
                scopeType: "team",
                scopeId: teamId,
                subjectId: String(u.userId),
                roleId: rid,
                createdBy: req.userId,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.upsert",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId: String(u.userId), roleId: rid },
            });

            return res.status(201).json({ member: doc });
        },

        removeTeamMember: async (req, res) => {
            const teamId = normStr(req.params.teamId);
            const userId = normStr(req.params.userId);

            if (!req.isSuperAdmin) await requireTeamOwner(db, teamId, req.userId);

            if (!req.isSuperAdmin) {
                const targetIsOwner = await db.collection("iam_bindings").findOne({
                    scopeType: "team",
                    scopeId: teamId,
                    subjectType: "user",
                    subjectId: userId,
                    roleId: "team_owner",
                });
                if (targetIsOwner) {
                    const ownerCount = await db.collection("iam_bindings").countDocuments({
                        scopeType: "team",
                        scopeId: teamId,
                        subjectType: "user",
                        roleId: "team_owner",
                    });
                    if (ownerCount <= 1) {
                        throw conflict("Cannot remove the last team_owner from a team");
                    }
                }
            }

            const out = await iamBindings.removeOne({
                scopeType: "team",
                scopeId: teamId,
                subjectType: "user",
                subjectId: userId,
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.remove",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId },
            });

            return res.json(out);
        },
    };
}
