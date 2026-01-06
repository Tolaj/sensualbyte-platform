import "../../../packages/shared/loadEnv.js";
import test from "node:test";
import assert from "node:assert/strict";

import { ensureTestEnv } from "./helpers/testEnv.js";
import { startApiForTest } from "./helpers/startApi.js";
import { httpJson } from "./helpers/http.js";
import { resetDb, seedMinimalCatalog } from "./helpers/setupDb.js";

test("api: create team+project -> create postgres resource -> outbox + status + secrets", async () => {
    ensureTestEnv();

    const api = await startApiForTest();
    try {
        await resetDb(api.db);
        await seedMinimalCatalog(api.db);

        // Create team
        const teamRes = await httpJson(api.baseUrl, "/v1/identity/teams", {
            method: "POST",
            body: { name: "Team One" }
        });
        assert.equal(teamRes.status, 201);
        const teamId = teamRes.json.team.teamId;
        assert.ok(teamId);

        // Create project
        const projRes = await httpJson(api.baseUrl, "/v1/projects", {
            method: "POST",
            body: { teamId, name: "Proj One" }
        });
        assert.equal(projRes.status, 201);
        const projectId = projRes.json.project.projectId;
        assert.ok(projectId);

        // Create Postgres resource from catalog
        const createRes = await httpJson(api.baseUrl, "/v1/resources", {
            method: "POST",
            body: {
                projectId,
                catalogId: "managed_postgres",
                name: "pg1",
                overrides: { dbName: "app", username: "app" }
            }
        });
        assert.equal(createRes.status, 201);

        const resource = createRes.json.resource;
        assert.equal(resource.kind, "postgres");
        assert.ok(resource.resourceId);
        assert.ok(resource.spec.passwordSecretRef);

        const resourceId = resource.resourceId;
        const secretId = resource.spec.passwordSecretRef;

        // GET resource should include status object
        const getRes = await httpJson(api.baseUrl, `/v1/resources/${resourceId}`);
        assert.equal(getRes.status, 200);
        assert.equal(getRes.json.resource.resourceId, resourceId);
        assert.ok(getRes.json.status);
        assert.equal(getRes.json.status.state, "creating"); // initial state set by API

        // Outbox should have at least one event for the resource
        const outboxCount = await api.db.collection("events_outbox").countDocuments({ resourceId });
        assert.ok(outboxCount >= 1);

        // Secret list by scope should return secret but NOT ciphertext
        const listSecrets = await httpJson(
            api.baseUrl,
            `/v1/secrets?scopeType=resource&scopeId=${resourceId}`
        );
        assert.equal(listSecrets.status, 200);
        assert.ok(Array.isArray(listSecrets.json.secrets));
        assert.ok(listSecrets.json.secrets.find((s) => s.secretId === secretId));
        assert.equal(listSecrets.json.secrets[0].ciphertext, undefined);

        // Secret get: ciphertext hidden by default
        const getSecretSafe = await httpJson(api.baseUrl, `/v1/secrets/${secretId}`);
        assert.equal(getSecretSafe.status, 200);
        assert.equal(getSecretSafe.json.secret.secretId, secretId);
        assert.equal(getSecretSafe.json.secret.ciphertext, undefined);

        // Secret get: includeCiphertext=1 should reveal ciphertext (still encrypted)
        const getSecretFull = await httpJson(api.baseUrl, `/v1/secrets/${secretId}?includeCiphertext=1`);
        assert.equal(getSecretFull.status, 200);
        assert.ok(getSecretFull.json.secret.ciphertext);
        assert.ok(getSecretFull.json.secret.encryptionMeta);
    } finally {
        await api.stop();
    }
});
