import React from "react";
import clsx from "clsx";

export function Card({ className, children }) {
    return (
        <div className={clsx("rounded-2xl border border-black/5 bg-white shadow-soft", className)}>
            {children}
        </div>
    );
}

export function CardHeader({ title, subtitle, right }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-black/5 p-5">
            <div>
                <div className="text-sm font-semibold text-neutral-900">{title}</div>
                {subtitle ? <div className="mt-1 text-sm text-neutral-500">{subtitle}</div> : null}
            </div>
            {right ? <div className="shrink-0">{right}</div> : null}
        </div>
    );
}

export function CardBody({ className, children }) {
    return <div className={clsx("p-5", className)}>{children}</div>;
}
