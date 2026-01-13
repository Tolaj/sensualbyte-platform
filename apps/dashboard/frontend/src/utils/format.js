// src/utils/format.js
export function fmtTime(iso) {
    if (!iso) return "";
    try {
        const d = new Date(iso);
        return d.toLocaleString();
    } catch {
        return String(iso);
    }
}

export function safeStringify(obj) {
    try {
        return JSON.stringify(obj, null, 2);
    } catch (e) {
        return String(obj);
    }
}

export function asArray(maybe) {
    if (Array.isArray(maybe)) return maybe;
    if (maybe == null) return [];
    return [maybe];
}
