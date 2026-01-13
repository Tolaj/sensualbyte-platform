// src/components/JsonView.js
import React from "react";
import { safeStringify } from "../utils/format";

export default function JsonView({ value }) {
    return <pre style={{ margin: 0 }}>{safeStringify(value)}</pre>;
}
