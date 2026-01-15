import React from "react";
import clsx from "clsx";

export default function Input({ className, ...props }) {
    return (
        <input
            className={clsx(
                "h-10 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none ring-0 transition",
                "focus:border-neutral-300 focus:ring-4 focus:ring-black/5",
                className
            )}
            {...props}
        />
    );
}
