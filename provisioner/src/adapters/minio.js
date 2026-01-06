// provisioner/src/adapters/minio.js
import { Client } from "minio";
import { wrapErr } from "../utils/errors.js";

function bool(v) {
    return String(v).toLowerCase() === "true";
}

export function getMinio() {
    const endPoint = process.env.MINIO_ENDPOINT || "localhost";
    const port = Number(process.env.MINIO_PORT || 9000);
    const useSSL = bool(process.env.MINIO_USE_SSL || "false");
    const accessKey = process.env.MINIO_ACCESS_KEY || "minioadmin";
    const secretKey = process.env.MINIO_SECRET_KEY || "minioadmin";

    return new Client({ endPoint, port, useSSL, accessKey, secretKey });
}

async function bucketExistsSafe(minio, bucketName) {
    try {
        return await minio.bucketExists(bucketName);
    } catch (err) {
        throw wrapErr("MinIO bucketExists failed", err, { bucketName });
    }
}

export async function ensureBucket(minio, bucketName, opts = {}) {
    if (!minio) throw new Error("minio client required");
    if (!bucketName) throw new Error("bucketName required");

    const region = opts.region || process.env.MINIO_REGION || "us-east-1";

    const exists = await bucketExistsSafe(minio, bucketName);
    if (exists) return { bucketName, created: false };

    try {
        await minio.makeBucket(bucketName, region);
        return { bucketName, created: true, region };
    } catch (err) {
        throw wrapErr("Failed to create MinIO bucket", err, { bucketName, region });
    }
}

async function emptyBucket(minio, bucketName) {
    // MinIO client supports listObjectsV2 (stream)
    const objects = [];
    try {
        const stream = minio.listObjectsV2(bucketName, "", true);
        await new Promise((resolve, reject) => {
            stream.on("data", (obj) => objects.push(obj));
            stream.on("error", reject);
            stream.on("end", resolve);
        });
    } catch (err) {
        throw wrapErr("Failed to list objects for bucket emptying", err, { bucketName });
    }

    if (objects.length === 0) return { emptied: true, removedCount: 0 };

    // removeObjects needs object names
    const names = objects.map((o) => o.name).filter(Boolean);

    try {
        await minio.removeObjects(bucketName, names);
        return { emptied: true, removedCount: names.length };
    } catch (err) {
        throw wrapErr("Failed to remove objects while emptying bucket", err, { bucketName, removedCount: names.length });
    }
}

/**
 * deleteBucket:
 * - default v1: try removeBucket and surface errors
 * - optional: { forceEmpty:true } empties bucket then removes
 */
export async function deleteBucket(minio, bucketName, opts = {}) {
    if (!minio) throw new Error("minio client required");
    if (!bucketName) throw new Error("bucketName required");

    const forceEmpty = Boolean(opts.forceEmpty);

    if (forceEmpty) {
        await emptyBucket(minio, bucketName);
    }

    try {
        await minio.removeBucket(bucketName);
        return { removed: true };
    } catch (err) {
        const msg = err?.message || "";
        // bucket not found-ish cases
        if (/NoSuchBucket|not found/i.test(msg)) return { removed: false, reason: "not_found" };

        // bucket not empty (if user didn't forceEmpty)
        if (/not empty|BucketNotEmpty/i.test(msg)) {
            const e = wrapErr("Failed to remove bucket (not empty)", err, { bucketName });
            e.statusCode = 409;
            throw e;
        }

        throw wrapErr("Failed to remove MinIO bucket", err, { bucketName });
    }
}
