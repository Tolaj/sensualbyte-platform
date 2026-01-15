// src/api.js
import { getSettings, setSettings, clearAuth } from "./utils/storage";

function notifySessionExpired(message) {
    try {
        if (typeof window !== "undefined" && typeof window.__sbToast === "function") {
            window.__sbToast({
                type: "warn",
                title: "Session expired",
                message: message || "Please sign in again.",
            });
        }
    } catch { }
}

function redirectToLogin() {
    if (typeof window === "undefined") return;
    if (window.location.pathname !== "/login") window.location.assign("/login");
}

function hardLogout(message) {
    try {
        clearAuth();
        notifySessionExpired(message);
        redirectToLogin();
    } catch { }
}

function joinUrl(base, path) {
    const b = String(base || "").replace(/\/+$/, "");
    const p = String(path || "");
    if (!p.startsWith("/")) return `${b}/${p}`;
    return `${b}${p}`;
}

async function parseBody(res) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return res.json();
    return res.text();
}

function buildHeaders(opts = {}) {
    const s = getSettings();
    const token = String(s.token || "").trim();
    const mode = String(s.authMode || "jwt").toLowerCase();

    const headers = new Headers(opts.headers || {});

    // Header auth mode: always x-user-id
    if (mode === "header") {
        headers.set("x-user-id", s.userId || "user_demo");
    }

    // JWT auth mode: send Bearer when present
    if (mode === "jwt" && token) {
        headers.set("authorization", `Bearer ${token}`);
    }

    // If user set token even in header mode, prefer Bearer too (safe)
    if (mode === "header" && token) {
        headers.set("authorization", `Bearer ${token}`);
    }

    if (!headers.has("content-type") && opts.body && typeof opts.body === "string") {
        headers.set("content-type", "application/json");
    }

    return headers;
}

function httpErrorFrom(res, body) {
    const msg =
        (body && body.message) ||
        (body && body.error) ||
        (typeof body === "string" ? body : null) ||
        `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    return err;
}

export async function apiFetch(path, opts = {}) {
    const s = getSettings();
    const url = joinUrl(s.apiBase, path);

    const headers = buildHeaders(opts);
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401) hardLogout("Your session is invalid/expired.");

    const body = await parseBody(res);
    if (!res.ok) throw httpErrorFrom(res, body);
    return body;
}

export async function apiFetchBlob(path, opts = {}) {
    const s = getSettings();
    const url = joinUrl(s.apiBase, path);

    const headers = buildHeaders(opts);
    const res = await fetch(url, { ...opts, headers });

    if (res.status === 401) hardLogout("Your session is invalid/expired.");

    if (!res.ok) {
        let body = null;
        try {
            body = await parseBody(res);
        } catch { }
        throw httpErrorFrom(res, body);
    }

    const blob = await res.blob();
    const cd = res.headers.get("content-disposition") || "";
    return { blob, contentDisposition: cd };
}

function filenameFromContentDisposition(cd) {
    const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd || "");
    const raw = m ? m[1] || m[2] || m[3] : "";
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

function encodeKeyPath(key) {
    const k = String(key || "").replace(/^\/+/, "");
    if (!k) return "";
    return k
        .split("/")
        .filter((p) => p.length > 0)
        .map((p) => encodeURIComponent(p))
        .join("/");
}

export async function apiFetchMultipart(path, formData, opts = {}) {
    const s = getSettings();
    const url = joinUrl(s.apiBase, path);

    const headers = new Headers(opts.headers || {});
    const mode = String(s.authMode || "jwt").toLowerCase();
    const token = String(s.token || "").trim();

    if (mode === "header") headers.set("x-user-id", s.userId || "user_demo");
    if (token) headers.set("authorization", `Bearer ${token}`);

    const res = await fetch(url, {
        method: opts.method || "POST",
        headers,
        body: formData,
    });

    if (res.status === 401) hardLogout("Your session is invalid/expired.");

    const body = await parseBody(res);
    if (!res.ok) throw httpErrorFrom(res, body);
    return body;
}

export const api = {
    health: () => apiFetch("/healthz"),

    authRegister: async ({ email, password, name }) => {
        const out = await apiFetch("/v1/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password, name }),
        });
        if (out?.token) {
            const s = getSettings();
            setSettings({ ...s, token: out.token, userId: out?.user?.userId || s.userId });
        }
        return out;
    },

    authLogin: async ({ email, password }) => {
        const out = await apiFetch("/v1/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });
        if (out?.token) {
            const s = getSettings();
            setSettings({ ...s, token: out.token, userId: out?.user?.userId || s.userId });
        }
        return out;
    },

    authMe: () => apiFetch("/v1/auth/me"),

    authLogout: () => {
        clearAuth();
        return { ok: true };
    },

    // Identity
    listTeams: () => apiFetch("/v1/identity/teams"),
    createTeam: (payload) => apiFetch("/v1/identity/teams", { method: "POST", body: JSON.stringify(payload) }),

    // Projects
    listProjects: (teamId) => apiFetch(`/v1/projects?teamId=${encodeURIComponent(teamId)}`),
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
    deleteResource: (resourceId) => apiFetch(`/v1/resources/${encodeURIComponent(resourceId)}`, { method: "DELETE" }),
    setDesiredState(resourceId, desiredState) {
        return this.patchResource(resourceId, { desiredState });
    },

    // Buckets
    bucketListObjects: (resourceId, { prefix = "" } = {}) =>
        apiFetch(`/v1/buckets/${encodeURIComponent(resourceId)}/objects?prefix=${encodeURIComponent(prefix || "")}`),

    bucketUploadObject: async (resourceId, file, { prefix = "" } = {}) => {
        const form = new FormData();
        form.append("file", file, file.name);
        form.append("prefix", prefix || "");
        return apiFetchMultipart(`/v1/buckets/${encodeURIComponent(resourceId)}/objects`, form, { method: "POST" });
    },

    bucketDeleteObject: (resourceId, key) =>
        apiFetch(`/v1/buckets/${encodeURIComponent(resourceId)}/objects/${encodeKeyPath(key)}`, { method: "DELETE" }),

    bucketDownloadObject: async (resourceId, key) => {
        const { blob, contentDisposition } = await apiFetchBlob(
            `/v1/buckets/${encodeURIComponent(resourceId)}/objects/${encodeKeyPath(key)}?download=1`,
            { method: "GET" }
        );
        const filename =
            filenameFromContentDisposition(contentDisposition) || String(key || "").split("/").pop() || "download";
        downloadBlob(blob, filename);
        return { filename };
    },
    // Admin / Identity
    listUsers: () => apiFetch("/v1/identity/users"),
    createUser: (payload) => apiFetch("/v1/identity/users", { method: "POST", body: JSON.stringify(payload) }),

    listIamRoles: () => apiFetch("/v1/identity/iam/roles"),
    createIamRole: (payload) => apiFetch("/v1/identity/iam/roles", { method: "POST", body: JSON.stringify(payload) }),
    patchIamRole: (roleId, patch) =>
        apiFetch(`/v1/identity/iam/roles/${encodeURIComponent(roleId)}`, { method: "PATCH", body: JSON.stringify(patch) }),
    deleteIamRole: (roleId) =>
        apiFetch(`/v1/identity/iam/roles/${encodeURIComponent(roleId)}`, { method: "DELETE" }),

    listIamBindings: (scopeType, scopeId) =>
        apiFetch(`/v1/identity/iam/bindings?scopeType=${encodeURIComponent(scopeType)}&scopeId=${encodeURIComponent(scopeId)}`),
    createIamBinding: (payload) =>
        apiFetch("/v1/identity/iam/bindings", { method: "POST", body: JSON.stringify(payload) }),
    deleteIamBinding: (payload) =>
        apiFetch("/v1/identity/iam/bindings", { method: "DELETE", body: JSON.stringify(payload) }),

};
