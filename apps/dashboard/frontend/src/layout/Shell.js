// src/layout/Shell.js
import React from "react";
import "./Shell.css";
import { getSettings, setSettings, resetSettings } from "../utils/storage";
import Modal from "../components/Modal";
import Button from "../components/Button";
import ToastHost, { useToasts } from "../components/Toast";

function NavItem({ href, label, active }) {
    return (
        <a className={`sb-nav-item ${active ? "active" : ""}`} href={href}>
            <span className="sb-nav-dot" />
            <span>{label}</span>
        </a>
    );
}

export default function Shell({ route, children }) {
    const { toasts, pushToast, removeToast } = useToasts();
    const [settingsOpen, setSettingsOpen] = React.useState(false);
    const [settings, setSettingsState] = React.useState(() => getSettings());

    React.useEffect(() => {
        window.__sbToast = pushToast;
        return () => { delete window.__sbToast; };
    }, [pushToast]);

    function saveSettings() {
        setSettings(settings);
        pushToast({ type: "ok", title: "Saved", message: "Settings updated." });
        setSettingsOpen(false);
        window.location.reload();
    }

    function doReset() {
        resetSettings();
        pushToast({ type: "warn", title: "Reset", message: "Settings reset to defaults." });
        setSettingsOpen(false);
        window.location.reload();
    }

    return (
        <div className="sb-shell">
            <div className="sb-sidebar">
                <div className="sb-brand">
                    <div className="sb-logo">SB</div>
                    <div>
                        <div className="sb-title">Sensualbyte</div>
                        <div className="sb-sub">Platform v1</div>
                    </div>
                </div>

                <div className="sb-nav">
                    <NavItem href="#/" label="Home" active={route === "/"} />
                    <NavItem href="#/identity" label="Identity" active={route.startsWith("/identity")} />
                    <NavItem href="#/projects" label="Projects" active={route.startsWith("/projects")} />
                    <NavItem href="#/compute" label="Compute" active={route.startsWith("/compute")} />
                    <NavItem href="#/buckets" label="Buckets" active={route.startsWith("/buckets")} />
                    <NavItem href="#/resources" label="All Resources" active={route.startsWith("/resources")} />
                    <NavItem href="#/secrets" label="Secrets" active={route.startsWith("/secrets")} />
                    <NavItem href="#/explorer" label="API Explorer" active={route.startsWith("/explorer")} />
                </div>

                <div className="sb-sidebar-footer">
                    <div className="sb-kv">
                        <div className="muted small">API Base</div>
                        <div className="sb-mono">{settings.apiBase}</div>
                    </div>
                    <div className="sb-kv">
                        <div className="muted small">User</div>
                        <div className="sb-mono">{settings.userId}</div>
                    </div>

                    <div className="sb-actions">
                        <Button onClick={() => setSettingsOpen(true)} variant="secondary">Settings</Button>
                    </div>

                    <div className="sb-hint">
                        Use hash routes like <span className="sb-mono">#/compute</span>
                    </div>
                </div>
            </div>

            <div className="sb-main">
                <div className="sb-topbar">
                    <div className="sb-topbar-left">
                        <div className="sb-breadcrumb">{route}</div>
                    </div>
                    <div className="sb-topbar-right">
                        <a className="sb-pill" href="https://localhost" onClick={(e) => e.preventDefault()}>
                            v1
                        </a>
                    </div>
                </div>

                <div className="sb-content">
                    {React.cloneElement(children, { pushToast })}
                </div>
            </div>

            <ToastHost toasts={toasts} onClose={removeToast} />

            <Modal
                open={settingsOpen}
                title="Dashboard Settings"
                onClose={() => setSettingsOpen(false)}
                footer={
                    <div style={{ display: "flex", gap: 8, justifyContent: "space-between", width: "100%" }}>
                        <Button onClick={doReset} variant="danger">Reset</Button>
                        <div style={{ display: "flex", gap: 8 }}>
                            <Button onClick={() => setSettingsOpen(false)} variant="secondary">Cancel</Button>
                            <Button onClick={saveSettings}>Save</Button>
                        </div>
                    </div>
                }
            >
                <div className="sb-form">
                    <label className="sb-label">API Base (through nginx)</label>
                    <input
                        className="sb-input"
                        value={settings.apiBase}
                        onChange={(e) => setSettingsState({ ...settings, apiBase: e.target.value })}
                        placeholder="/api"
                    />
                    <div className="small muted">
                        For your setup use <span className="sb-mono">/api</span>.
                    </div>

                    <div style={{ height: 12 }} />

                    <label className="sb-label">x-user-id</label>
                    <input
                        className="sb-input"
                        value={settings.userId}
                        onChange={(e) => setSettingsState({ ...settings, userId: e.target.value })}
                        placeholder="user_superadmin"
                    />
                    <div className="small muted">
                        Must exist in Mongo seed, e.g. <span className="sb-mono">user_superadmin</span>.
                    </div>
                </div>
            </Modal>
        </div>
    );
}
