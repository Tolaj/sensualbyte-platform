import { dispatch } from "./dispatcher.js";
import { reconcileWrapper } from "./common/reconcile.js";

export function createOutboxPoller({ outboxRepo, resourcesRepo, statusRepo, obsCache, secretsRepo }) {
    return {
        async tick() {
            const evt = await outboxRepo.claimNext();
            if (!evt) return false;

            try {
                const resource = await resourcesRepo.getByResourceId(evt.resourceId);
                if (!resource) {
                    await outboxRepo.markDone(evt.eventId);
                    return true;
                }

                await reconcileWrapper(dispatch, { resource, statusRepo, obsCache, secretsRepo });
                await outboxRepo.markDone(evt.eventId);
                return true;
            } catch (err) {
                await outboxRepo.markFailed(evt.eventId, err);
                throw err;
            }
        }
    };
}
