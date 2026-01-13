// src/App.js
import React from "react";
import Shell from "./layout/Shell";

import Home from "./pages/Home";
import Identity from "./pages/Identity";
import Projects from "./pages/Projects";
import Resources from "./pages/Resources";
import Secrets from "./pages/Secrets";
import Explorer from "./pages/Explorer";

import ComputeList from "./pages/ComputeList";
import ComputeDetail from "./pages/ComputeDetail";
import BucketsList from "./pages/BucketsList";
import BucketDetail from "./pages/BucketDetail";

function useHashRoute() {
    const [route, setRoute] = React.useState(() => window.location.hash.replace(/^#/, "") || "/");
    React.useEffect(() => {
        const onHash = () => setRoute(window.location.hash.replace(/^#/, "") || "/");
        window.addEventListener("hashchange", onHash);
        return () => window.removeEventListener("hashchange", onHash);
    }, []);
    return route;
}

// tiny router: supports patterns like "/compute/:resourceId"
function matchRoute(route, pattern) {
    const clean = String(route || "/").split("?")[0];
    const rSeg = clean.split("/").filter(Boolean);
    const pSeg = pattern.split("/").filter(Boolean);
    if (rSeg.length !== pSeg.length) return null;
    const params = {};
    for (let i = 0; i < pSeg.length; i++) {
        const p = pSeg[i];
        const r = rSeg[i];
        if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(r);
        else if (p !== r) return null;
    }
    return params;
}

export default function App() {
    const route = useHashRoute();

    const navigate = (to) => {
        const next = to.startsWith("#") ? to : `#${to.startsWith("/") ? to : `/${to}`}`;
        window.location.hash = next;
    };

    let page = <Home />;

    // detail routes first
    const computeParams = matchRoute(route, "/compute/:resourceId");
    const bucketParams = matchRoute(route, "/buckets/:resourceId");

    if (computeParams) page = <ComputeDetail params={computeParams} navigate={navigate} />;
    else if (bucketParams) page = <BucketDetail params={bucketParams} navigate={navigate} />;
    else if (route === "/compute") page = <ComputeList navigate={navigate} />;
    else if (route === "/buckets") page = <BucketsList navigate={navigate} />;
    else if (route.startsWith("/identity")) page = <Identity />;
    else if (route.startsWith("/projects")) page = <Projects />;
    else if (route.startsWith("/resources")) page = <Resources />;
    else if (route.startsWith("/secrets")) page = <Secrets />;
    else if (route.startsWith("/explorer")) page = <Explorer />;

    return <Shell route={route}>{page}</Shell>;
}
