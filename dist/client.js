/**
 * IronWeftClient — low-level API client covering all IronWeft endpoints.
 *
 * Usage:
 *   import { IronWeftClient } from "ironweft";
 *   const client = new IronWeftClient({ apiKey: "iw_live_xxx" });
 *   const agent  = client.agent("agt_xxx");
 */
import { IronWeftError } from "./errors.js";
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
    constructor(options) {
        if (!options.apiKey) {
            throw new IronWeftError("apiKey is required");
        }
        this.apiKey = options.apiKey;
        this.baseUrl = (options.baseUrl ?? "https://ironweft.io").replace(/\/$/, "");
        this.timeoutMs = options.timeoutMs ?? 10_000;
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
     */
    async authorize(params) {
        const body = {
            credential: params.credential,
            action: params.action,
            resource: params.resource,
            parameters: params.parameters,
            context: params.context,
            initiator: params.initiator,
        };
        return this.request("POST", "/authorize", { body });
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