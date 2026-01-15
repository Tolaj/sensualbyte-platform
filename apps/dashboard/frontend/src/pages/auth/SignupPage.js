// src/pages/auth/SignupPage.js
import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../api";

export default function SignupPage() {
    const nav = useNavigate();

    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");

    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState("");

    return (
        <div className="w-full max-w-md">
            <div className="mb-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-black text-white font-semibold">
                    SB
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
                <p className="mt-2 text-sm text-neutral-500">
                    Create your platform account to set up a workspace.
                </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 p-5">
                    <div className="text-sm font-semibold">Get started</div>
                    <div className="mt-1 text-sm text-neutral-500">Create a team + project next.</div>
                </div>

                <div className="p-5 space-y-4">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Name</label>
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-4 focus:ring-black/5"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoComplete="name"
                            placeholder="Swapage"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Email</label>
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-4 focus:ring-black/5"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            placeholder="you@company.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Password</label>
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-4 focus:ring-black/5"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            autoComplete="new-password"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        className="h-10 w-full rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                        disabled={busy || !email || !password}
                        onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                                await api.authRegister({ name, email, password });
                                // token is stored by api.authRegister()
                                nav("/app/workspace", { replace: true });
                            } catch (e) {
                                setError(e?.message || "Sign up failed");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {busy ? "Creating…" : "Create account"}
                    </button>

                    <div className="text-sm text-neutral-600">
                        Already have an account?{" "}
                        <Link className="text-neutral-900 underline underline-offset-4" to="/login">
                            Sign in
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
