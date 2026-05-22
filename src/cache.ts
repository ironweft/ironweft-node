import type { AuthorizeResponse } from "./types.js";

interface CacheEntry {
  value: AuthorizeResponse;
  expiresAt: number; // ms since epoch
}

function jwtExp(credential: string): number | null {
  try {
    const payload = credential.split(".")[1];
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(b64));
    return typeof decoded.exp === "number" ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

function cacheKey(
  credential: string,
  action: string,
  resource: string,
  parameters: Record<string, unknown>
): string {
  const sorted = Object.fromEntries(Object.entries(parameters).sort(([a], [b]) => a.localeCompare(b)));
  return [credential, action, resource, JSON.stringify(sorted)].join("\x00");
}

export class AuthCache {
  private store = new Map<string, CacheEntry>();

  get(
    credential: string,
    action: string,
    resource: string,
    parameters: Record<string, unknown>
  ): (AuthorizeResponse & { _cached: true }) | null {
    const key = cacheKey(credential, action, resource, parameters);
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return { ...entry.value, _cached: true };
  }

  set(
    credential: string,
    action: string,
    resource: string,
    parameters: Record<string, unknown>,
    response: AuthorizeResponse
  ): void {
    const exp = jwtExp(credential);
    if (exp === null || Date.now() >= exp) return;
    this.store.set(cacheKey(credential, action, resource, parameters), {
      value: response,
      expiresAt: exp,
    });
  }

  invalidateCredential(credential: string): void {
    const prefix = credential + "\x00";
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}
