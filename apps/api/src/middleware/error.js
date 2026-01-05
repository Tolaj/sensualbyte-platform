export function errorHandler() {
    return (err, req, res, _next) => {
        console.error("API error", {
            requestId: req.requestId,
            message: err.message,
            stack: err.stack
        });

        const status = err.statusCode || 500;
        res.status(status).json({
            error: true,
            message: err.message || "Internal Server Error",
            requestId: req.requestId
        });
    };
}
