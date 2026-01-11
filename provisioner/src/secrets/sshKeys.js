// provisioner/src/secrets/sshKeys.js
import crypto from "node:crypto";
import { wrapErr } from "../utils/errors.js";

function b64urlToBuf(s) {
    // JWK base64url -> Buffer
    const str = String(s);
    const b64 =
        str.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((str.length + 3) % 4);
    return Buffer.from(b64, "base64");
}

function u32(n) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(n >>> 0, 0);
    return b;
}

function sshString(str) {
    const b = Buffer.from(String(str), "utf8");
    return Buffer.concat([u32(b.length), b]);
}

function sshMpint(buf) {
    let b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
    // trim leading zeros
    while (b.length > 0 && b[0] === 0x00) b = b.slice(1);
    if (b.length === 0) b = Buffer.from([0x00]);
    // ensure positive mpint
    if (b[0] & 0x80) b = Buffer.concat([Buffer.from([0x00]), b]);
    return Buffer.concat([u32(b.length), b]);
}

/**
 * Node-only keypair that OpenSSH can load via `ssh -i`.
 *
 * - privateKeyPem: PKCS#1 RSA => "-----BEGIN RSA PRIVATE KEY-----"
 * - publicKeyOpenSsh: "ssh-rsa AAAA... comment"
 */
export function generateSshKeypair(comment = "sensualbyte") {
    try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
            modulusLength: 3072,
            publicExponent: 0x10001
        });

        const privateKeyPem = privateKey.export({ type: "pkcs1", format: "pem" });

        // Build ssh-rsa pubkey from JWK (n,e)
        const jwk = publicKey.export({ format: "jwk" });
        const n = b64urlToBuf(jwk.n);
        const e = b64urlToBuf(jwk.e);

        const algo = "ssh-rsa";
        const blob = Buffer.concat([sshString(algo), sshMpint(e), sshMpint(n)]);
        const publicKeyOpenSsh = `${algo} ${blob.toString("base64")}${comment ? ` ${comment}` : ""}`.trim();

        return { publicKeyOpenSsh, privateKeyPem };
    } catch (err) {
        throw wrapErr("generateSshKeypair failed", err);
    }
}
