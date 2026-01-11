// apps/api/src/utils/crypto.js
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function b64(buf) {
  return Buffer.from(buf).toString("base64");
}

function unb64(s) {
  return Buffer.from(String(s), "base64");
}

function requireKey() {
  const keyB64 = process.env.SECRETS_ENCRYPTION_KEY || "";
  const nodeEnv = process.env.NODE_ENV || "development";

  if (!keyB64) {
    if (nodeEnv === "production") {
      throw new Error("SECRETS_ENCRYPTION_KEY is required in production (base64 32 bytes)");
    }
    // Dev default: deterministic-ish key derived from a constant. Better than plaintext, not secure.
    return Buffer.from("dev_dev_dev_dev_dev_dev_dev_dev_32bytes!", "utf8").subarray(0, 32);
  }

  const key = unb64(keyB64);
  if (key.length !== 32) {
    throw new Error("SECRETS_ENCRYPTION_KEY must decode to 32 bytes (AES-256-GCM)");
  }
  return key;
}

export function encryptString(plaintext) {
  const key = requireKey();
  const iv = randomBytes(12); // recommended for GCM
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const pt = Buffer.from(String(plaintext ?? ""), "utf8");

  const ciphertext = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();

  const keyId = process.env.SECRETS_KEY_ID || "master";

  return {
    ciphertext: b64(ciphertext),
    encryptionMeta: {
      alg: "aes-256-gcm",
      iv: b64(iv),
      tag: b64(tag),
      keyId,
      v: 1
    }
  };
}

export function decryptString(ciphertextB64, encryptionMeta) {
  if (!encryptionMeta || typeof encryptionMeta !== "object") {
    throw new Error("decryptString: encryptionMeta required");
  }
  if (encryptionMeta.alg !== "aes-256-gcm") {
    throw new Error(`decryptString: unsupported alg ${encryptionMeta.alg}`);
  }

  const key = requireKey();
  const iv = unb64(encryptionMeta.iv);
  const tag = unb64(encryptionMeta.tag);
  const ct = unb64(ciphertextB64);

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}
