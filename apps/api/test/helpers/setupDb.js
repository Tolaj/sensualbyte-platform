import { applyCollectionValidators } from "../../src/db/validators.js";
import { ensureIndexes } from "../../src/db/indexes.js";

export async function resetDb(db) {
    await db.dropDatabase();
    await applyCollectionValidators(db);
    await ensureIndexes(db);
}

async function upsertBy(db, collection, filter, doc) {
    const now = new Date();
    await db.collection(collection).updateOne(
        filter,
        { $setOnInsert: { createdAt: now }, $set: { ...doc, updatedAt: now } },
        { upsert: true }
    );
}

export async function seedMinimalCatalog(db) {
    // categories
    await upsertBy(
        db,
        "catalog_categories",
        { categoryId: "compute" },
        { categoryId: "compute", name: "Compute", description: "Compute", order: 10 }
    );

    // resource kinds
    await upsertBy(
        db,
        "resource_kinds",
        { kind: "compute" },
        {
            kind: "compute",
            displayName: "Compute",
            description: "Docker containers in v1",
            controller: { name: "compute.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/compute.spec.schema.json",
            metadata: { implementation: "docker_containers_v1" }
        }
    );

    await upsertBy(
        db,
        "resource_kinds",
        { kind: "postgres" },
        {
            kind: "postgres",
            displayName: "Postgres",
            description: "Docker postgres in v1",
            controller: { name: "postgres.controller", version: "v1" },
            specSchemaRef: "packages/schemas/kinds/postgres.spec.schema.json",
            metadata: { implementation: "docker_postgres_v1" }
        }
    );

    // offerings
    await upsertBy(
        db,
        "catalog_items",
        { catalogId: "container_service" },
        {
            catalogId: "container_service",
            categoryId: "compute",
            name: "Container Service",
            description: "PaaS compute",
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
        }
    );

    await upsertBy(
        db,
        "catalog_items",
        { catalogId: "managed_postgres" },
        {
            catalogId: "managed_postgres",
            categoryId: "database",
            name: "Managed Postgres",
            description: "Single node postgres",
            kind: "postgres",
            defaults: {
                version: "16",
                dbName: "app",
                username: "app",
                passwordSecretRef: null,
                storageMb: 10240,
                backups: { enabled: true, retentionDays: 7 }
            }
        }
    );
}
