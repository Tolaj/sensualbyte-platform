import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";

export default function LoginPage() {
    const { login } = useAuth();
    const nav = useNavigate();

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
                <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                <p className="mt-2 text-sm text-neutral-500">
                    Manage Compute and Buckets in your workspace.
                </p>
            </div>

            <div className="rounded-2xl border border-black/5 bg-white shadow-soft">
                <div className="border-b border-black/5 p-5">
                    <div className="text-sm font-semibold">Welcome back</div>
                    <div className="mt-1 text-sm text-neutral-500">Use your platform credentials.</div>
                </div>

                <div className="p-5 space-y-4">
                    {error ? (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-neutral-700">Email</label>
                        <input
                            className="h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-neutral-300 focus:ring-4 focus:ring-black/5"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
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
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        className="h-10 w-full rounded-xl bg-black px-4 text-sm font-medium text-white hover:bg-black/90 disabled:opacity-60"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            setError("");
                            try {
                                await login({ email, password });
                                nav("/app", { replace: true });
                            } catch (e) {
                                setError(e?.message || "Login failed");
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </div>
            </div>
        </div>
    );
}
