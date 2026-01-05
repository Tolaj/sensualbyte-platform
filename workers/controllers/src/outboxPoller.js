export function createOutboxPoller({ outboxRepo, resourcesRepo, statusRepo, obsCache }) {
    return {
        async tick() {
            const evt = await outboxRepo.claimNext();
            if (!evt) return false;

            const resourceId = evt.resourceId;
            const resource = await resourcesRepo.getByResourceId(resourceId);

            if (!resource) {
                // resource deleted or missing; nothing to do
                return true;
            }

            // dispatch reconcile
            const { dispatch } = await import("./dispatcher.js");
            await dispatch({ resource, statusRepo, obsCache });

            return true;
        }
    };
}
