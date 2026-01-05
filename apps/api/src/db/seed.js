import "dotenv/config";
import { getMongoDb, closeMongo } from "./mongo.js";

/**
 * Simple deterministic upsert helper.
 */
async function upsertBy(db, collection, filter, doc) {
    const now = new Date();
    const setOnInsert = { createdAt: now };
    const set = { ...doc, updatedAt: now };

    await db.collection(collection).updateOne(filter, { $setOnInsert: setOnInsert, $set: set }, { upsert: true });
}

function nowish() {
    return new Date();
}

async function seedCatalogCategories(db) {
    const categories = [
        { categoryId: "compute", name: "☁️ Compute", description: "Processing power and app runtime", order: 10 },
        { categoryId: "storage", name: "💾 Storage", description: "Object and volume storage", order: 20 },
        { categoryId: "database", name: "🗄️ Databases", description: "Managed databases", order: 30 },
        { categoryId: "networking", name: "🌐 Networking & Content Delivery", description: "Routing and traffic management", order: 40 },
        { categoryId: "identity", name: "🔐 Security, Identity & Compliance", description: "Users, roles, tokens, secrets", order: 50 },
        { categoryId: "observability", name: "📊 Observability", description: "Logs and metrics", order: 60 },
        { categoryId: "management", name: "🛠️ Management", description: "Ops tooling and automation", order: 70 },
        { categoryId: "integration", name: "🚀 Application Integration", description: "Messaging, events, MQTT", order: 80 }
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
            description: "Abstract compute. v1 uses Docker containers; future can be VMs.",
            controller: { name: "compute.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/compute.spec.schema.json",
            metadata: { implementation: "docker_containers_v1", notes: "spec.implementation=docker in v1" }
        },
        {
            kind: "bucket",
            displayName: "Object Bucket",
            description: "S3-like bucket backed by MinIO",
            controller: { name: "bucket.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/bucket.spec.schema.json",
            metadata: { implementation: "minio_v1" }
        },
        {
            kind: "volume",
            displayName: "Volume",
            description: "Persistent storage volume (Docker volume in v1)",
            controller: { name: "volume.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/volume.spec.schema.json",
            metadata: { implementation: "docker_volume_v1" }
        },
        {
            kind: "http_route",
            displayName: "HTTP Route",
            description: "HTTP/WebSocket routing via Nginx gateway",
            controller: { name: "httpRoute.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/http_route.spec.schema.json",
            metadata: { implementation: "nginx_gateway_v1" }
        },
        {
            kind: "postgres",
            displayName: "Managed Postgres",
            description: "Single-node managed Postgres",
            controller: { name: "postgres.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/postgres.spec.schema.json",
            metadata: { implementation: "docker_postgres_v1" }
        },
        {
            kind: "observability",
            displayName: "Observability Attachment",
            description: "Enable logs/metrics collection for targets",
            controller: { name: "observability.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/observability.spec.schema.json",
            metadata: { implementation: "basic_logs_metrics_v1" }
        }
        // mqtt kind can be added later if you implement a managed mqtt controller
    ];

    for (const k of kinds) {
        await upsertBy(db, "resource_kinds", { kind: k.kind }, k);
    }
}

async function seedCatalogItems(db) {
    /**
     * catalog_items = offerings (AWS-like)
     * Each offering produces exactly ONE root resource.
     * Some offerings optionally describe "components" (composition) that the API can create as child resources.
     *
     * NOTE: components are optional; we can start with single-resource offerings and add components later.
     */

    const items = [
        // ☁️ Compute
        {
            catalogId: "compute_instance",
            categoryId: "compute",
            name: "Compute Instance (EC2-like)",
            description: "Single compute instance with SSH access (container-based in v1).",
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
            },
            inputSchema: null,
            components: null
        },
        {
            catalogId: "container_service",
            categoryId: "compute",
            name: "Container Service (ECS-like)",
            description: "PaaS-style compute with health checks and replicas (v1 still runs containers).",
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
            },
            inputSchema: null,
            components: null
        },
        {
            catalogId: "ssh_box",
            categoryId: "compute",
            name: "SSH Box",
            description: "A ready-to-SSH compute instance (container-based).",
            kind: "compute",
            defaults: {
                implementation: "docker",
                mode: "iaas",
                image: "linuxserver/openssh-server:latest",
                resources: { cpu: 1, memoryMb: 512 },
                network: { exposure: "internal", internalPort: 2222 },
                iaas: { sshUser: "ubuntu", sshKeySecretRef: null },
                env: { PUID: "1000", PGID: "1000", TZ: "America/New_York" },
                storage: { mounts: [] }
            },
            inputSchema: null,
            components: null
        },

        // 💾 Storage
        {
            catalogId: "object_bucket",
            categoryId: "storage",
            name: "Object Bucket (S3-like)",
            description: "S3-like object bucket backed by MinIO.",
            kind: "bucket",
            defaults: {
                bucketName: null,
                versioning: false,
                publicRead: false,
                quotaMb: null
            },
            inputSchema: null,
            components: null
        },
        {
            catalogId: "persistent_volume",
            categoryId: "storage",
            name: "Persistent Volume",
            description: "A persistent volume (Docker volume in v1).",
            kind: "volume",
            defaults: {
                name: null,
                sizeMb: null
            },
            inputSchema: null,
            components: null
        },

        // 🌐 Networking
        {
            catalogId: "http_route",
            categoryId: "networking",
            name: "HTTP Route",
            description: "Route hostname/path to a compute target via Nginx.",
            kind: "http_route",
            defaults: {
                hostname: null,
                pathPrefix: null,
                targetResourceId: null,
                targetPort: null,
                protocol: "http"
            },
            inputSchema: null,
            components: null
        },

        // 🗄️ Database
        {
            catalogId: "managed_postgres",
            categoryId: "database",
            name: "Managed Postgres (RDS-like)",
            description: "Single-node managed Postgres with backups config.",
            kind: "postgres",
            defaults: {
                version: "16",
                dbName: "app",
                username: "app",
                passwordSecretRef: null,
                storageMb: 10240,
                backups: { enabled: true, retentionDays: 7 }
            },
            inputSchema: null,
            components: null
        },

        // 📊 Observability
        {
            catalogId: "logs_metrics",
            categoryId: "observability",
            name: "Logs + Metrics",
            description: "Enable basic logs and metrics collection for target resources.",
            kind: "observability",
            defaults: {
                logs: { enabled: true },
                metrics: { enabled: true },
                targets: []
            },
            inputSchema: null,
            components: null
        }
    ];

    for (const it of items) {
        await upsertBy(db, "catalog_items", { catalogId: it.catalogId }, it);
    }
}

async function main() {
    const db = await getMongoDb();

    console.log("Seeding catalog categories...");
    await seedCatalogCategories(db);

    console.log("Seeding resource kinds...");
    await seedResourceKinds(db);

    console.log("Seeding catalog items...");
    await seedCatalogItems(db);

    console.log("✅ Seed complete");
    await closeMongo();
}

main().catch(async (err) => {
    console.error("❌ db:seed failed:", err);
    await closeMongo();
    process.exit(1);
});
