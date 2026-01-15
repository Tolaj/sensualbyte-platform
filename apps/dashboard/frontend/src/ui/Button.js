// src/ui/Button.js
import React from "react";
import clsx from "clsx";

export default function Button({
    variant = "primary",
    size = "md",
    className,
    ...props
}) {
    const base =
        "inline-flex items-center justify-center rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
        primary: "bg-black text-white hover:bg-black/90",
        secondary: "border border-black/10 bg-white text-neutral-900 hover:bg-neutral-50",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "text-neutral-700 hover:bg-neutral-100",
    };

    const sizes = {
        sm: "h-9 px-3 text-sm",
        md: "h-10 px-4 text-sm",
    };

    return (
        <button
            className={clsx(base, variants[variant], sizes[size], className)}
            {...props}
        />
    );
}
