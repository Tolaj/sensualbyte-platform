import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { Field, Input } from "../components/Field";
import { api } from "../api";

export default function Login({ pushToast, navigate }) {
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    async function submit() {
        try {
            setLoading(true);
            const out = await api.authLogin({ email, password });
            pushToast?.({ type: "ok", title: "Signed in", message: out?.user?.userId || "OK" });
            navigate?.("/"); // or /identity
        } catch (e) {
            pushToast?.({ type: "danger", title: "Login failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
            <Card title="Sign in">
                <div className="muted">Use your email + password to get a JWT session.</div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                    <Field label="Email">
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                    </Field>

                    <Field label="Password">
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </Field>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button onClick={submit} disabled={loading || !email || !password}>Sign in</Button>
                        <Button variant="secondary" onClick={() => navigate?.("/signup")} disabled={loading}>
                            Create account
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
