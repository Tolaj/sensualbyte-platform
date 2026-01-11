// apps/api/src/middleware/error.js
export function errorHandler() {
    return (err, req, res, next) => {
        // If something already wrote the response, let Express handle it.
        if (res.headersSent) return next(err);

        const raw = Number(err?.statusCode || err?.status || 500);
        const status = raw >= 400 && raw <= 599 ? raw : 500;

        const requestId = req?.requestId || req?.headers?.["x-request-id"] || null;
        const isProd = (process.env.NODE_ENV || "development") === "production";

        const payload = {
            error: true,
            message: err?.message || "Internal Server Error",
            requestId
        };

        if (err?.code) payload.code = err.code;

        // Avoid leaking sensitive implementation details in prod
        if (!isProd && err?.details) payload.details = err.details;
        if (!isProd && err?.stack) payload.stack = err.stack;

        if (status >= 500) {
            console.error("API 5xx error", {
                requestId,
                status,
                message: err?.message,
                code: err?.code,
                details: err?.details,
                stack: err?.stack
            });
        } else {
            console.warn("API 4xx error", {
                requestId,
                status,
                message: err?.message,
                code: err?.code,
                details: err?.details
            });
        }

        res.status(status).json(payload);
    };
}
