// apps/api/src/services/auth.service.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { newId } from "../utils/ids.js";

function httpError(statusCode, message, details = null) {
    const e = new Error(message);
    e.statusCode = statusCode;
    if (details) e.details = details;
    return e;
}
const badRequest = (m, d) => httpError(400, m, d);
const unauthorized = (m = "Unauthorized") => httpError(401, m);

function norm(v, field) {
    const s = String(v ?? "").trim();
    if (!s) throw badRequest(`${field} required`);
    return s;
}

function getEnv(name, fallback = "") {
    const v = process.env[name];
    return (v == null ? fallback : String(v)).trim();
}

export function authService(db) {
    const users = db.collection("users");

    async function findByEmail(email) {
        return users.findOne({ email: String(email).toLowerCase().trim() });
    }

    function signToken(user) {
        const secret = getEnv("JWT_SECRET");
        if (!secret) throw httpError(500, "JWT_SECRET not set");

        const ttl = Number(getEnv("JWT_TTL_SECONDS", "86400")) || 86400;
        const token = jwt.sign(
            { userId: user.userId },
            secret,
            { expiresIn: ttl }
        );
        return { token, expiresIn: ttl };
    }

    return {
        async register({ email, password, name }) {
            const em = norm(email, "email").toLowerCase();
            const pw = norm(password, "password");
            const nm = norm(name, "name");

            const exists = await findByEmail(em);
            if (exists) throw badRequest("Email already registered");

            // ✅ match your ID conventions (you already use newId in other places)
            const userId = newId("user");

            const passwordHash = await bcrypt.hash(pw, 10);

            const doc = {
                userId,
                email: em,
                name: nm,
                username: null,
                passwordHash,
                active: true,
                globalRole: "user", // NOT super_admin by default
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            await users.insertOne(doc);
            const { token, expiresIn } = signToken(doc);

            return {
                user: {
                    userId: doc.userId,
                    email: doc.email,
                    name: doc.name,
                    username: doc.username,
                    active: doc.active,
                    globalRole: doc.globalRole,
                },
                token,
                expiresIn,
            };
        },

        async login({ email, password }) {
            const em = norm(email, "email").toLowerCase();
            const pw = norm(password, "password");

            const u = await findByEmail(em);
            if (!u) throw unauthorized("Invalid email or password");
            if (u.active !== true) throw httpError(403, "Forbidden: user disabled");

            const ok = await bcrypt.compare(pw, String(u.passwordHash || ""));
            if (!ok) throw unauthorized("Invalid email or password");

            const { token, expiresIn } = signToken(u);

            return {
                user: {
                    userId: u.userId,
                    email: u.email,
                    name: u.name ?? null,
                    username: u.username ?? null,
                    active: u.active === true,
                    globalRole: u.globalRole,
                },
                token,
                expiresIn,
            };
        },
    };
}
