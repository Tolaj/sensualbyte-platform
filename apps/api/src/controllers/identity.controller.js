// apps/api/src/controllers/identity.controller.js
import { usersRepo } from "../repos/users.repo.js";
import { teamsRepo } from "../repos/teams.repo.js";
import { newId } from "../utils/ids.js";
import { auditService } from "../services/audit.service.js";
import { iamRolesRepo } from "../repos/iamRoles.repo.js";
import { iamBindingsRepo } from "../repos/iamBindings.repo.js";

function badRequest(message, details = null) {
    const e = new Error(message);
    e.statusCode = 400;
    if (details) e.details = details;
    return e;
}
function conflict(message, details = null) {
    const e = new Error(message);
    e.statusCode = 409;
    if (details) e.details = details;
    return e;
}
function forbidden(message = "Forbidden", details = null) {
    const e = new Error(message);
    e.statusCode = 403;
    if (details) e.details = details;
    return e;
}
function isMongoDup(err) {
    return err?.code === 11000 || /E11000 duplicate key/i.test(String(err?.message || ""));
}
function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}
function safeUser(doc) {
    if (!doc) return doc;
    const { passwordHash, ...safe } = doc;
    return safe;
}
function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

// v1 policy: super_admin can do everything.
// For team writes, require team_owner.
async function requireTeamOwner(db, teamId, actorUserId) {
    const b = await db.collection("iam_bindings").findOne({
        scopeType: "team",
        scopeId: String(teamId),
        subjectType: "user",
        subjectId: String(actorUserId),
        roleId: "team_owner"
    });
    if (!b) throw forbidden("Forbidden: team_owner required", { teamId });
}

async function requireScopeRead(db, { scopeType, scopeId }, actor) {
    if (actor?.isSuperAdmin) return;

    if (scopeType === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (scopeType === "user") {
        if (String(scopeId) !== String(actor.userId)) throw forbidden("Forbidden");
        return;
    }

    if (scopeType === "team") {
        const b = await db.collection("iam_bindings").findOne({
            scopeType: "team",
            scopeId: String(scopeId),
            subjectType: "user",
            subjectId: String(actor.userId)
        });
        if (!b) throw forbidden("Forbidden");
        return;
    }

    if (scopeType === "project") {
        const project = await db.collection("projects").findOne({ projectId: String(scopeId) });
        if (!project) throw badRequest("Unknown project scopeId", { scopeId });

        const b = await db.collection("iam_bindings").findOne({
            subjectType: "user",
            subjectId: String(actor.userId),
            $or: [
                { scopeType: "project", scopeId: String(scopeId) },
                { scopeType: "team", scopeId: String(project.teamId) }
            ]
        });
        if (!b) throw forbidden("Forbidden");
        return;
    }

    throw badRequest("Unsupported scopeType", { scopeType });
}

async function requireScopeWrite(db, { scopeType, scopeId }, actor) {
    if (actor?.isSuperAdmin) return;

    if (scopeType === "global") throw forbidden("Forbidden: global scope requires super_admin");

    if (scopeType === "user") {
        if (String(scopeId) !== String(actor.userId)) throw forbidden("Forbidden");
        return;
    }

    if (scopeType === "team") {
        await requireTeamOwner(db, scopeId, actor.userId);
        return;
    }

    if (scopeType === "project") {
        const project = await db.collection("projects").findOne({ projectId: String(scopeId) });
        if (!project) throw badRequest("Unknown project scopeId", { scopeId });

        const b = await db.collection("iam_bindings").findOne({
            subjectType: "user",
            subjectId: String(actor.userId),
            $or: [
                { scopeType: "project", scopeId: String(scopeId), roleId: "project_owner" },
                { scopeType: "team", scopeId: String(project.teamId), roleId: "team_owner" }
            ]
        });

        if (!b) throw forbidden("Forbidden: project_owner or team_owner required", { projectId: scopeId });
        return;
    }

    throw badRequest("Unsupported scopeType", { scopeType });
}

async function requireRoleMatchesScope(db, scopeType, roleId) {
    const role = await db.collection("iam_roles").findOne({ roleId: String(roleId) });
    if (!role) throw badRequest("Unknown roleId", { roleId });

    if (String(role.scopeType) !== String(scopeType)) {
        throw badRequest("roleId scopeType mismatch", {
            scopeType,
            roleId,
            roleScopeType: role.scopeType
        });
    }
    return role;
}

export function identityController(db) {
    const users = usersRepo(db);
    const teams = teamsRepo(db);
    const audit = auditService(db);
    const iamRoles = iamRolesRepo(db);
    const iamBindings = iamBindingsRepo(db);

    async function upsertUserBinding({ scopeType, scopeId, subjectId, roleId, createdBy }) {
        return iamBindings.upsert({
            bindingId: newId("bind"),
            scopeType: String(scopeType),
            scopeId: String(scopeId),
            subjectType: "user",
            subjectId: String(subjectId),
            roleId: String(roleId),
            createdBy: createdBy ?? null,
            createdAt: new Date()
        });
    }

    return {
        // USERS
        listUsers: async (req, res) => {
            if (!req.isSuperAdmin) throw forbidden();
            const rows = await users.list();
            res.json({ users: rows.map(safeUser) });
        },

        createUser: async (req, res) => {
            // Production: only super_admin can create users (until signup exists)
            if (isProd() && !req.isSuperAdmin) throw forbidden();

            const { email, passwordHash, name, username, globalRole } = req.body || {};
            const emailNorm = normalizeEmail(email);

            if (!emailNorm || !passwordHash) {
                throw badRequest("email and passwordHash required", { email: emailNorm });
            }

            const gr = globalRole ? String(globalRole) : "user";
            if (gr === "super_admin" && !req.isSuperAdmin) {
                throw forbidden("Forbidden: only super_admin can create super_admin");
            }

            const now = new Date();
            const doc = {
                userId: newId("user"),
                email: emailNorm,
                passwordHash: String(passwordHash),
                name: name ? String(name) : null,
                username: username ? String(username) : null,
                globalRole: gr,
                active: true,
                createdAt: now,
                updatedAt: now,
                lastLoginAt: null
            };

            try {
                await users.create(doc);
            } catch (err) {
                if (isMongoDup(err)) throw conflict("User already exists", { email: emailNorm });
                throw err;
            }

            // user becomes owner of their own user-scope
            await requireRoleMatchesScope(db, "user", "user_owner");
            await upsertUserBinding({
                scopeType: "user",
                scopeId: doc.userId,
                subjectId: doc.userId,
                roleId: "user_owner",
                createdBy: req.userId
            });

            await audit.log({
                actorUserId: req.userId,
                action: "user.create",
                resourceType: "user",
                resourceId: doc.userId,
                metadata: { email: emailNorm, globalRole: gr }
            });

            res.status(201).json({ user: safeUser(doc) });
        },

        // IAM
        listIamRoles: async (req, res) => {
            const scopeType = req.query.scopeType ? String(req.query.scopeType) : null;
            res.json({ roles: await iamRoles.list({ scopeType }) });
        },

        listIamBindings: async (req, res) => {
            const scopeType = String(req.query.scopeType || "");
            const scopeId = String(req.query.scopeId || "");
            if (!scopeType || !scopeId) throw badRequest("scopeType & scopeId required");

            await requireScopeRead(db, { scopeType, scopeId }, { userId: req.userId, isSuperAdmin: req.isSuperAdmin });
            res.json({ bindings: await iamBindings.listForScope(scopeType, scopeId) });
        },

        grantIamBinding: async (req, res) => {
            const { scopeType, scopeId, subjectId, roleId } = req.body || {};
            if (!scopeType || !scopeId || !subjectId || !roleId) {
                throw badRequest("scopeType, scopeId, subjectId, roleId required");
            }

            await requireScopeWrite(
                db,
                { scopeType: String(scopeType), scopeId: String(scopeId) },
                { userId: req.userId, isSuperAdmin: req.isSuperAdmin }
            );

            // validate role exists + scope matches
            await requireRoleMatchesScope(db, String(scopeType), String(roleId));

            // ensure user exists
            const u = await db.collection("users").findOne({ userId: String(subjectId) });
            if (!u) throw badRequest("Unknown subjectId (user)", { subjectId });

            const doc = await upsertUserBinding({
                scopeType,
                scopeId,
                subjectId,
                roleId,
                createdBy: req.userId
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.binding.grant",
                resourceType: "iam_binding",
                resourceId: doc?.bindingId || null,
                metadata: { scopeType, scopeId, subjectId, roleId }
            });

            res.status(201).json({ binding: doc });
        },

        revokeIamBinding: async (req, res) => {
            const { scopeType, scopeId, subjectId, roleId } = req.body || {};
            if (!scopeType || !scopeId || !subjectId) {
                throw badRequest("scopeType, scopeId, subjectId required");
            }

            await requireScopeWrite(
                db,
                { scopeType: String(scopeType), scopeId: String(scopeId) },
                { userId: req.userId, isSuperAdmin: req.isSuperAdmin }
            );

            // Role is mutable under your new IAM semantics, so removal targets scope+subject.
            const out = await iamBindings.removeOne({
                scopeType: String(scopeType),
                scopeId: String(scopeId),
                subjectType: "user",
                subjectId: String(subjectId),
                roleId: roleId ? String(roleId) : undefined // optional strict delete if you pass it
            });

            await audit.log({
                actorUserId: req.userId,
                action: "iam.binding.revoke",
                resourceType: "iam_binding",
                resourceId: null,
                metadata: { scopeType, scopeId, subjectId, roleId: roleId ?? null }
            });

            res.json(out);
        },

        // TEAMS
        listTeams: async (req, res) => {
            if (req.isSuperAdmin) {
                return res.json({ teams: await teams.list() });
            }

            const binds = await db.collection("iam_bindings")
                .find({ scopeType: "team", subjectType: "user", subjectId: req.userId })
                .project({ scopeId: 1 })
                .toArray();

            const teamIds = binds.map((b) => b.scopeId);
            if (!teamIds.length) return res.json({ teams: [] });

            const rows = await db.collection("teams").find({ teamId: { $in: teamIds } }).toArray();
            res.json({ teams: rows });
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
                if (isMongoDup(err)) throw conflict("Team already exists", { name: doc.name });
                throw err;
            }

            await requireRoleMatchesScope(db, "team", "team_owner");
            await upsertUserBinding({
                scopeType: "team",
                scopeId: teamId,
                subjectId: req.userId,
                roleId: "team_owner",
                createdBy: req.userId
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.create",
                resourceType: "team",
                resourceId: teamId,
                metadata: { name: doc.name }
            });

            res.status(201).json({ team: doc });
        },

        // Team members == IAM bindings on (scopeType=team, scopeId=teamId)
        listTeamMembers: async (req, res) => {
            const teamId = String(req.params.teamId);

            await requireScopeRead(db, { scopeType: "team", scopeId: teamId }, {
                userId: req.userId,
                isSuperAdmin: req.isSuperAdmin
            });

            const bindings = await iamBindings.listForScope("team", teamId);

            const userIds = bindings.map((b) => b.subjectId).filter(Boolean);
            const userRows = await db.collection("users")
                .find({ userId: { $in: userIds } })
                .project({ passwordHash: 0 })
                .toArray();

            const userMap = new Map(userRows.map((u) => [u.userId, u]));
            const members = bindings.map((b) => ({
                user: userMap.get(b.subjectId) || { userId: b.subjectId },
                roleId: b.roleId,
                bindingId: b.bindingId,
                createdAt: b.createdAt
            }));

            res.json({ members });
        },

        addTeamMember: async (req, res) => {
            const teamId = String(req.params.teamId);
            const { userId, roleId } = req.body || {};
            if (!userId) throw badRequest("userId required");

            const rid = roleId ? String(roleId) : "team_member";
            // keep this tight for v1
            if (!["team_owner", "team_member", "team_viewer"].includes(rid)) {
                throw badRequest("Invalid roleId for team", { roleId: rid });
            }

            if (!req.isSuperAdmin) {
                await requireTeamOwner(db, teamId, req.userId);
            }

            await requireRoleMatchesScope(db, "team", rid);

            const u = await db.collection("users").findOne({ userId: String(userId) });
            if (!u) throw badRequest("Unknown userId", { userId });

            const doc = await upsertUserBinding({
                scopeType: "team",
                scopeId: teamId,
                subjectId: String(userId),
                roleId: rid,
                createdBy: req.userId
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.upsert",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId: String(userId), roleId: rid }
            });

            res.status(201).json({ member: doc });
        },

        removeTeamMember: async (req, res) => {
            const teamId = String(req.params.teamId);
            const userId = String(req.params.userId);

            if (!req.isSuperAdmin) {
                await requireTeamOwner(db, teamId, req.userId);
            }

            const out = await iamBindings.removeOne({
                scopeType: "team",
                scopeId: teamId,
                subjectType: "user",
                subjectId: userId
            });

            await audit.log({
                actorUserId: req.userId,
                action: "team.member.remove",
                resourceType: "team",
                resourceId: teamId,
                metadata: { userId }
            });

            res.json(out);
        }
    };
}
