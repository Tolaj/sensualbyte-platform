// src/ui/Topbar.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../auth/AuthProvider";
import { useSettings } from "../utils/useSettings";
import WorkspaceSwitcher from "./WorkspaceSwitcher";

function MiniButton({ children, onClick, className }) {
    return (
        <button
            onClick={onClick}
            className={clsx(
                "inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium",
                "bg-neutral-100 text-neutral-900 hover:bg-neutral-200",
                className
            )}
        >
            {children}
        </button>
    );
}

export default function Topbar() {
    const { me, logout } = useAuth();
    const s = useSettings();
    const nav = useNavigate();

    return (
        <header className="sticky top-0 z-30 border-b border-black/5 bg-white/80 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black text-white text-sm font-semibold">
                        SB
                    </div>
                    <div>
                        <div className="text-sm font-semibold leading-4">Sensualbyte</div>
                        <div className="text-xs text-neutral-500">Dashboard</div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <WorkspaceSwitcher />

                    <MiniButton
                        onClick={() => {
                            logout();
                            nav("/login", { replace: true });
                        }}
                        className="gap-2"
                    >
                        <LogOut size={16} />
                        <span className="hidden sm:inline">Logout</span>
                    </MiniButton>

                    <div className="hidden text-sm text-neutral-600 md:block">
                        {me?.email || me?.userId || s.userId || ""}
                    </div>
                </div>
            </div>
        </header>
    );
}
