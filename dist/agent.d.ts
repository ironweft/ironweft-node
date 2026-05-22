/**
 * AgentHandle — a client scoped to a specific agent_id.
 *
 * Obtained via client.agent("agt_xxx") — not instantiated directly.
 *
 * Usage:
 *   import { IronWeftClient } from "ironweft";
 *   const client = new IronWeftClient({ apiKey: "iw_live_xxx" });
 *   const agent  = client.agent("agt_xxx");
 *
 *   const cred = await agent.credential({ scopes: ["payments:write"] });
 *   await agent.check("payment.send", { credential: cred, resource: "account_7721" });
 */
import { IronWeftClient } from "./client.js";
import type { AgentPermissionsResponse, AuditEvent, BatchAuthorizeItem, BatchAuthorizeResponse, DelegateAgentResponse } from "./types.js";
export declare class AgentHandle {
    readonly agentId: string;
    private readonly client;
    constructor(client: IronWeftClient, agentId: string);
    /**
     * Issue a short-lived credential for this agent.
     * Returns the raw JWT string.
     */
    credential(params: {
        scopes: string[];
        ttlMinutes?: number;
        context?: Record<string, unknown>;
    }): Promise<string>;
    /**
     * Call /authorize and return the full response on allow.
     *
     * Throws:
     *   - AgentRetired    — agent is hard-locked
     *   - AgentSuspended  — agent is temporarily suspended
     *   - AuthorizationDenied — policy denied the action
     */
    check(action: string, params: {
        credential: string;
        resource?: string;
        parameters?: Record<string, unknown>;
        context?: Record<string, unknown>;
        initiator?: string;
    }): Promise<{
        decision: string;
        reason: string;
        allowed_scopes: string[];
        audit_event_id: string;
    }>;
    /**
     * Evaluate multiple actions in one request.
     * Cached allows are served locally; the rest are bundled into a single
     * POST /authorize/batch call. Returns the full batch response: { results, summary }.
     */
    batch(params: {
        credential: string;
        actions: BatchAuthorizeItem[];
        skipCache?: boolean;
    }): Promise<BatchAuthorizeResponse>;
    /**
     * Higher-order function that wraps an async function with an IronWeft
     * authorization check. Issues a fresh credential and calls /authorize
     * before each invocation. The wrapped function only runs on an explicit
     * allow decision.
     *
     * TypeScript equivalent of the Python @agent.gate() decorator.
     *
     * @example
     * const sendPayment = agent.gate(
     *   "payment.send",
     *   { scopes: ["payments:write"] },
     *   async (amount: number, accountId: string) => {
     *     console.log(`Sending $${amount} to ${accountId}`);
     *   }
     * );
     *
     * await sendPayment(2400.00, "account_7721");  // credential + auth happen automatically
     */
    gate<TArgs extends unknown[], TReturn>(action: string, options: {
        scopes: string[];
        resource?: string;
        ttlMinutes?: number;
        initiator?: string;
    }, fn: (...args: TArgs) => Promise<TReturn>): (...args: TArgs) => Promise<TReturn>;
    /** Manually suspend this agent. */
    suspend(): Promise<{
        agent_id: string;
        status: string;
    }>;
    /** Reactivate a suspended agent. */
    reactivate(): Promise<{
        agent_id: string;
        status: string;
    }>;
    /**
     * Hard-lock this agent. Irreversible.
     * After retiring, all authorization checks will raise AgentRetired.
     */
    retire(): Promise<{
        agent_id: string;
        status: string;
    }>;
    /** Return current status, roles, and metadata for this agent. */
    permissions(): Promise<AgentPermissionsResponse>;
    /**
     * Return the tamper-evident audit trail for this agent.
     * Events are hash-chained — any tampering breaks the chain.
     */
    auditTrail(params?: {
        limit?: number;
        offset?: number;
    }): Promise<AuditEvent[]>;
    /**
     * Spawn a child agent under this agent, inheriting a constrained scope.
     * Returns a new AgentHandle scoped to the child agent.
     */
    delegate(params: {
        name: string;
        scopes: string[];
        roles?: string[];
        description?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        handle: AgentHandle;
        registration: DelegateAgentResponse;
    }>;
}
//# sourceMappingURL=agent.d.ts.map