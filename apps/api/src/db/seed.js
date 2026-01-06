import "../../../../packages/shared/loadEnv.js";
import { getMongoDb } from "./mongo.js";

async function upsert(db, col, filter, doc) {
    const now = new Date();

    // IMPORTANT: never set createdAt in both $set and $setOnInsert
    const { createdAt, ...docWithoutCreatedAt } = doc || {};

    await db.collection(col).updateOne(
        filter,
        {
            $setOnInsert: { createdAt: createdAt || now },
            $set: { ...docWithoutCreatedAt, updatedAt: now }
        },
        { upsert: true }
    );
}


async function main() {
    const db = await getMongoDb();

    // secret store default
    await upsert(db, "secret_stores", { storeId: "store_local" }, {
        storeId: "store_local",
        type: "local_encrypted_db",
        config: { note: "AES-256-GCM using MASTER_KEY_HEX" },
        active: true,
        createdAt: new Date()
    });

    // categories (AWS-like)
    const cats = [
        { categoryId: "compute", name: "☁️ Compute", description: "Run applications", order: 10 },
        { categoryId: "storage", name: "💾 Storage", description: "Object + volumes", order: 20 },
        { categoryId: "database", name: "🗄️ Databases", description: "Managed DBs", order: 30 },
        { categoryId: "networking", name: "🌐 Networking", description: "HTTP routing", order: 40 },
        { categoryId: "identity", name: "🔐 Identity", description: "Users & roles", order: 50 },
        { categoryId: "observability", name: "📊 Observability", description: "Logs & metrics", order: 60 },
        { categoryId: "integration", name: "🚀 Integration", description: "MQTT/queues later", order: 70 }
    ];
    for (const c of cats) await upsert(db, "catalog_categories", { categoryId: c.categoryId }, c);

    // resource_kinds
    const kinds = [
        { kind: "compute", displayName: "Compute", description: "v1 containers; later VMs", controller: { name: "compute.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/compute.spec.schema.json", metadata: { impl: "docker_v1" } },
        { kind: "volume", displayName: "Volume", description: "Docker volume", controller: { name: "volume.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/volume.spec.schema.json", metadata: { impl: "docker_volume_v1" } },
        { kind: "bucket", displayName: "Bucket", description: "MinIO-backed bucket", controller: { name: "bucket.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/bucket.spec.schema.json", metadata: { impl: "minio_v1" } },
        { kind: "postgres", displayName: "Postgres", description: "Docker postgres single node", controller: { name: "postgres.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/postgres.spec.schema.json", metadata: { impl: "docker_pg_v1" } },
        { kind: "http_route", displayName: "HTTP Route", description: "Nginx routing", controller: { name: "httpRoute.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/http_route.spec.schema.json", metadata: { impl: "nginx_v1" } },
        { kind: "observability", displayName: "Observability", description: "v1 stub", controller: { name: "observability.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/observability.spec.schema.json", metadata: {} },
        { kind: "mqtt", displayName: "MQTT", description: "future managed", controller: { name: "mqtt.controller", version: "v1" }, specSchemaRef: "packages/schemas/kinds/mqtt.spec.schema.json", metadata: {} }
    ];
    for (const k of kinds) await upsert(db, "resource_kinds", { kind: k.kind }, k);

    // catalog items (offerings)
    const items = [
        {
            catalogId: "container_service",
            categoryId: "compute",
            name: "Container Service (ECS-like)",
            description: "PaaS compute (container-based v1)",
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
            catalogId: "ssh_box",
            categoryId: "compute",
            name: "SSH Box",
            description: "IaaS compute with SSH (container-based v1)",
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
            }
        },
        { catalogId: "persistent_volume", categoryId: "storage", name: "Persistent Volume", description: "Docker volume", kind: "volume", defaults: { name: null, sizeMb: null } },
        { catalogId: "object_bucket", categoryId: "storage", name: "Object Bucket (S3-like)", description: "MinIO bucket", kind: "bucket", defaults: { bucketName: null, versioning: false, publicRead: false, quotaMb: null } },
        { catalogId: "managed_postgres", categoryId: "database", name: "Managed Postgres", description: "Docker postgres single node", kind: "postgres", defaults: { version: "16", dbName: "app", username: "app", passwordSecretRef: null, storageMb: 10240, backups: { enabled: true, retentionDays: 7 } } },
        { catalogId: "http_route", categoryId: "networking", name: "HTTP Route", description: "Nginx route to target", kind: "http_route", defaults: { hostname: null, pathPrefix: null, targetResourceId: null, targetPort: null, protocol: "http" } },
        { catalogId: "logs_metrics", categoryId: "observability", name: "Logs + Metrics", description: "v1 stub", kind: "observability", defaults: { logs: { enabled: true }, metrics: { enabled: true }, targets: [] } }
    ];
    for (const it of items) await upsert(db, "catalog_items", { catalogId: it.catalogId }, { ...it, inputSchema: null, components: null });

    console.log("✅ db seed complete");
}
main().catch((e) => { console.error("db:seed failed", e); process.exit(1); });
