// src/layout/AuthLayout.js
import React from "react";
import "./layout.css";

export default function AuthLayout({ children }) {
    return (
        <div className="sb-auth">
            <div className="sb-auth__bg" />
            <div className="sb-auth__wrap">
                <div className="sb-auth__brand">
                    <div className="sb-logo" aria-hidden="true" />
                    <div>
                        <div className="sb-brand__name">sensualbyte</div>
                        <div className="sb-brand__tag">Control plane for your homelab cloud.</div>
                    </div>
                </div>
                <div className="sb-auth__card">{children}</div>
                <div className="sb-auth__foot">© {new Date().getFullYear()} sensualbyte</div>
            </div>
        </div>
    );
}
