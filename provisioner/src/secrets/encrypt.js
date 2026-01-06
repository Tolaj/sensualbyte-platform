// provisioner/src/secrets/encrypt.js
import crypto from "node:crypto";
import { wrapErr } from "../utils/errors.js";

function key() {
    const hex = process.env.MASTER_KEY_HEX;
    if (!hex || hex.length < 64) {
        throw new Error("MASTER_KEY_HEX must be 32 bytes hex (64 chars)");
    }
    return Buffer.from(hex.slice(0, 64), "hex");
}

/**
 * NOTE:
 * Prefer packages/shared/crypto.js in API/worker.
 * Provisioner keeps this only as a utility.
 */
export function encryptString(plaintext) {
    try {
        const k = key();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
        const enc = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
        const tag = cipher.getAuthTag();

        return {
            ciphertext: enc.toString("base64"),
            encryptionMeta: {
                alg: "AES-256-GCM",
                keyId: "master",
                iv: iv.toString("base64"),
                tag: tag.toString("base64")
            }
        };
    } catch (err) {
        throw wrapErr("encryptString failed", err);
    }
}

export function decryptString(ciphertextB64, meta) {
    try {
        if (!ciphertextB64) throw new Error("ciphertext required");
        if (!meta?.iv || !meta?.tag) throw new Error("encryptionMeta.iv/tag required");

        const k = key();
        const iv = Buffer.from(meta.iv, "base64");
        const tag = Buffer.from(meta.tag, "base64");

        const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
        decipher.setAuthTag(tag);

        const dec = Buffer.concat([
            decipher.update(Buffer.from(ciphertextB64, "base64")),
            decipher.final()
        ]);

        return dec.toString("utf8");
    } catch (err) {
        throw wrapErr("decryptString failed", err, { keyId: meta?.keyId || null, alg: meta?.alg || null });
    }
}
