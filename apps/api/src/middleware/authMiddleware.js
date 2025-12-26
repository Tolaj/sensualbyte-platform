const { verifyToken } = require("../lib/auth");

function requireAuth(allowedRoles = []) {
    return async (req, res, next) => {
        try {
            const header = req.headers.authorization || "";
            const token = header.startsWith("Bearer ") ? header.slice(7) : null;

            if (!token) return res.status(401).json({ error: "Missing token" });

            const payload = verifyToken(token);
            req.user = payload;

            if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
                return res.status(403).json({ error: "Forbidden" });
            }
            next();
        } catch (e) {
            return res.status(401).json({ error: "Invalid token" });
        }
    };
}

module.exports = { requireAuth };
