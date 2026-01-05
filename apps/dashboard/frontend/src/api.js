
export function getToken() {
    return localStorage.getItem("token");
}

export async function apiFetch(path, options = {}) {
    const token = getToken();

    const res = await fetch(`${process.env.REACT_APP_API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    });

    if (res.status === 401) {
        localStorage.removeItem("token");
        window.location.reload();
    }


    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
}

export function getUserRole() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role;
}


export function getRole() {
    const t = localStorage.getItem("token");
    if (!t) return null;
    return JSON.parse(atob(t.split(".")[1])).role;
}

export async function api(path, options = {}) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${process.env.REACT_APP_API_BASE}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
    });

    if (res.status === 401) {
        localStorage.clear();
        window.location.reload();
    }

    return res.json();
}


