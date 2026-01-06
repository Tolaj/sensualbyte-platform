export function ensureTestEnv() {
    // If you already use packages/shared/loadEnv.js, it will pull from repo root .env
    // These are hard requirements for the API + secrets
    const required = ["MONGO_URI", "MONGO_DB", "REDIS_URL", "MASTER_KEY_HEX"];

    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
        throw new Error(
            `Missing env vars for API tests: ${missing.join(", ")}. ` +
            `Set them in repo root .env or export them before running tests.`
        );
    }

    // Make tests safer: always use a dedicated test DB if you didn’t set one.
    // If you already set MONGO_DB to a test db, you can remove this.
    if (!String(process.env.MONGO_DB).includes("test")) {
        process.env.MONGO_DB = `${process.env.MONGO_DB}_test`;
    }

    // Avoid accidental destructive setup unless explicitly asked (your db:setup respects DB_RESET)
    process.env.DB_RESET = "true";
}
