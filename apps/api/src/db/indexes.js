export async function ensureIndexes(db) {
  const bg = { background: true };

  // users
  await db.collection("users").createIndex({ userId: 1 }, { unique: true, ...bg });
  await db.collection("users").createIndex({ email: 1 }, { unique: true, ...bg });

  // teams/projects
  await db.collection("teams").createIndex({ teamId: 1 }, { unique: true, ...bg });
  await db.collection("projects").createIndex({ projectId: 1 }, { unique: true, ...bg });
  await db.collection("projects").createIndex({ teamId: 1, createdAt: -1 }, bg);

  // team_members
  await db.collection("team_members").createIndex({ teamId: 1, userId: 1 }, { unique: true, ...bg });

  // role_bindings
  await db.collection("role_bindings").createIndex(
    { resourceType: 1, resourceId: 1, subjectType: 1, subjectId: 1 },
    { unique: true, ...bg }
  );

  // catalog
  await db.collection("catalog_categories").createIndex({ categoryId: 1 }, { unique: true, ...bg });
  await db.collection("catalog_items").createIndex({ catalogId: 1 }, { unique: true, ...bg });
  await db.collection("catalog_items").createIndex({ categoryId: 1, createdAt: -1 }, bg);

  // resource_kinds
  await db.collection("resource_kinds").createIndex({ kind: 1 }, { unique: true, ...bg });

  // resources (service instance)
  await db.collection("resources").createIndex({ resourceId: 1 }, { unique: true, ...bg });
  await db.collection("resources").createIndex({ projectId: 1, kind: 1, createdAt: -1 }, bg);
  await db.collection("resources").createIndex({ kind: 1, desiredState: 1, updatedAt: -1 }, bg);
  await db.collection("resources").createIndex({ rootResourceId: 1 }, bg);
  await db.collection("resources").createIndex({ parentResourceId: 1 }, bg);

  // resource_status
  await db.collection("resource_status").createIndex({ resourceId: 1 }, { unique: true, ...bg });
  await db.collection("resource_status").createIndex({ state: 1, lastUpdatedAt: -1 }, bg);

  // secrets
  await db.collection("secret_stores").createIndex({ storeId: 1 }, { unique: true, ...bg });
  await db.collection("secrets").createIndex({ secretId: 1 }, { unique: true, ...bg });
  await db.collection("secrets").createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 }, bg);

  // outbox
  await db.collection("events_outbox").createIndex({ eventId: 1 }, { unique: true, ...bg });
  await db.collection("events_outbox").createIndex({ processed: 1, createdAt: 1 }, bg);
  await db.collection("events_outbox").createIndex({ "lock.lockExpiresAt": 1, processed: 1 }, bg);

  // audit
  await db.collection("audit_logs").createIndex({ createdAt: -1 }, bg);
  await db.collection("audit_logs").createIndex({ actorUserId: 1, createdAt: -1 }, bg);

  // deployments
  await db.collection("deployments").createIndex({ deploymentId: 1 }, { unique: true, ...bg });
  await db.collection("deployments").createIndex({ resourceId: 1, createdAt: -1 }, bg);
}
