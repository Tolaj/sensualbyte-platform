import { randomUUID } from "node:crypto";

export function requestId() {
    return (req, res, next) => {
        const incoming = req.headers["x-request-id"];
        const rid =
            typeof incoming === "string" && incoming.trim()
                ? incoming.trim()
                : randomUUID();

        req.requestId = rid;
        res.setHeader("x-request-id", rid);
        next();
    };
}
