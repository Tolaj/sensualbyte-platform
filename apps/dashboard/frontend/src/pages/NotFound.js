import React from "react";
import { Link } from "react-router-dom";

export default function NotFound() {
    return (
        <div className="min-h-screen bg-neutral-50 px-6 py-16">
            <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 shadow-soft ring-1 ring-black/5">
                <div className="text-lg font-semibold">Page not found</div>
                <div className="mt-2 text-sm text-neutral-500">
                    The page you’re looking for doesn’t exist.
                </div>
                <div className="mt-6">
                    <Link className="text-sm font-medium text-black underline" to="/app">
                        Go to app
                    </Link>
                </div>
            </div>
        </div>
    );
}
