import { Client } from "minio";

function bool(v) { return String(v).toLowerCase() === "true"; }

export function getMinio() {
    return new Client({
        endPoint: process.env.MINIO_ENDPOINT || "localhost",
        port: Number(process.env.MINIO_PORT || 9000),
        useSSL: bool(process.env.MINIO_USE_SSL || "false"),
        accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: process.env.MINIO_SECRET_KEY || "minioadmin"
    });
}

export async function ensureBucket(minio, bucketName) {
    const exists = await minio.bucketExists(bucketName).catch(() => false);
    if (!exists) await minio.makeBucket(bucketName);
    return { bucketName };
}

export async function deleteBucket(minio, bucketName) {
    // v1: keep simple (require empty bucket or ignore failure)
    try { await minio.removeBucket(bucketName); return { removed: true }; }
    catch (_) { return { removed: false }; }
}
