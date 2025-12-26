require("dotenv").config();

function must(name, fallback) {
    const v = process.env[name] ?? fallback;
    if (v === undefined || v === null || v === "") throw new Error(`Missing env: ${name}`);
    return v;
}

module.exports = {
    NODE_ENV: process.env.NODE_ENV || "development",
    API_PORT: Number(process.env.API_PORT || 3001),

    JWT_SECRET: must("JWT_SECRET", "change_me"),
    CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

    MONGO_URI: must("MONGO_URI", "mongodb://localhost:27017"),
    MONGO_DB: must("MONGO_DB", "sensual_platform"),

    SSH_USER: process.env.SSH_USER || "swapnil",
    DEFAULT_CPU: Number(process.env.DEFAULT_CPU || 1),
    DEFAULT_MEMORY_MB: Number(process.env.DEFAULT_MEMORY_MB || 512),
    DOCKER_NETWORK: process.env.DOCKER_NETWORK || "sensual_net",

    BASE_DOMAIN: process.env.BASE_DOMAIN || "localhost"
};
