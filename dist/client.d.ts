/**
 * IronWeftClient — low-level API client covering all IronWeft endpoints.
 *
 * Usage:
 *   import { IronWeftClient } from "ironweft";
 *   const client = new IronWeftClient({ apiKey: "iw_live_xxx" });
 *   const agent  = client.agent("agt_xxx");
 */
import type { RegisterAgentResponse, AgentPermissionsResponse, AgentStatus, UpdateAgentStatusResponse, IssueCredentialResponse, DelegateAgentResponse, AuthorizeResponse, BatchAuthorizeItem, BatchAuthorizeResponse, LogAuditEventResponse, AuditTrailParams, AuditTrailResponse, UpdateTenantResponse, RotateKeyResponse } from "./types.js";
/** Minimal interface used by IronWeftClient — avoids importing AgentHandle directly. */
export interface AgentHandleInterface {
    readonly agentId: string;
}
/** Called by agent.ts at module load time to wire up the factory. */
export declare function setAgentHandleFactory(factory: (client: IronWeftClient, agentId: string) => AgentHandleInterface): void;
export interface IronWeftClientOptions {
    /** Bearer token — must start with `iw_live_` or `iw_test_`. */
    apiKey: string;
    /** Override the base URL (useful for testing). Defaults to https://ironweft.io */
    baseUrl?: string;
    /** Request timeout in milliseconds. Defaults to 10 000. */
    timeoutMs?: number;
    /** Cache allow decisions in-process. TTL bound to credential expiry. Default: true. */
    cache?: boolean;
}
export declare class IronWeftClient {
    private readonly apiKey;
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly _cache;
    constructor(options: IronWeftClientOptions);
    private authHeaders;
    /**
     * Core fetch wrapper. Handles timeouts, JSON parsing, and error lifting.
     */
    request<T>(method: string, path: string, options?: {
        body?: unknown;
        params?: Record<string, string | number | undefined>;
    }): Promise<T>;
    /**
     * Register a new agent.
     * Returns agent_id, public_key, status, risk_tier, tier_reason, created_at.
     */
    registerAgent(params: {
        name: string;
        sponsorId: string;
        description?: string;
        roles?: string[];
        metadata?: Record<string, unknown>;
    }): Promise<RegisterAgentResponse>;
    /**
     * Fetch an agent's current status, roles, and metadata.
     */
    getAgent(agentId: string): Promise<AgentPermissionsResponse>;
    /**
     * Update an agent's lifecycle status: active | suspended | retired.
     */
    updateAgentStatus(agentId: string, status: AgentStatus): Promise<UpdateAgentStatusResponse>;
    /**
     * Issue a short-lived scoped JWT for an agent.
     * Returns credential (raw JWT string), expires_at, scopes.
     */
    issueCredential(params: {
        agentId: string;
        scopes: string[];
        ttlMinutes?: number;
        context?: Record<string, unknown>;
    }): Promise<IssueCredentialResponse>;
    /**
     * Spawn a child agent under a parent, inheriting a subset of its permissions.
     */
    delegateAgent(parentAgentId: string, params: {
        name: string;
        scopes: string[];
        roles?: string[];
        description?: string;
        metadata?: Record<string, unknown>;
    }): Promise<DelegateAgentResponse>;
    /**
     * Evaluate a policy decision for a given credential and action.
     * Returns decision, reason, allowed_scopes, audit_event_id.
     * Allow decisions are cached in-process (TTL = credential expiry).
     * Pass skipCache: true to force a live round-trip (e.g. after a policy change).
     */
    authorize(params: {
        credential: string;
        action: string;
        resource?: string;
        parameters?: Record<string, unknown>;
        context?: Record<string, unknown>;
        initiator?: string;
        skipCache?: boolean;
    }): Promise<AuthorizeResponse>;
    /**
     * Evaluate up to 50 actions in a single request.
     * Cached allow decisions are served locally; uncached actions are bundled
     * into one POST /authorize/batch call.
     * Returns the full batch response: { results, summary }.
     */
    authorizeBatch(params: {
        credential: string;
        actions: BatchAuthorizeItem[];
        skipCache?: boolean;
    }): Promise<BatchAuthorizeResponse>;
    /**
     * Evict cached decisions. Pass a credential to evict only that credential's
     * entries (e.g. after receiving a policy-change webhook). Omit to clear all.
     */
    invalidateCache(credential?: string): void;
    /**
     * Write a structured audit event to the hash-chained log.
     */
    logAuditEvent(params: {
        agentId: string;
        eventType: string;
        action: string;
        outcome: string;
        metadata?: Record<string, unknown>;
    }): Promise<LogAuditEventResponse>;
    /**
     * Fetch paginated audit events, optionally filtered by agent.
     */
    getAuditTrail(params?: AuditTrailParams): Promise<AuditTrailResponse>;
    /**
     * Update tenant configuration (webhook URL, IP allowlist).
     */
    updateTenant(tenantId: string, params: {
        webhookUrl?: string;
        ipAllowlist?: string[];
    }): Promise<UpdateTenantResponse>;
    /**
     * Rotate the tenant API key. The old key is immediately invalidated.
     */
    rotateTenantKey(tenantId: string): Promise<RotateKeyResponse>;
    /**
     * Return an AgentHandle scoped to a specific agent ID.
     * This is the preferred entry point for most operations.
     *
     * @example
     * const agent = client.agent("agt_xxx");
     * const cred  = await agent.credential({ scopes: ["payments:write"] });
     * await agent.check("payment.send", { credential: cred });
     */
    agent(agentId: string): AgentHandleInterface;
}
//# sourceMappingURL=client.d.ts.map