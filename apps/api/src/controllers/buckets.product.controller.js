// apps/api/src/controllers/buckets.controller.js
import { minioService } from "../services/minio.service.js";
import { auditService } from "../services/audit.service.js";

function isProd() {
    return (process.env.NODE_ENV || "development") === "production";
}

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
const badRequest = (m, d = null) => httpError(400, m, d);
const unauthorized = (m = "Unauthorized", d = null) => httpError(401, m, d);
const forbidden = (m = "Forbidden", d = null) => httpError(403, m, d);
const notFound = (m = "Not found", d = null) => httpError(404, m, d);

function safeDetails(details) {
    return isProd() ? null : details;
}

function actorFromReq(req) {
    const userId = typeof req.userId === "string" ? req.userId.trim() : "";
    if (!userId) throw unauthorized();
    return { userId, isSuperAdmin: req.isSuperAdmin === true };
}

// project roles (v1 policy preserved)
const TEAM_READ = ["team_owner", "team_member", "team_viewer"];
const PROJECT_READ = ["project_owner", "project_editor", "project_viewer"];
const PROJECT_WRITE = ["project_owner", "project_editor"];

function norm(v, field) {
    const s = String(v ?? "").trim();
    if (!s) throw badRequest(`${field} required`);
    if (s.length > 240) throw badRequest(`${field} too long`);
    return s;
}

function safeKey(input) {
    // Normalize key:
    // - remove leading slashes
    // - reject path traversal or null bytes
    let k = String(input ?? "");
    k = k.replace(/^\/+/, "");

    // reject traversal / weirdness
    if (k.includes("\u0000")) throw badRequest("invalid key");
    if (k.split("/").some((seg) => seg === "..")) throw badRequest("invalid key");

    // prevent accidental absolute/drive-like
    if (/^[a-zA-Z]:\\/.test(k)) throw badRequest("invalid key");

    // keep keys reasonable
    if (k.length > 1024) throw badRequest("key too long");

    return k;
}

function filenameFromKey(key) {
    const k = String(key || "");
    const parts = k.split("/").filter(Boolean);
    const name = parts[parts.length - 1] || "object";
    // very light header-safety
    return name.replace(/[\r\n"]/g, "_");
}

async function getProjectOr404(db, projectId) {
    const p = await db.collection("projects").findOne(
        { projectId: String(projectId) },
        { projection: { _id: 0, projectId: 1, teamId: 1 } }
    );
    if (!p) throw notFound("Project not found", safeDetails({ projectId }));
    return p;
}

async function projectBindingExists(db, { projectId, teamId, actorUserId, projectRoles, teamRoles }) {
    return db.collection("iam_bindings").findOne(
        {
            subjectType: "user",
            subjectId: String(actorUserId),
            $or: [
                { scopeType: "project", scopeId: String(projectId), roleId: { $in: projectRoles } },
                { scopeType: "team", scopeId: String(teamId), roleId: { $in: teamRoles } },
            ],
        },
        { projection: { _id: 1 } }
    );
}

async function requireProjectAccess(db, projectId, actor, mode /* "read" | "write" */) {
    if (actor.isSuperAdmin) return;

    const p = await getProjectOr404(db, projectId);

    const ok = await projectBindingExists(db, {
        projectId: p.projectId,
        teamId: p.teamId,
        actorUserId: actor.userId,
        projectRoles: mode === "write" ? PROJECT_WRITE : PROJECT_READ,
        teamRoles: TEAM_READ,
    });

    if (!ok) throw forbidden();
}

async function resolveBucketFromResource(db, resourceId) {
    const rid = norm(resourceId, "resourceId");

    const r = await db.collection("resources").findOne(
        { resourceId: rid },
        { projection: { _id: 0, resourceId: 1, projectId: 1, kind: 1, spec: 1, status: 1 } }
    );
    if (!r) throw notFound("Bucket resource not found", safeDetails({ resourceId: rid }));

    // keep strict check (your routes already assume bucket resourceId)
    if (r.kind !== "bucket") {
        throw badRequest("resource is not kind=bucket", safeDetails({ resourceId: rid, kind: r.kind }));
    }

    // bucket name usually in spec.bucketName for catalogId object_bucket
    const bucketName =
        r?.spec?.bucketName ||
        r?.spec?.name ||
        r?.status?.details?.bucketName ||
        null;

    if (!bucketName) {
        throw badRequest("bucketName missing on resource spec/status", safeDetails({ resourceId: rid }));
    }

    return { resource: r, bucketName: String(bucketName) };
}

export function bucketsController(db) {
    const { client, endPoint, port, useSSL } = minioService();
    const audit = auditService(db);

    async function ensureBucketExists(bucketName) {
        try {
            return await client.bucketExists(bucketName);
        } catch (e) {
            // Avoid leaking infra details in production responses
            throw httpError(
                502,
                "MinIO error (bucketExists)",
                safeDetails({
                    message: e?.message,
                    endPoint,
                    port,
                    useSSL,
                })
            );
        }
    }

    async function listObjects(bucket, { prefix = "", recursive = true, limit = 2000 } = {}) {
        const out = [];
        const stream = client.listObjectsV2(bucket, prefix || "", recursive === true);

        return await new Promise((resolve, reject) => {
            stream.on("data", (obj) => {
                if (out.length >= limit) return;
                out.push({
                    key: obj.name,
                    size: obj.size,
                    etag: obj.etag,
                    lastModified: obj.lastModified,
                });
            });
            stream.on("error", (err) => reject(err));
            stream.on("end", () => resolve(out));
        });
    }

    return {
        // GET /v1/buckets/:resourceId/objects
        listObjects: async (req, res) => {
            const actor = actorFromReq(req);

            const resourceId = norm(req.params.resourceId, "resourceId");
            const { resource, bucketName } = await resolveBucketFromResource(db, resourceId);

            await requireProjectAccess(db, resource.projectId, actor, "read");

            const exists = await ensureBucketExists(bucketName);
            if (!exists) throw notFound("Bucket not found in MinIO yet", safeDetails({ bucketName }));

            const prefix = String(req.query.prefix || "");
            const recursive = String(req.query.recursive || "1") !== "0";
            const limit = Number(req.query.limit || 2000);

            try {
                const objects = await listObjects(bucketName, {
                    prefix,
                    recursive,
                    limit: Number.isFinite(limit) ? Math.max(1, Math.min(limit, 5000)) : 2000,
                });

                objects.sort((a, b) => String(b.lastModified || "").localeCompare(String(a.lastModified || "")));

                await audit.log({
                    actorUserId: actor.userId,
                    action: "bucket.objects.list",
                    resourceType: "bucket",
                    resourceId: resourceId,
                    metadata: { bucketName, projectId: resource.projectId, prefix, recursive },
                });

                return res.json({
                    bucket: { resourceId, bucketName, projectId: resource.projectId },
                    objects,
                });
            } catch (e) {
                throw httpError(502, "MinIO error (listObjects)", safeDetails({ message: e?.message }));
            }
        },

        // POST /v1/buckets/:resourceId/objects (multipart)
        uploadObject: async (req, res) => {
            const actor = actorFromReq(req);

            const resourceId = norm(req.params.resourceId, "resourceId");
            const { resource, bucketName } = await resolveBucketFromResource(db, resourceId);

            await requireProjectAccess(db, resource.projectId, actor, "write");

            const exists = await ensureBucketExists(bucketName);
            if (!exists) throw notFound("Bucket not found in MinIO yet", safeDetails({ bucketName }));

            const file = req.file;
            if (!file) throw badRequest("file required (multipart form-data field 'file')");

            const rawKey = String(req.body.key || "").trim();
            const prefix = String(req.body.prefix || "").trim();

            const key = safeKey(
                rawKey ||
                (prefix
                    ? `${safeKey(prefix).replace(/\/?$/, "/")}${file.originalname}`
                    : file.originalname)
            );

            if (!key) throw badRequest("object key resolved empty");

            try {
                await client.putObject(bucketName, key, file.buffer, file.size, {
                    "Content-Type": file.mimetype || "application/octet-stream",
                });

                await audit.log({
                    actorUserId: actor.userId,
                    action: "bucket.object.upload",
                    resourceType: "bucket",
                    resourceId: resourceId,
                    metadata: { bucketName, projectId: resource.projectId, key, size: file.size, contentType: file.mimetype || null },
                });

                return res.status(201).json({
                    ok: true,
                    bucketName,
                    key,
                    size: file.size,
                    contentType: file.mimetype,
                });
            } catch (e) {
                throw httpError(502, "MinIO error (putObject)", safeDetails({ message: e?.message }));
            }
        },

        // GET /v1/buckets/:resourceId/objects/*?download=1
        downloadObject: async (req, res) => {
            const actor = actorFromReq(req);

            const resourceId = norm(req.params.resourceId, "resourceId");
            const { resource, bucketName } = await resolveBucketFromResource(db, resourceId);

            await requireProjectAccess(db, resource.projectId, actor, "read");

            const exists = await ensureBucketExists(bucketName);
            if (!exists) throw notFound("Bucket not found in MinIO yet", safeDetails({ bucketName }));

            // express wildcard: everything after /objects/ is in req.params[0]
            const key = safeKey(req.params[0]);
            if (!key) throw badRequest("object key required");

            const download = String(req.query.download || "") === "1";
            const filename = filenameFromKey(key);

            try {
                const stream = await client.getObject(bucketName, key);

                res.setHeader("Content-Type", "application/octet-stream");
                res.setHeader("Cache-Control", "no-store");
                res.setHeader(
                    "Content-Disposition",
                    `${download ? "attachment" : "inline"}; filename="${filename}"`
                );

                // audit as soon as request is authorized + object stream obtained
                await audit.log({
                    actorUserId: actor.userId,
                    action: "bucket.object.download",
                    resourceType: "bucket",
                    resourceId: resourceId,
                    metadata: { bucketName, projectId: resource.projectId, key, download },
                });

                stream.on("error", () => {
                    try {
                        res.end();
                    } catch { }
                });

                return stream.pipe(res);
            } catch (e) {
                throw notFound("Object not found", safeDetails({ bucketName, key, message: e?.message }));
            }
        },

        // DELETE /v1/buckets/:resourceId/objects/*
        deleteObject: async (req, res) => {
            const actor = actorFromReq(req);

            const resourceId = norm(req.params.resourceId, "resourceId");
            const { resource, bucketName } = await resolveBucketFromResource(db, resourceId);

            await requireProjectAccess(db, resource.projectId, actor, "write");

            const exists = await ensureBucketExists(bucketName);
            if (!exists) throw notFound("Bucket not found in MinIO yet", safeDetails({ bucketName }));

            const key = safeKey(req.params[0]);
            if (!key) throw badRequest("object key required");

            try {
                await client.removeObject(bucketName, key);

                await audit.log({
                    actorUserId: actor.userId,
                    action: "bucket.object.delete",
                    resourceType: "bucket",
                    resourceId: resourceId,
                    metadata: { bucketName, projectId: resource.projectId, key },
                });

                return res.json({ ok: true, bucketName, key });
            } catch (e) {
                throw httpError(502, "MinIO error (removeObject)", safeDetails({ message: e?.message }));
            }
        },
    };
}
