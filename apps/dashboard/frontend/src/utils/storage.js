// src/utils/storage.js
const KEY = "sb.dashboard.settings.v1";

export function getSettings() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) {
            return {
                apiBase: "/api",
                userId: "user_superadmin",
            };
        }
        const s = JSON.parse(raw);
        return {
            apiBase: s.apiBase || "/api",
            userId: s.userId || "user_superadmin",
        };
    } catch {
        return { apiBase: "/api", userId: "user_superadmin" };
    }
}

export function setSettings(next) {
    localStorage.setItem(KEY, JSON.stringify(next));
}

export function resetSettings() {
    localStorage.removeItem(KEY);
}
