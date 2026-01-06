export async function httpJson(baseUrl, path, { method = "GET", headers = {}, body } = {}) {
    const res = await fetch(baseUrl + path, {
        method,
        headers: {
            "content-type": "application/json",
            "x-user-id": "user_demo",
            ...headers
        },
        body: body === undefined ? undefined : JSON.stringify(body)
    });

    const text = await res.text();
    let json = null;
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        // ignore
    }

    return { status: res.status, ok: res.ok, json, text };
}
