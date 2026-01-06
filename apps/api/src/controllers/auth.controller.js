// v1 stub: header-based auth; these endpoints exist to keep structure stable.
export function authController() {
    return {
        me: async (req, res) => {
            res.json({
                userId: req.userId || "user_demo"
            });
        }
    };
}
