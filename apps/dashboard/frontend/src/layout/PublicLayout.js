import React from "react";
import { Outlet } from "react-router-dom";

export default function PublicLayout() {
    return (
        <div className="min-h-screen bg-neutral-50">
            <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
                <Outlet />
            </div>
        </div>
    );
}
