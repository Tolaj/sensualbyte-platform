// src/app.js
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "./layout/PublicLayout";
import AppLayout from "./layout/AppLayout";
import RequireAuth from "./auth/RequireAuth";
import RequireWorkspace from "./workspace/RequireWorkspace";

import LoginPage from "./pages/auth/LoginPage";
import SignupPage from "./pages/auth/SignupPage";
import OverviewPage from "./pages/OverviewPage";

import ComputeListPage from "./pages/compute/ComputeListPage";
import ComputeDetailPage from "./pages/compute/ComputeDetailPage";
import BucketsListPage from "./pages/buckets/BucketsListPage";
import BucketDetailPage from "./pages/buckets/BucketDetailPage";
import WorkspaceBootstrap from "./workspace/WorkspaceBootstrap";

import AdminUsersPage from "./pages/admin/AdminUsersPage";
import IamRolesPage from "./pages/admin/IamRolesPage";
import IamBindingsPage from "./pages/admin/IamBindingsPage";
import SecretsPage from "./pages/secrets/SecretsPage";
import CatalogPage from "./pages/catalog/CatalogPage";
import ObservabilityPage from "./pages/observability/ObservabilityPage";


import NotFound from "./pages/NotFound";

export default function App() {
    return (
        <Routes>
            <Route element={<PublicLayout />}>
                <Route path="/" element={<Navigate to="/app/overview" replace />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
            </Route>

            <Route
                path="/app"
                element={
                    <RequireAuth>
                        <AppLayout />
                    </RequireAuth>
                }
            >
                <Route index element={<Navigate to="overview" replace />} />

                {/* Workspace bootstrap is allowed even when no project is selected */}
                <Route path="workspace" element={<WorkspaceBootstrap />} />

                {/* Everything else requires teamId + projectId */}
                <Route element={<RequireWorkspace />}>
                    <Route path="overview" element={<OverviewPage />} />
                    <Route path="compute" element={<ComputeListPage />} />
                    <Route path="compute/:resourceId" element={<ComputeDetailPage />} />
                    <Route path="buckets" element={<BucketsListPage />} />
                    <Route path="buckets/:resourceId" element={<BucketDetailPage />} />

                    <Route path="secrets" element={<SecretsPage />} />
                    <Route path="catalog" element={<CatalogPage />} />
                    <Route path="observability" element={<ObservabilityPage />} />

                    <Route path="admin/users" element={<AdminUsersPage />} />
                    <Route path="admin/iam/roles" element={<IamRolesPage />} />
                    <Route path="admin/iam/bindings" element={<IamBindingsPage />} />

                </Route>
            </Route>

            <Route path="*" element={<NotFound />} />
        </Routes>
    );
}
