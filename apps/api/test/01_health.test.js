import "../../../packages/shared/loadEnv.js";
import test from "node:test";
import assert from "node:assert/strict";

import { ensureTestEnv } from "./helpers/testEnv.js";
import { startApiForTest } from "./helpers/startApi.js";
import { httpJson } from "./helpers/http.js";
import { resetDb, seedMinimalCatalog } from "./helpers/setupDb.js";

test("api: healthz + root", async () => {
    ensureTestEnv();

    const api = await startApiForTest();
    try {
        await resetDb(api.db);
        await seedMinimalCatalog(api.db);

        const h = await httpJson(api.baseUrl, "/healthz");
        assert.equal(h.status, 200);
        assert.equal(h.json.ok, true);

        const r = await httpJson(api.baseUrl, "/");
        assert.equal(r.status, 200);
        assert.equal(r.json.status, "OK");
    } finally {
        await api.stop();
    }
});
