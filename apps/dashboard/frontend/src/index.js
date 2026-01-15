// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import App from "./app";
import { AuthProvider } from "./auth/AuthProvider";
import { ToastHost } from "./ui/toast";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <BrowserRouter>
            <AuthProvider>
                <ToastHost />
                <App />
            </AuthProvider>
        </BrowserRouter>
    </React.StrictMode>
);
