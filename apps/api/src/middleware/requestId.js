// apps/api/src/middleware/requestId.js
import { randomUUID } from "node:crypto";

function readHeader(req, name) {
    const v = req.headers?.[name];
    if (typeof v === "string") return v;
    if (Array.isArray(v) && typeof v[0] === "string") return v[0];
    return "";
}

export function requestId() {
    return (req, res, next) => {
        const incoming = readHeader(req, "x-request-id").trim();

        // basic sanity: prevent huge header abuse
        const rid = incoming && incoming.length <= 120 ? incoming : randomUUID();

        req.requestId = rid;
        res.setHeader("x-request-id", rid);
        next();
    };
}
