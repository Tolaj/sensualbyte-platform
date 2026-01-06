import { auditLogsRepo } from "../repos/auditLogs.repo.js";
import { newId } from "../utils/ids.js";

export function auditService(db) {
    const audit = auditLogsRepo(db);

    return {
        async log({ actorUserId, action, resourceType, resourceId, metadata }) {
            const now = new Date();
            const doc = {
                auditId: newId("audit"),
                actorUserId: actorUserId || "system",
                action: String(action),
                resourceType: String(resourceType),
                resourceId: String(resourceId),
                metadata: metadata || null,
                createdAt: now
            };
            await audit.insert(doc);
            return doc;
        }
    };
}
