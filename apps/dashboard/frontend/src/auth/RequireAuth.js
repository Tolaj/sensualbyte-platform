import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }) {
    const { status } = useAuth();
    if (status === "loading") return <div className="min-h-screen" />;
    if (status === "unauthenticated") return <Navigate to="/login" replace />;
    return children;
}
