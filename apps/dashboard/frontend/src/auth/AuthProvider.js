// src/auth/AuthProvider.js
import React from "react";
import { api } from "../api";
import { getSettings, setSettings, subscribeSettings } from "../utils/storage";

const AuthCtx = React.createContext(null);

export function useAuth() {
    const v = React.useContext(AuthCtx);
    if (!v) throw new Error("useAuth must be used within AuthProvider");
    return v;
}

export function AuthProvider({ children }) {
    const [status, setStatus] = React.useState("loading"); // loading | authenticated | unauthenticated
    const [me, setMe] = React.useState(null);

    const refreshMe = React.useCallback(async () => {
        const s = getSettings();
        const token = String(s.token || "").trim();
        if (!token) {
            setMe(null);
            setStatus("unauthenticated");
            return;
        }

        try {
            const out = await api.authMe();
            setMe(out?.user || null);
            setStatus("authenticated");
        } catch {
            const s2 = getSettings();
            setSettings({ ...s2, token: "" });
            setMe(null);
            setStatus("unauthenticated");
        }
    }, []);

    React.useEffect(() => {
        refreshMe();
    }, [refreshMe]);

    // react to token changes (same-tab + other tabs)
    React.useEffect(() => {
        let last = String(getSettings().token || "");
        return subscribeSettings(() => {
            const next = String(getSettings().token || "");
            if (next !== last) {
                last = next;
                refreshMe();
            }
        });
    }, [refreshMe]);

    const login = React.useCallback(
        async ({ email, password }) => {
            const out = await api.authLogin({ email, password }); // stores token internally
            await refreshMe();
            return out;
        },
        [refreshMe]
    );

    const logout = React.useCallback(() => {
        const s = getSettings();
        setSettings({ ...s, token: "" });
        setMe(null);
        setStatus("unauthenticated");
    }, []);

    const value = React.useMemo(() => ({ status, me, login, logout, refreshMe }), [status, me, login, logout, refreshMe]);

    return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
