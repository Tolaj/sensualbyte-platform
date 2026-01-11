// apps/api/src/services/resources.service.js
import { newId } from "../utils/ids.js";
import { now } from "../utils/time.js";
import { deepMerge } from "../utils/merge.js";
import { encryptString } from "../utils/crypto.js";

import { catalogItemsRepo } from "../repos/catalogItems.repo.js";
import { resourceKindsRepo } from "../repos/resourceKinds.repo.js";
import { resourcesRepo } from "../repos/resources.repo.js";
import { resourceStatusRepo } from "../repos/resourceStatus.repo.js";
import { eventsOutboxRepo } from "../repos/eventsOutbox.repo.js";
import { secretsRepo } from "../repos/secrets.repo.js";

import { applyOfferingDefaults } from "./catalog.service.js";
import { validateResourceSpec } from "../validators/validateResourceSpec.js";

const ALLOWED_DESIRED = new Set(["active", "paused", "deleted"]);

function httpError(statusCode, message, details = null) {
  const e = new Error(message);
  e.statusCode = statusCode;
  if (details) e.details = details;
  return e;
}

function randPassword() {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  ).slice(0, 32);
}

function defaultHostname({ projectId, name }) {
  return `${name}.${projectId}.local`
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-");
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function pickPatch(patch) {
  const out = {};

  if (patch?.name !== undefined) {
    if (typeof patch.name !== "string" || !patch.name.trim()) {
      throw httpError(400, "name must be a non-empty string");
    }
    out.name = patch.name.trim();
  }

  if (patch?.labels !== undefined) {
    if (patch.labels === null) out.labels = {}; // clear labels
    else if (!isPlainObject(patch.labels)) throw httpError(400, "labels must be an object or null");
    else out.labels = patch.labels;
  }

  if (patch?.desiredState !== undefined) {
    const ds = String(patch.desiredState);
    if (!ALLOWED_DESIRED.has(ds)) throw httpError(400, `Invalid desiredState: ${ds}`);
    out.desiredState = ds;
  }

  if (patch?.spec !== undefined) {
    if (!isPlainObject(patch.spec)) throw httpError(400, "spec must be an object");
    out.spec = patch.spec;
  }

  return out;
}

// ---- IAM helpers (source of truth) ----
const TEAM_READ_ROLES = ["team_owner", "team_member", "team_viewer"];
const TEAM_WRITE_ROLES = ["team_owner"];

const PROJECT_READ_ROLES = ["project_owner", "project_editor", "project_viewer"];
const PROJECT_WRITE_ROLES = ["project_owner", "project_editor"];
const PROJECT_ADMIN_ROLES = ["project_owner"];

function requireNonEmptyId(value, field) {
  const s = String(value ?? "").trim();
  if (!s) throw httpError(400, `${field} is required`);
  return s;
}

async function getProjectOr404(db, projectId) {
  const pid = requireNonEmptyId(projectId, "projectId");
  const p = await db.collection("projects").findOne({ projectId: pid });
  if (!p) throw httpError(404, `Project not found: ${pid}`);
  return p;
}

async function requireProjectRead(db, projectId, actor) {
  const pid = requireNonEmptyId(projectId, "projectId");

  if (actor?.isSuperAdmin) return await getProjectOr404(db, pid);

  const p = await getProjectOr404(db, pid);

  const b = await db.collection("iam_bindings").findOne({
    subjectType: "user",
    subjectId: String(actor.userId),
    $or: [
      { scopeType: "project", scopeId: pid, roleId: { $in: PROJECT_READ_ROLES } },
      { scopeType: "team", scopeId: String(p.teamId), roleId: { $in: TEAM_READ_ROLES } }
    ]
  });

  if (!b) throw httpError(403, "Forbidden", { projectId: pid });
  return p;
}

async function requireProjectWrite(db, projectId, actor) {
  const pid = requireNonEmptyId(projectId, "projectId");

  if (actor?.isSuperAdmin) return await getProjectOr404(db, pid);

  const p = await getProjectOr404(db, pid);

  const b = await db.collection("iam_bindings").findOne({
    subjectType: "user",
    subjectId: String(actor.userId),
    $or: [
      { scopeType: "project", scopeId: pid, roleId: { $in: PROJECT_WRITE_ROLES } },
      { scopeType: "team", scopeId: String(p.teamId), roleId: { $in: TEAM_WRITE_ROLES } }
    ]
  });

  if (!b) throw httpError(403, "Forbidden", { projectId: pid, required: "project_owner|project_editor|team_owner" });
  return p;
}

async function requireProjectAdmin(db, projectId, actor) {
  const pid = requireNonEmptyId(projectId, "projectId");

  if (actor?.isSuperAdmin) return await getProjectOr404(db, pid);

  const p = await getProjectOr404(db, pid);

  const b = await db.collection("iam_bindings").findOne({
    subjectType: "user",
    subjectId: String(actor.userId),
    $or: [
      { scopeType: "project", scopeId: pid, roleId: { $in: PROJECT_ADMIN_ROLES } },
      { scopeType: "team", scopeId: String(p.teamId), roleId: { $in: TEAM_WRITE_ROLES } }
    ]
  });

  if (!b) throw httpError(403, "Forbidden", { projectId: pid, required: "project_owner|team_owner" });
  return p;
}

export function resourcesService(db) {
  const catalog = catalogItemsRepo(db);
  const kinds = resourceKindsRepo(db);
  const resources = resourcesRepo(db);
  const status = resourceStatusRepo(db);
  const outbox = eventsOutboxRepo(db);
  const secrets = secretsRepo(db);

  async function enqueueResourceChanged(resourceId, reason, actorUserId = null) {
    await outbox.enqueue({
      eventId: newId("evt"),
      type: "RESOURCE_CHANGED",
      resourceType: "resource",
      resourceId,
      payload: { reason, actorUserId },
      processed: false,
      processedAt: null,
      lock: null,
      attempts: 0,
      lastError: null,
      updatedAt: now(),
      createdAt: now()
    });
  }

  async function initStatus(resourceId, msg = "Queued for reconciliation") {
    await status.upsert(resourceId, {
      observedGeneration: 0,
      state: "creating",
      message: msg,
      details: null,
      lastUpdatedAt: now()
    });
  }

  async function validateKindSpecOr400(kind, spec) {
    const kindRow = await kinds.get(kind);
    const schemaRef = kindRow?.specSchemaRef || undefined;
    const v = validateResourceSpec(kind, spec, { schemaRef });
    if (!v.ok) {
      throw httpError(400, "Spec validation failed", {
        kind,
        schemaRef: v.schemaRef,
        errors: v.errors
      });
    }
  }

  async function maybeCreatePostgresPasswordSecret({ createdBy, resourceId, spec }) {
    if (spec.passwordSecretRef) return spec;

    const passwordPlain = randPassword();
    const enc = encryptString(passwordPlain);
    const secretId = newId("sec");

    await secrets.create({
      secretId,
      storeId: "store_local",
      scopeType: "resource",
      scopeId: resourceId,
      name: "db/password",
      type: "db_password",
      ciphertext: enc.ciphertext,
      encryptionMeta: enc.encryptionMeta,
      createdBy,
      createdAt: now()
    });

    return { ...spec, passwordSecretRef: secretId };
  }

  async function maybeCreatePublicRouteChild({ createdBy, rootResource }) {
    if (rootResource.kind !== "compute") return null;

    const exposure = rootResource.spec?.network?.exposure || "internal";
    const port = rootResource.spec?.network?.internalPort || null;

    if (exposure !== "public" || !port) return null;

    const routeResourceId = newId("res");
    const hostname = defaultHostname({ projectId: rootResource.projectId, name: rootResource.name });
    const createdAt = now();

    const routeDoc = {
      resourceId: routeResourceId,
      projectId: rootResource.projectId,
      kind: "http_route",
      name: `${rootResource.name}-route`,
      spec: {
        hostname,
        pathPrefix: null,
        targetResourceId: rootResource.resourceId,
        targetPort: port,
        protocol: "http"
      },
      desiredState: "active",
      labels: { "sensual.platformManaged": "true" },
      generation: 1,
      createdBy,
      createdAt,
      updatedAt: createdAt,
      parentResourceId: rootResource.resourceId,
      rootResourceId: rootResource.resourceId
    };

    await validateKindSpecOr400("http_route", routeDoc.spec);

    await resources.insert(routeDoc);
    await initStatus(routeResourceId, "Queued for route reconciliation");
    await enqueueResourceChanged(routeResourceId, "auto_create_route", createdBy);

    return routeDoc;
  }

  return {
    async createFromCatalog({ projectId, catalogId, name, overrides, actor }) {
      if (!actor?.userId) throw httpError(401, "Unauthorized");

      await requireProjectWrite(db, projectId, actor);

      const item = await catalog.getByCatalogId(catalogId);
      if (!item) throw httpError(404, `Unknown catalogId: ${catalogId}`);

      if (!name || !String(name).trim()) throw httpError(400, "name is required");
      if (overrides && !isPlainObject(overrides)) throw httpError(400, "overrides must be an object");

      const rootResourceId = newId("res");
      const createdAt = now();

      let spec = applyOfferingDefaults(item, overrides || {});
      if (item.kind === "postgres") {
        spec = await maybeCreatePostgresPasswordSecret({
          createdBy: actor.userId,
          resourceId: rootResourceId,
          spec
        });
      }

      // Validate final spec against kind schema.
      await validateKindSpecOr400(item.kind, spec);

      const rootDoc = {
        resourceId: rootResourceId,
        projectId: String(projectId),
        kind: item.kind,
        name: String(name).trim(),
        spec,
        desiredState: "active",
        labels: {},
        generation: 1,
        createdBy: actor.userId,
        createdAt,
        updatedAt: createdAt,
        parentResourceId: null,
        rootResourceId: rootResourceId
      };

      await resources.insert(rootDoc);
      await initStatus(rootResourceId);
      await enqueueResourceChanged(rootResourceId, "create", actor.userId);

      const childRoute = await maybeCreatePublicRouteChild({ createdBy: actor.userId, rootResource: rootDoc });
      return { resource: rootDoc, createdChildren: childRoute ? [childRoute] : [] };
    },

    async get(resourceId, actor) {
      if (!actor?.userId) throw httpError(401, "Unauthorized");

      const r = await resources.getByResourceId(resourceId);
      if (!r) throw httpError(404, `Resource not found: ${resourceId}`);

      await requireProjectRead(db, r.projectId, actor);

      const s = await status.get(resourceId);
      return { resource: r, status: s };
    },

    async list({ projectId, kind, actor }) {
      if (!actor?.userId) throw httpError(401, "Unauthorized");

      if (!projectId && !actor.isSuperAdmin) {
        throw httpError(400, "projectId is required");
      }

      if (projectId) await requireProjectRead(db, projectId, actor);

      return {
        resources: await resources.list({
          projectId: projectId ? String(projectId) : null,
          kind: kind ? String(kind) : null
        })
      };
    },

    async patch(resourceId, patch, actor) {
      if (!actor?.userId) throw httpError(401, "Unauthorized");

      const existing = await resources.getByResourceId(resourceId);
      if (!existing) throw httpError(404, `Resource not found: ${resourceId}`);

      await requireProjectWrite(db, existing.projectId, actor);

      const safe = pickPatch(patch);

      if (safe.spec) {
        safe.spec = deepMerge(existing.spec || {}, safe.spec || {});
        await validateKindSpecOr400(existing.kind, safe.spec);
      }

      const updated = await resources.update(resourceId, {
        ...safe,
        generation: (existing.generation || 0) + 1,
        updatedAt: now()
      });

      await enqueueResourceChanged(resourceId, "update", actor.userId);
      return { resource: updated };
    },

    async remove(resourceId, actor) {
      if (!actor?.userId) throw httpError(401, "Unauthorized");

      const existing = await resources.getByResourceId(resourceId);
      if (!existing) throw httpError(404, `Resource not found: ${resourceId}`);

      await requireProjectAdmin(db, existing.projectId, actor);

      const updated = await resources.update(resourceId, {
        desiredState: "deleted",
        generation: (existing.generation || 0) + 1,
        updatedAt: now()
      });

      await status.upsert(resourceId, {
        state: "deleting",
        message: "Deletion requested",
        lastUpdatedAt: now()
      });

      await enqueueResourceChanged(resourceId, "delete", actor.userId);
      return { resource: updated };
    }
  };
}
