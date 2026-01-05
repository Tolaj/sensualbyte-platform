function isObject(v) {
    return v && typeof v === "object" && !Array.isArray(v);
}

export function deepMerge(base, overlay) {
    if (!isObject(base)) return overlay;
    const out = { ...base };
    for (const [k, v] of Object.entries(overlay || {})) {
        if (isObject(v) && isObject(out[k])) out[k] = deepMerge(out[k], v);
        else out[k] = v;
    }
    return out;
}
