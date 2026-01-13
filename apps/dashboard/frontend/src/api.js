// src/api.js
import { getSettings } from "./utils/storage";

function joinUrl(base, path) {
    const b = String(base || "").replace(/\/+$/, "");
    const p = String(path || "");
    if (!p.startsWith("/")) return `${b}/${p}`;
    return `${b}${p}`;
}

async function parseBody(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    const text = await res.text();
    return text;
}

function buildHeaders(opts = {}) {
    const s = getSettings();
    const userId = s.userId || "user_superadmin";

    const headers = new Headers(opts.headers || {});
    headers.set("x-user-id", userId);

    // auto json header only if body is string (we pass JSON.stringify)
    if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
        headers.set("content-type", "application/json");
    }
    return headers;
}

export async function apiFetch(path, opts = {}) {
    const s = getSettings();
    const base = s.apiBase || "/api";
    const url = joinUrl(base, path);

    const headers = buildHeaders(opts);

    const res = await fetch(url, { ...opts, headers });
    const body = await parseBody(res);

    if (!res.ok) {
        const msg =
            (body && body.message) ||
            (body && body.error) ||
            (typeof body === "string" ? body : null) ||
            `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.body = body;
        throw err;
    }
    return body;
}

// ✅ For downloads (blob)
export async function apiFetchBlob(path, opts = {}) {
    const s = getSettings();
    const base = s.apiBase || "/api";
    const url = joinUrl(base, path);

    const headers = buildHeaders(opts);

    const res = await fetch(url, { ...opts, headers });

    if (!res.ok) {
        // try json for good error messages
        let body = null;
        try {
            body = await parseBody(res);
        } catch {
            body = null;
        }
        const msg =
            (body && body.message) ||
            (body && body.error) ||
            (typeof body === "string" ? body : null) ||
            `HTTP ${res.status}`;
        const err = new Error(msg);
        err.status = res.status;
        err.body = body;
        throw err;
    }

    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    return { blob, contentDisposition: cd };
}

function filenameFromContentDisposition(cd) {
    // Content-Disposition: attachment; filename="id_rsa"
    const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd || "");
    const raw = m ? (m[1] || m[2] || m[3]) : "";
    if (!raw) return null;
    try {
        return decodeURIComponent(raw.trim());
    } catch {
        return raw.trim();
    }
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Convenience wrappers
export const api = {
    health: () => apiFetch("/healthz"),

    // Identity
    listUsers: () => apiFetch("/v1/identity/users"),
    createUser: (payload) => apiFetch("/v1/identity/users", { method: "POST", body: JSON.stringify(payload) }),

    listTeams: () => apiFetch("/v1/identity/teams"),
    createTeam: (payload) => apiFetch("/v1/identity/teams", { method: "POST", body: JSON.stringify(payload) }),

    listIamRoles: () => apiFetch("/v1/identity/iam/roles"),

    // Projects
    listProjects: (teamId) =>
        apiFetch(teamId ? `/v1/projects?teamId=${encodeURIComponent(teamId)}` : "/v1/projects"),
    createProject: (payload) => apiFetch("/v1/projects", { method: "POST", body: JSON.stringify(payload) }),

    // Catalog
    listCatalog: () => apiFetch("/v1/catalog/items"),
    listCatalogCategories: () => apiFetch("/v1/catalog/categories"),

    // Resources
    listResources: (projectId) => {
        if (!projectId) throw new Error("projectId required");
        return apiFetch(`/v1/resources?projectId=${encodeURIComponent(projectId)}`);
    },
    getResource: (resourceId) => apiFetch(`/v1/resources/${encodeURIComponent(resourceId)}`),
    createResource: (payload) => apiFetch("/v1/resources", { method: "POST", body: JSON.stringify(payload) }),
    patchResource: (resourceId, patch) =>
        apiFetch(`/v1/resources/${encodeURIComponent(resourceId)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteResource: (resourceId) =>
        apiFetch(`/v1/resources/${encodeURIComponent(resourceId)}`, { method: "DELETE" }),
    setDesiredState(resourceId, desiredState) {
        return this.patchResource(resourceId, { desiredState });
    },

    // Observability
    getObserved: (resourceId) => apiFetch(`/v1/observability/observed/${encodeURIComponent(resourceId)}`),

    // ✅ NEW: One-time SSH key download
    async downloadSshKey(secretId) {
        const { blob, contentDisposition } = await apiFetchBlob(
            `/v1/secrets/${encodeURIComponent(secretId)}/ssh-key?download=1`,
            { method: "GET" }
        );
        const filename = filenameFromContentDisposition(contentDisposition) || "id_rsa";
        downloadBlob(blob, filename);
        return { filename };
    },
};
