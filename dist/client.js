/**
 * IronWeftClient — low-level API client covering all IronWeft endpoints.
 *
 * Usage:
 *   import { IronWeftClient } from "ironweft";
 *   const client = new IronWeftClient({ apiKey: "iw_live_xxx" });
 *   const agent  = client.agent("agt_xxx");
 */
import { IronWeftError } from "./errors.js";
import { AuthCache } from "./cache.js";
// Forward-declared so client.ts can reference it without a circular import.
// agent.ts sets this via setAgentHandleFactory() before the module resolves.
let _agentHandleFactory = null;
/** Called by agent.ts at module load time to wire up the factory. */
export function setAgentHandleFactory(factory) {
    _agentHandleFactory = factory;
}
export class IronWeftClient {
    apiKey;
    baseUrl;
    timeoutMs;
    _cache;
    constructor(options) {
        if (!options.apiKey) {
            throw new IronWeftError("apiKey is required");
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ?? "https://ironweft.io").replace(/\/$/, "");
        this.timeoutMs = options.timeoutMs ?? 10_000;
        this._cache = (options.cache ?? true) ? new AuthCache() : null;
    }
    // ── internal ───────────────────────────────────────────────────────────────
    authHeaders() {
        return {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
        };
    }
    /**
     * Core fetch wrapper. Handles timeouts, JSON parsing, and error lifting.
     */
    async request(method, path, options) {
        const { body, params } = options ?? {};
        let url = `${this.baseUrl}${path}`;
        if (params) {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined)
                    qs.set(k, String(v));
            }
            const qstr = qs.toString();
            if (qstr)
                url = `${url}?${qstr}`;
        }
        const headers = this.authHeaders();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        let response;
        try {
            response = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
        }
        catch (err) {
            clearTimeout(timer);
            if (err instanceof Error && err.name === "AbortError") {
                throw new IronWeftError(`Request timed out after ${this.timeoutMs}ms: ${method} ${path}`);
            }
            throw new IronWeftError(`Network error: ${String(err)}`);
        }
        clearTimeout(timer);
        let data;
        const contentType = response.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            data = await response.json();
        }
        else {
            const text = await response.text();
            data = { detail: text };
        }
        if (!response.ok) {
            const detail = typeof data === "object" && data !== null && "detail" in data
                ? String(data.detail)
                : JSON.stringify(data);
            throw new IronWeftError(`IronWeft API ${response.status}: ${detail}`);
        }
        return data;
    }
    // ── agents ─────────────────────────────────────────────────────────────────
    /**
     * Register a new agent.
     * Returns agent_id, public_key, status, risk_tier, tier_reason, created_at.
     */
    async registerAgent(params) {
        const body = {
            agent_name: params.name,
            sponsor_id: params.sponsorId,
            description: params.description,
            initial_roles: params.roles,
            metadata: params.metadata,
        };
        return this.request("POST", "/agents", { body });
    }
    /**
     * Fetch an agent's current status, roles, and metadata.
     */
    async getAgent(agentId) {
        return this.request("GET", `/agents/${agentId}/permissions`);
    }
    /**
     * Update an agent's lifecycle status: active | suspended | retired.
     */
    async updateAgentStatus(agentId, status) {
        return this.request("PATCH", `/agents/${agentId}`, {
            body: { status },
        });
    }
    // ── credentials ────────────────────────────────────────────────────────────
    /**
     * Issue a short-lived scoped JWT for an agent.
     * Returns credential (raw JWT string), expires_at, scopes.
     */
    async issueCredential(params) {
        const body = {
            agent_id: params.agentId,
            scopes: params.scopes,
            ttl_minutes: params.ttlMinutes,
            context: params.context,
        };
        return this.request("POST", "/agents/credentials", { body });
    }
    // ── delegate ───────────────────────────────────────────────────────────────
    /**
     * Spawn a child agent under a parent, inheriting a subset of its permissions.
     */
    async delegateAgent(parentAgentId, params) {
        const body = {
            agent_name: params.name,
            scopes: params.scopes,
            initial_roles: params.roles,
            description: params.description,
            metadata: params.metadata,
        };
        return this.request("POST", `/agents/${parentAgentId}/delegate`, { body });
    }
    // ── authorize ──────────────────────────────────────────────────────────────
    /**
     * Evaluate a policy decision for a given credential and action.
     * Returns decision, reason, allowed_scopes, audit_event_id.
     * Allow decisions are cached in-process (TTL = credential expiry).
     * Pass skipCache: true to force a live round-trip (e.g. after a policy change).
     */
    async authorize(params) {
        const { credential, action, resource = "", parameters = {}, context, initiator, skipCache } = params;
        if (this._cache && !skipCache) {
            const cached = this._cache.get(credential, action, resource, parameters);
            if (cached)
                return cached;
        }
        const body = { credential, action, resource, parameters, context, initiator };
        const result = await this.request("POST", "/authorize", { body });
        if (this._cache && result.decision === "allow") {
            this._cache.set(credential, action, resource, parameters, result);
        }
        return result;
    }
    /**
     * Evaluate up to 50 actions in a single request.
     * Cached allow decisions are served locally; uncached actions are bundled
     * into one POST /authorize/batch call.
     * Returns the full batch response: { results, summary }.
     */
    async authorizeBatch(params) {
        const { credential, actions, skipCache } = params;
        if (!actions.length) {
            return { results: [], summary: { total: 0, allow: 0, deny: 0, challenge: 0 } };
        }
        const results = Array(actions.length).fill(null);
        const uncachedIndices = [];
        if (this._cache && !skipCache) {
            for (let i = 0; i < actions.length; i++) {
                const a = actions[i];
                const cached = this._cache.get(credential, a.action, a.resource ?? "", (a.parameters ?? {}));
                if (cached) {
                    results[i] = {
                        ref: a.ref,
                        action: a.action,
                        decision: cached.decision,
                        reason: cached.reason,
                        audit_event_id: cached.audit_event_id,
                        _cached: true,
                    };
                }
                else {
                    uncachedIndices.push(i);
                }
            }
        }
        else {
            for (let i = 0; i < actions.length; i++)
                uncachedIndices.push(i);
        }
        if (uncachedIndices.length > 0) {
            const batchActions = uncachedIndices.map(i => {
                const a = actions[i];
                const item = { action: a.action, resource: a.resource ?? "" };
                if (a.parameters)
                    item["parameters"] = a.parameters;
                if (a.context)
                    item["context"] = a.context;
                if (a.initiator)
                    item["initiator"] = a.initiator;
                if (a.ref !== undefined)
                    item["ref"] = a.ref;
                return item;
            });
            const resp = await this.request("POST", "/authorize/batch", { body: { credential, actions: batchActions } });
            for (let j = 0; j < uncachedIndices.length; j++) {
                const i = uncachedIndices[j];
                const r = resp.results[j];
                results[i] = r;
                if (this._cache && r.decision === "allow") {
                    const a = actions[i];
                    this._cache.set(credential, a.action, a.resource ?? "", (a.parameters ?? {}), { decision: r.decision, reason: r.reason, allowed_scopes: [], audit_event_id: r.audit_event_id ?? "" });
                }
            }
        }
        const final = results.filter((r) => r !== null);
        return {
            results: final,
            summary: {
                total: final.length,
                allow: final.filter(r => r.decision === "allow").length,
                deny: final.filter(r => r.decision === "deny").length,
                challenge: final.filter(r => r.decision === "challenge").length,
            },
        };
    }
    /**
     * Evict cached decisions. Pass a credential to evict only that credential's
     * entries (e.g. after receiving a policy-change webhook). Omit to clear all.
     */
    invalidateCache(credential) {
        if (!this._cache)
            return;
        if (credential) {
            this._cache.invalidateCredential(credential);
        }
        else {
            this._cache.clear();
        }
    }
    // ── audit ──────────────────────────────────────────────────────────────────
    /**
     * Write a structured audit event to the hash-chained log.
     */
    async logAuditEvent(params) {
        const body = {
            agent_id: params.agentId,
            event_type: params.eventType,
            action: params.action,
            outcome: params.outcome,
            metadata: params.metadata,
        };
        return this.request("POST", "/audit/log", { body });
    }
    /**
     * Fetch paginated audit events, optionally filtered by agent.
     */
    async getAuditTrail(params) {
        return this.request("GET", "/audit/trail", {
            params: {
                agent_id: params?.agent_id,
                limit: params?.limit,
                offset: params?.offset,
            },
        });
    }
    // ── tenants ────────────────────────────────────────────────────────────────
    /**
     * Update tenant configuration (webhook URL, IP allowlist).
     */
    async updateTenant(tenantId, params) {
        const body = {
            webhook_url: params.webhookUrl,
            ip_allowlist: params.ipAllowlist,
        };
        return this.request("PATCH", `/tenants/${tenantId}`, { body });
    }
    /**
     * Rotate the tenant API key. The old key is immediately invalidated.
     */
    async rotateTenantKey(tenantId) {
        return this.request("POST", `/tenants/${tenantId}/rotate-key`);
    }
    // ── agent handle ───────────────────────────────────────────────────────────
    /**
     * Return an AgentHandle scoped to a specific agent ID.
     * This is the preferred entry point for most operations.
     *
     * @example
     * const agent = client.agent("agt_xxx");
     * const cred  = await agent.credential({ scopes: ["payments:write"] });
     * await agent.check("payment.send", { credential: cred });
     */
    agent(agentId) {
        if (!_agentHandleFactory) {
            throw new IronWeftError("AgentHandle factory not registered. Import from 'ironweft' (index.ts) to ensure all modules are initialized.");
        }
        return _agentHandleFactory(this, agentId);
    }
}
//# sourceMappingURL=client.js.map