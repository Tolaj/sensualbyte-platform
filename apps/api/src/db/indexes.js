export async function ensureIndexes(db) {
  // users
  await db.collection("users").createIndex({ userId: 1 }, { unique: true });
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  // teams/projects
  await db.collection("teams").createIndex({ teamId: 1 }, { unique: true });
  await db.collection("projects").createIndex({ projectId: 1 }, { unique: true });
  await db.collection("projects").createIndex({ teamId: 1, createdAt: -1 });

  // team_members
  await db.collection("team_members").createIndex({ teamId: 1, userId: 1 }, { unique: true });

  // role_bindings
  await db.collection("role_bindings").createIndex(
    { resourceType: 1, resourceId: 1, subjectType: 1, subjectId: 1 },
    { unique: true }
  );

  // catalog
  await db.collection("catalog_categories").createIndex({ categoryId: 1 }, { unique: true });
  await db.collection("catalog_items").createIndex({ catalogId: 1 }, { unique: true });
  await db.collection("catalog_items").createIndex({ categoryId: 1, createdAt: -1 });

  // resource_kinds
  await db.collection("resource_kinds").createIndex({ kind: 1 }, { unique: true });

  // resources (this is your “service instance”)
  await db.collection("resources").createIndex({ resourceId: 1 }, { unique: true });
  await db.collection("resources").createIndex({ projectId: 1, kind: 1, createdAt: -1 });
  await db.collection("resources").createIndex({ kind: 1, desiredState: 1, updatedAt: -1 });
  await db.collection("resources").createIndex({ rootResourceId: 1 });
  await db.collection("resources").createIndex({ parentResourceId: 1 });

  // resource_status
  await db.collection("resource_status").createIndex({ resourceId: 1 }, { unique: true });

  // secrets
  await db.collection("secret_stores").createIndex({ storeId: 1 }, { unique: true });
  await db.collection("secrets").createIndex({ secretId: 1 }, { unique: true });
  await db.collection("secrets").createIndex({ scopeType: 1, scopeId: 1, createdAt: -1 });

  // outbox
  await db.collection("events_outbox").createIndex({ eventId: 1 }, { unique: true });
  await db.collection("events_outbox").createIndex({ processed: 1, createdAt: 1 });

  // audit
  await db.collection("audit_logs").createIndex({ createdAt: -1 });
  await db.collection("audit_logs").createIndex({ actorUserId: 1, createdAt: -1 });

  // deployments
  await db.collection("deployments").createIndex({ deploymentId: 1 }, { unique: true });
  await db.collection("deployments").createIndex({ resourceId: 1, createdAt: -1 });
}
