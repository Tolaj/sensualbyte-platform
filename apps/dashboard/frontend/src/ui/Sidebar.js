// src/ui/Sidebar.js
import React from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import {
    LayoutGrid,
    Server,
    Database,
    KeyRound,
    Library,
    Activity,
    Shield,
    Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthProvider";

function Item({ to, icon: Icon, children }) {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                clsx(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                    isActive ? "bg-black text-white" : "text-neutral-700 hover:bg-neutral-100"
                )
            }
        >
            <Icon size={16} />
            <span>{children}</span>
        </NavLink>
    );
}

export default function Sidebar() {
    const { me } = useAuth();
    const isSuperAdmin = me?.globalRole === "super_admin";

    return (
        <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-20 space-y-6">
                <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Workspace
                    </div>
                    <div className="space-y-1">
                        <Item to="/app/overview" icon={LayoutGrid}>
                            Overview
                        </Item>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Resources
                    </div>
                    <div className="space-y-1">
                        <Item to="/app/compute" icon={Server}>
                            Compute
                        </Item>
                        <Item to="/app/buckets" icon={Database}>
                            Buckets
                        </Item>
                        <Item to="/app/secrets" icon={KeyRound}>
                            Secrets
                        </Item>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        Platform
                    </div>
                    <div className="space-y-1">
                        <Item to="/app/catalog" icon={Library}>
                            Catalog
                        </Item>
                        <Item to="/app/observability" icon={Activity}>
                            Observability
                        </Item>
                    </div>
                </div>

                {isSuperAdmin ? (
                    <div className="space-y-2">
                        <div className="px-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                            Admin
                        </div>
                        <div className="space-y-1">
                            <Item to="/app/admin/users" icon={Users}>
                                Users
                            </Item>
                            <Item to="/app/admin/iam/roles" icon={Shield}>
                                IAM Roles
                            </Item>
                            <Item to="/app/admin/iam/bindings" icon={Shield}>
                                IAM Bindings
                            </Item>
                        </div>
                    </div>
                ) : null}
            </div>
        </aside>
    );
}
