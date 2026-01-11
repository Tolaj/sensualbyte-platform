import { loadEnv } from "../config/loadEnv.js";
import { getMongoDb, closeMongo } from "./mongo.js";

/**
 * Deterministic upsert:
 * - createdAt only on insert
 * - updatedAt on every run
 * - ignores incoming createdAt/updatedAt from doc
 */
async function upsertBy(db, collection, filter, doc) {
    const now = new Date();
    const { createdAt: _c, updatedAt: _u, ...rest } = doc || {};

    await db.collection(collection).updateOne(
        filter,
        {
            $setOnInsert: { createdAt: now },
            $set: { ...rest, updatedAt: now }
        },
        { upsert: true }
    );
}

/**
 * IAM roles: platform policy source of truth
 */
async function seedIamRoles(db) {
    const roles = [
        // GLOBAL
        {
            roleId: "super_admin",
            name: "Super Admin",
            description: "Full access to everything in the platform.",
            scopeType: "global",
            permissions: ["*"],
            inherits: null,
            system: true
        },

        // USER SELF
        {
            roleId: "user_owner",
            name: "User Owner",
            description: "Full control of own user scope.",
            scopeType: "user",
            permissions: ["user.*"],
            inherits: null,
            system: true
        },

        // TEAM
        {
            roleId: "team_owner",
            name: "Team Owner",
            description: "Full control of team, membership, and team projects.",
            scopeType: "team",
            permissions: ["team.*", "project.*", "iam.*"],
            inherits: null,
            system: true
        },
        {
            roleId: "team_member",
            name: "Team Member",
            description: "Basic team access.",
            scopeType: "team",
            permissions: ["team.read", "project.create", "project.read"],
            inherits: null,
            system: true
        },
        {
            roleId: "team_viewer",
            name: "Team Viewer",
            description: "Read-only team access.",
            scopeType: "team",
            permissions: ["team.read", "project.read"],
            inherits: null,
            system: true
        },

        // PROJECT
        {
            roleId: "project_owner",
            name: "Project Owner",
            description: "Full control of project and its resources.",
            scopeType: "project",
            permissions: ["project.*", "resource.*", "secret.*"],
            inherits: null,
            system: true
        },
        {
            roleId: "project_editor",
            name: "Project Editor",
            description: "Can manage resources in project.",
            scopeType: "project",
            permissions: ["project.read", "resource.create", "resource.read", "resource.update", "secret.read"],
            inherits: null,
            system: true
        },
        {
            roleId: "project_viewer",
            name: "Project Viewer",
            description: "Read-only access to project/resources.",
            scopeType: "project",
            permissions: ["project.read", "resource.read"],
            inherits: null,
            system: true
        }
    ];

    for (const r of roles) {
        await upsertBy(db, "iam_roles", { roleId: r.roleId }, r);
    }
}

/**
 * Super admin user + global binding
 * NOTE: passwordHash is placeholder because v1 auth is header-based.
 */
async function seedSuperAdmin(db) {
    await upsertBy(db, "users", { userId: "user_superadmin" }, {
        userId: "user_superadmin",
        email: "superadmin@sensualbyte.local",
        passwordHash: "CHANGE_ME_USE_REAL_AUTH_LATER",
        name: "Platform Super Admin",
        username: "superadmin",
        globalRole: "super_admin",
        active: true,
        lastLoginAt: null
    });

    await upsertBy(
        db,
        "iam_bindings",
        {
            scopeType: "global",
            scopeId: "global",
            subjectType: "user",
            subjectId: "user_superadmin"
        },
        {
            bindingId: "bind_superadmin_global",
            scopeType: "global",
            scopeId: "global",
            subjectType: "user",
            subjectId: "user_superadmin",
            roleId: "super_admin",
            createdBy: "user_superadmin"
        }
    );
}

async function seedSecretStores(db) {
    await upsertBy(db, "secret_stores", { storeId: "store_local" }, {
        storeId: "store_local",
        type: "local_encrypted_db",
        config: { keyId: "master" },
        active: true
    });
}

async function seedCatalogCategories(db) {
    const categories = [
        { categoryId: "compute", name: "Compute", description: "Processing power and app runtime", order: 10 },
        { categoryId: "storage", name: "Storage", description: "Object and volume storage", order: 20 },
        { categoryId: "database", name: "Databases", description: "Managed databases", order: 30 },
        { categoryId: "networking", name: "Networking", description: "Routing and traffic management", order: 40 },
        { categoryId: "identity", name: "Identity", description: "Users, roles, tokens, secrets", order: 50 },
        { categoryId: "observability", name: "Observability", description: "Logs and metrics", order: 60 },
        { categoryId: "management", name: "Management", description: "Ops tooling and automation", order: 70 }
    ];

    for (const c of categories) {
        await upsertBy(db, "catalog_categories", { categoryId: c.categoryId }, c);
    }
}

async function seedResourceKinds(db) {
    const kinds = [
        {
            kind: "compute",
            displayName: "Compute",
            description: "Docker container based compute (v1).",
            controller: { name: "compute.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/compute.spec.schema.json",
            metadata: { implementation: "docker_containers_v1" }
        },
        {
            kind: "bucket",
            displayName: "Object Bucket",
            description: "S3-like bucket backed by MinIO.",
            controller: { name: "bucket.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/bucket.spec.schema.json",
            metadata: { implementation: "minio_v1" }
        },
        {
            kind: "volume",
            displayName: "Volume",
            description: "Persistent volume (Docker volume in v1).",
            controller: { name: "volume.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/volume.spec.schema.json",
            metadata: { implementation: "docker_volume_v1" }
        },
        {
            kind: "http_route",
            displayName: "HTTP Route",
            description: "HTTP routing via Nginx gateway.",
            controller: { name: "httpRoute.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/http_route.spec.schema.json",
            metadata: { implementation: "nginx_gateway_v1" }
        },
        {
            kind: "postgres",
            displayName: "Managed Postgres",
            description: "Single-node managed Postgres (container based).",
            controller: { name: "postgres.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/postgres.spec.schema.json",
            metadata: { implementation: "docker_postgres_v1" }
        },
        {
            kind: "observability",
            displayName: "Observability Attachment",
            description: "Logs/metrics for targets (redis observed cache).",
            controller: { name: "observability.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/observability.spec.schema.json",
            metadata: { implementation: "basic_logs_metrics_v1" }
        },
        {
            kind: "mqtt",
            displayName: "MQTT",
            description: "MQTT endpoint / broker integration.",
            controller: { name: "mqtt.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/mqtt.spec.schema.json",
            metadata: { implementation: "mqtt_v1" }
        }

    ];

    for (const k of kinds) {
        await upsertBy(db, "resource_kinds", { kind: k.kind }, k);
    }
}

async function seedCatalogItems(db) {
    const items = [
        {
            catalogId: "compute_instance",
            categoryId: "compute",
            name: "Compute Instance",
            description: "Single compute instance with SSH (container-based in v1).",
            kind: "compute",
            defaults: {
                implementation: "docker",
                mode: "iaas",
                image: "linuxserver/openssh-server:latest",
                resources: { cpu: 1, memoryMb: 512 },
                network: { exposure: "internal", internalPort: 2222 },
                iaas: { sshUser: "ubuntu", sshKeySecretRef: null },
                env: {},
                storage: { mounts: [] }
            }
        },
        {
            catalogId: "container_service",
            categoryId: "compute",
            name: "Container Service",
            description: "PaaS-style compute (v1 runs containers).",
            kind: "compute",
            defaults: {
                implementation: "docker",
                mode: "paas",
                image: "nginxdemos/hello:latest",
                resources: { cpu: 1, memoryMb: 256 },
                network: { exposure: "public", internalPort: 80 },
                paas: { healthPath: "/", desiredReplicas: 1 },
                env: {},
                storage: { mounts: [] }
            }
        },
        {
            catalogId: "object_bucket",
            categoryId: "storage",
            name: "Object Bucket",
            description: "S3-like object bucket backed by MinIO.",
            kind: "bucket",
            defaults: { bucketName: null, versioning: false, publicRead: false, quotaMb: null }
        },
        {
            catalogId: "persistent_volume",
            categoryId: "storage",
            name: "Persistent Volume",
            description: "Persistent volume (Docker volume in v1).",
            kind: "volume",
            defaults: { name: null, sizeMb: null }
        },
        {
            catalogId: "http_route",
            categoryId: "networking",
            name: "HTTP Route",
            description: "Route hostname/path to a compute target via Nginx.",
            kind: "http_route",
            defaults: { hostname: null, pathPrefix: null, targetResourceId: null, targetPort: null, protocol: "http" }
        },
        {
            catalogId: "managed_postgres",
            categoryId: "database",
            name: "Managed Postgres",
            description: "Single-node managed Postgres.",
            kind: "postgres",
            defaults: {
                version: "16",
                dbName: "app",
                username: "app",
                passwordSecretRef: null,
                storageMb: 10240,
                backups: { enabled: true, retentionDays: 7 }
            }
        },
        {
            catalogId: "logs_metrics",
            categoryId: "observability",
            name: "Logs + Metrics",
            description: "Enable basic logs and metrics collection.",
            kind: "observability",
            defaults: { logs: { enabled: true }, metrics: { enabled: true }, targets: [] }
        }
    ];

    for (const it of items) {
        await upsertBy(db, "catalog_items", { catalogId: it.catalogId }, it);
    }
}

async function main() {
    loadEnv();
    const db = await getMongoDb();

    try {
        await seedSecretStores(db);

        console.log("Seeding IAM roles...");
        await seedIamRoles(db);

        console.log("Seeding super admin user...");
        await seedSuperAdmin(db);

        await seedCatalogCategories(db);
        await seedResourceKinds(db);
        await seedCatalogItems(db);

        console.log("✅ Seed complete");
    } finally {
        await closeMongo();
    }
}

main().catch((err) => {
    console.error(
        "❌ db:seed failed:",
        err?.message || err,
        err?.errInfo?.details?.schemaRulesNotSatisfied || ""
    );
    process.exit(1);
});
