function jwtExp(credential) {
    try {
        const payload = credential.split(".")[1];
        if (!payload)
            return null;
        const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(atob(b64));
        return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
    }
    catch {
        return null;
    }
}
function cacheKey(credential, action, resource, parameters) {
    const sorted = Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)));
    return [credential, action, resource, JSON.stringify(sorted)].join("\x00");
}
export class AuthCache {
    store = new Map();
    get(credential, action, resource, parameters) {
        const key = cacheKey(credential, action, resource, parameters);
        const entry = this.store.get(key);
        if (!entry)
            return null;
        if (Date.now() >= entry.expiresAt) {
            this.store.delete(key);
            return null;
        }
        return { ...entry.value, _cached: true };
    }
    set(credential, action, resource, parameters, response) {
        const exp = jwtExp(credential);
        if (exp === null || Date.now() >= exp)
            return;
        this.store.set(cacheKey(credential, action, resource, parameters), {
            value: response,
            expiresAt: exp,
        });
    }
    invalidateCredential(credential) {
        const prefix = credential + "\x00";
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix))
                this.store.delete(key);
        }
    }
    clear() {
        this.store.clear();
    }
}
//# sourceMappingURL=cache.js.map