export function env(name, fallback = undefined) {
    const v = process.env[name];
    if (v === undefined || v === "") {
        if (fallback !== undefined) return fallback;
        throw new Error(`Missing env: ${name}`);
    }
    return v;
}
