// ✅ 3) apps/api/src/services/minio.service.js
import { Client } from "minio";

function bool(v, fallback = false) {
    const s = String(v ?? "").toLowerCase();
    if (!s) return fallback;
    return s === "true" || s === "1" || s === "yes";
}

function reqEnv(name, fallback = "") {
    const v = process.env[name];
    return (v == null || v === "") ? fallback : String(v);
}

export function minioService() {
    // IMPORTANT: endpoint should NOT include scheme for MinIO client
    const endPoint =
        reqEnv("MINIO_ENDPOINT") ||
        reqEnv("MINIO_HOST") ||
        "sb-minio";

    const port = Number(reqEnv("MINIO_PORT", "9000"));

    const accessKey =
        reqEnv("MINIO_ACCESS_KEY") ||
        reqEnv("MINIO_ROOT_USER") ||
        "minioadmin";

    const secretKey =
        reqEnv("MINIO_SECRET_KEY") ||
        reqEnv("MINIO_ROOT_PASSWORD") ||
        "minioadmin";

    const useSSL = bool(reqEnv("MINIO_USE_SSL", "false"), false);

    const client = new Client({ endPoint, port, useSSL, accessKey, secretKey });

    return {
        client,
        endPoint,
        port,
        useSSL,
    };
}
