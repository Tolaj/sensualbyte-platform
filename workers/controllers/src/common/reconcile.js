export async function reconcileWrapper(fn, ctx) {
    return fn(ctx);
}
