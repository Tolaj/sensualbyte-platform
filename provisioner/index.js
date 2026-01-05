const docker = require("./core/docker");

module.exports = {
    core: docker,

    services: {
        create: require("./services/create").createService,
        health: require("./services/health").checkHealth,
        logs: require("./services/logs").getLogs,
    },

    computes: {
        create: require("./computes/create").createCompute,
    },
};
