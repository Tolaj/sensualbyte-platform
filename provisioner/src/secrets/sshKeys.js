import crypto from "node:crypto";

export function generateSshKeypair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519", {});
    return {
        publicKey: publicKey.export({ type: "spki", format: "pem" }),
        privateKey: privateKey.export({ type: "pkcs8", format: "pem" })
    };
}
