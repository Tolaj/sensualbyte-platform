import "../../../packages/shared/loadEnv.js";
import test from "node:test";
import assert from "node:assert/strict";

import { ensureTestEnv } from "./helpers/testEnv.js";
import { startApiForTest } from "./helpers/startApi.js";
import { httpJson } from "./helpers/http.js";
import { resetDb, seedMinimalCatalog } from "./helpers/setupDb.js";

test("api: catalog categories + items", async () => {
    ensureTestEnv();

    const api = await startApiForTest();
    try {
        await resetDb(api.db);
        await seedMinimalCatalog(api.db);

        const cats = await httpJson(api.baseUrl, "/v1/catalog/categories");
        assert.equal(cats.status, 200);
        assert.ok(Array.isArray(cats.json.categories));

        const items = await httpJson(api.baseUrl, "/v1/catalog/items");
        assert.equal(items.status, 200);
        assert.ok(Array.isArray(items.json.items));
        assert.ok(items.json.items.length >= 1);
    } finally {
        await api.stop();
    }
});
