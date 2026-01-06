export function randSuffix() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function mkResource({ kind, projectId = "proj_test", name = "test", spec = {} } = {}) {
    const resourceId = `res_${kind}_${randSuffix()}`;
    return {
        resourceId,
        projectId,
        kind,
        name,
        generation: 1,
        spec
    };
}
