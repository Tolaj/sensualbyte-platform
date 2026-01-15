// src/utils/storage.js
const KEY = "sb_settings";
const EVT = "sb:settings";

const DEFAULTS = {
    // CRA envs (react-scripts): REACT_APP_*
    apiBase: process.env.REACT_APP_API_BASE_URL || "http://localhost:3001",
    authMode: process.env.REACT_APP_AUTH_MODE || "jwt", // "jwt" | "header"
    userId: process.env.REACT_APP_DEV_USER_ID || "user_superadmin",
    token: "",
    teamId: "",
    projectId: "",
};

function read() {
    try {
        const raw = localStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return { ...DEFAULTS, ...(parsed || {}) };
    } catch {
        return { ...DEFAULTS };
    }
}

function write(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVT, { detail: next }));
}

export function getSettings() {
    if (typeof window === "undefined") return { ...DEFAULTS };
    return read();
}

export function setSettings(patch) {
    const cur = getSettings();
    const next = { ...cur, ...(patch || {}) };
    write(next);
    return next;
}

export function clearAuth() {
    const cur = getSettings();
    write({ ...cur, token: "" });
}

export function getWorkspace() {
    const s = getSettings();
    return { teamId: s.teamId, projectId: s.projectId };
}

export function subscribeSettings(cb) {
    const onCustom = (e) => cb?.(e.detail || getSettings());
    const onStorage = (e) => {
        if (e.key === KEY) cb?.(getSettings());
    };

    window.addEventListener(EVT, onCustom);
    window.addEventListener("storage", onStorage);

    return () => {
        window.removeEventListener(EVT, onCustom);
        window.removeEventListener("storage", onStorage);
    };
}
