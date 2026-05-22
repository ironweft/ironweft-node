import type { AuthorizeResponse } from "./types.js";
export declare class AuthCache {
    private store;
    get(credential: string, action: string, resource: string, parameters: Record<string, unknown>): (AuthorizeResponse & {
        _cached: true;
    }) | null;
    set(credential: string, action: string, resource: string, parameters: Record<string, unknown>, response: AuthorizeResponse): void;
    invalidateCredential(credential: string): void;
    clear(): void;
}
//# sourceMappingURL=cache.d.ts.map