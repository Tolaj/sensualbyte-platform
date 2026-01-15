// src/workspace/RequireWorkspace.js
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getSettings } from "../utils/storage";

export default function RequireWorkspace() {
    const loc = useLocation();
    const s = getSettings();

    // allow bootstrap route without a selected workspace
    if (loc.pathname.startsWith("/app/workspace")) return <Outlet />;

    if (!s.teamId || !s.projectId) {
        return <Navigate to="/app/workspace" replace />;
    }

    return <Outlet />;
}
