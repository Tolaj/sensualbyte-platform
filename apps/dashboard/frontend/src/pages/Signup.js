import React from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { Field, Input } from "../components/Field";
import { api } from "../api";

export default function Signup({ pushToast, navigate }) {
    const [name, setName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    async function submit() {
        try {
            setLoading(true);
            const out = await api.authRegister({ name, email, password });
            pushToast?.({ type: "ok", title: "Account created", message: out?.user?.userId || "OK" });
            navigate?.("/"); // logged in immediately
        } catch (e) {
            pushToast?.({ type: "danger", title: "Signup failed", message: e.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <div style={{ display: "grid", gap: 14, maxWidth: 680 }}>
            <Card title="Create account">
                <div className="muted">Signup is open. You’ll be signed in immediately after registration.</div>

                <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                    <Field label="Name">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Swapnil" />
                    </Field>

                    <Field label="Email">
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
                    </Field>

                    <Field label="Password">
                        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                    </Field>

                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <Button onClick={submit} disabled={loading || !name || !email || !password}>Create account</Button>
                        <Button variant="secondary" onClick={() => navigate?.("/login")} disabled={loading}>
                            Back to sign in
                        </Button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
