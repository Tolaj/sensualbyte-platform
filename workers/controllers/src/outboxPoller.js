import { dispatch } from "./dispatcher.js";
import { reconcileWrapper } from "./common/reconcile.js";

function evtId(evt) {
    return evt?.eventId || (evt?._id ? String(evt._id) : null);
}

export function createOutboxPoller({ outboxRepo, resourcesRepo, statusRepo, obsCache, secretsRepo }) {
    return {
        async tick() {
            const evt = await outboxRepo.claimNext();
            if (!evt) return false;

            const id = evtId(evt);
            if (!id) {
                // cannot track this event properly; just bail hard
                throw new Error("Outbox event missing eventId/_id");
            }

            try {
                const resource = await resourcesRepo.getByResourceId(evt.resourceId);

                // resource deleted but event exists -> mark done
                if (!resource) {
                    await outboxRepo.markDone(id);
                    return true;
                }

                await reconcileWrapper(dispatch, { resource, statusRepo, obsCache, secretsRepo });
                await outboxRepo.markDone(id);
                return true;
            } catch (err) {
                await outboxRepo.markFailed(id, err);
                throw err;
            }
        }
    };
}
