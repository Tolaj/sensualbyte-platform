// v1: header auth. Later: JWT/session.
export function requireAuth() {
    return (req, _res, next) => {
        const header = req.headers["x-user-id"];
        const userId =
            typeof header === "string" && header.trim()
                ? header.trim()
                : "user_demo";

        req.userId = userId;
        next();
    };
}
