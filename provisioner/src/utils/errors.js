// provisioner/src/utils/errors.js

export function wrapErr(msg, err, extra = {}) {
    const e = new Error(`${msg}: ${err?.message || String(err)}`);
    e.cause = err;
    e.extra = extra;
    return e;
}

export function isNotFoundDockerErr(err) {
    // dockerode often uses:
    // - statusCode: 404
    // - reason: "no such container"/"No such image"
    // - json.message string
    const sc = err?.statusCode;
    const m = err?.json?.message || err?.reason || err?.message || "";
    return sc === 404 || /no such (container|image|network|volume)/i.test(m);
}
