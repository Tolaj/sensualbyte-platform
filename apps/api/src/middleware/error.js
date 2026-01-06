export function errorHandler() {
    return (err, req, res, _next) => {
        const status = Number(err.statusCode || err.status || 500);

        const payload = {
            error: true,
            message: err.message || "Internal Server Error",
            requestId: req.requestId
        };

        if (err.code) payload.code = err.code;
        if (err.details) payload.details = err.details;

        if (status >= 500) {
            console.error("API 5xx error", {
                requestId: req.requestId,
                message: err.message,
                code: err.code,
                stack: err.stack
            });
        } else {
            console.warn("API 4xx error", {
                requestId: req.requestId,
                message: err.message,
                code: err.code
            });
        }

        res.status(status).json(payload);
    };
}
