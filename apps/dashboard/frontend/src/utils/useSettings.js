// src/utils/useSettings.js
import React from "react";
import { getSettings, subscribeSettings } from "./storage";

export function useSettings() {
    const [s, setS] = React.useState(() => getSettings());

    React.useEffect(() => {
        setS(getSettings());
        return subscribeSettings((next) => setS(next));
    }, []);

    return s;
}
