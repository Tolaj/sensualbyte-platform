const { reconcileComputes } = require("./reconcileComputes");
const { reconcileServices } = require("./reconcileServices");

async function reconcileAll() {
    try {
        await reconcileComputes();
        await reconcileServices();
    } catch (e) {
        console.error("Reconcile error:", e.message);
    }
}

module.exports = { reconcileAll };
