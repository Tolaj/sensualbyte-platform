// provisioner/src/secrets/sshKeys.js
import crypto from "node:crypto";
import { wrapErr } from "../utils/errors.js";

/**
 * Generates an ed25519 keypair.
 * Returns:
 * - publicKeyPem/privateKeyPem: for storage if needed
 * - publicKeyOpenSsh: for authorized_keys
 */
export function generateSshKeypair(comment = "sensualbyte") {
    try {
        const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

        const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
        const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });

        // Node can export OpenSSH public key with format 'ssh'
        // (supported in modern Node versions)
        let publicKeyOpenSsh;
        try {
            publicKeyOpenSsh = publicKey.export({ format: "ssh" }).toString();
            if (comment) publicKeyOpenSsh = `${publicKeyOpenSsh} ${comment}`.trim();
        } catch (_) {
            // fallback: keep PEM only
            publicKeyOpenSsh = null;
        }

        return { publicKeyPem, privateKeyPem, publicKeyOpenSsh };
    } catch (err) {
        throw wrapErr("generateSshKeypair failed", err);
    }
}
