import { auditLogsRepo } from "../repos/auditLogs.repo.js";

export function auditService(db) {
    const repo = auditLogsRepo(db);

    return {
        async log({ actorUserId, action, resourceType, resourceId, metadata }) {
            const entry = {
                actorUserId,
                action,
                resourceType,
                resourceId,
                metadata: metadata || null,
                createdAt: new Date()
            };
            await repo.write(entry);
            return entry;
        }
    };
}
