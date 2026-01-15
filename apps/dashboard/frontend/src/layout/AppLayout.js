import React from "react";
import { Outlet } from "react-router-dom";
import Topbar from "../ui/Topbar";
import Sidebar from "../ui/Sidebar";

export default function AppLayout() {
    return (
        <div className="min-h-screen bg-neutral-50">
            <Topbar />
            <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
                <Sidebar />
                <main className="min-w-0 flex-1">
                    <div className="rounded-2xl bg-white shadow-soft ring-1 ring-black/5">
                        <div className="p-6">
                            <Outlet />
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
