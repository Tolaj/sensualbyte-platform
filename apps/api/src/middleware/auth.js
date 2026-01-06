// v1: simple header auth. Later: JWT/session.
export function requireAuth() {
    return (req, _res, next) => {
        req.userId = req.headers["x-user-id"] || "user_demo";
        next();
    };
}
