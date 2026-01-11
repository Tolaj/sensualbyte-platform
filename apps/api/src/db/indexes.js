export async function ensureIndexes(db) {
  const bg = { background: true };

  // users
  await db.collection("users").createIndex({ userId: 1 }, { unique: true, ...bg });
  await db.collection("users").createIndex({ email: 1 }, { unique: true, ...bg });

  // teams/projects
  await db.collection("teams").createIndex({ teamId: 1 }, { unique: true, ...bg });
  await db.collection("projects").createIndex({ projectId: 1 }, { unique: true, ...bg });
  await db.collection("projects").createIndex({ teamId: 1, createdAt: -1 }, bg);

  // catalog
  await db.collection("catalog_categories").createIndex({ categoryId: 1 }, { unique: true, ...bg });
  await db.collection("catalog_items").createIndex({ catalogId: 1 }, { unique: true, ...bg });
  await db.collection("catalog_items").createIndex({ categoryId: 1, createdAt: -1 }, bg);
  await db.collection("catalog_items").createIndex({ kind: 1, createdAt: -1 }, bg);

  // resource_kinds
  await db.collection("resource_kinds").createIndex({ kind: 1 }, { unique: true, ...bg });

  // resources
  await db.collection("resources").createIndex({ resourceId: 1 }, { unique: true, ...bg });
  await db.collection("resources").createIndex({ projectId: 1, kind: 1, createdAt: -1 }, bg);
  await db.collection("resources").createIndex({ kind: 1, desiredState: 1, updatedAt: -1 }, bg);
  await db.collection("resources").createIndex({ rootResourceId: 1 }, bg);
  await db.collection("resources").createIndex({ parentResourceId: 1 }, bg);

  // resource_status
  await db.collection("resource_status").createIndex({ resourceId: 1 }, { unique: true, ...bg });
  await db.collection("resource_status").createIndex({ state: 1, lastUpdatedAt: -1 }, bg);

  // secret stores + secrets
  await db.collection("secret_stores").createIndex({ storeId: 1 }, { unique: true, ...bg });
  await db.collection("secrets").createIndex({ secretId: 1 }, { unique: true, ...bg });
  await db.collection("secrets").createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 }, bg);
  // prevent duplicate secret names within a scope
  await db.collection("secrets").createIndex({ scopeType: 1, scopeId: 1, name: 1 }, { unique: true, ...bg });

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

  // iam roles/bindings
  await db.collection("iam_roles").createIndex({ roleId: 1 }, { unique: true, ...bg });

  await db.collection("iam_bindings").createIndex({ bindingId: 1 }, { unique: true, ...bg });
  await db.collection("iam_bindings").createIndex(
    { scopeType: 1, scopeId: 1, subjectType: 1, subjectId: 1 },
    { unique: true, ...bg }
  );
  await db.collection("iam_bindings").createIndex({ subjectType: 1, subjectId: 1 }, bg);
  await db.collection("iam_bindings").createIndex({ scopeType: 1, scopeId: 1 }, bg);
}
