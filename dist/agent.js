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
import { setAgentHandleFactory } from "./client.js";
import { AuthorizationDenied, AgentSuspended, AgentRetired } from "./errors.js";
export class AgentHandle {
    agentId;
    client;
    constructor(client, agentId) {
        this.client = client;
        this.agentId = agentId;
    }
    // ── credential ─────────────────────────────────────────────────────────────
    /**
     * Issue a short-lived credential for this agent.
     * Returns the raw JWT string.
     */
    async credential(params) {
        const resp = await this.client.issueCredential({
            agentId: this.agentId,
            scopes: params.scopes,
            ttlMinutes: params.ttlMinutes,
            context: params.context,
        });
        return resp.credential;
    }
    // ── authorize ──────────────────────────────────────────────────────────────
    /**
     * Call /authorize and return the full response on allow.
     *
     * Throws:
     *   - AgentRetired    — agent is hard-locked
     *   - AgentSuspended  — agent is temporarily suspended
     *   - AuthorizationDenied — policy denied the action
     */
    async check(action, params) {
        const resp = await this.client.authorize({
            credential: params.credential,
            action,
            resource: params.resource,
            parameters: params.parameters,
            context: params.context,
            initiator: params.initiator,
        });
        const decision = resp.decision;
        if (decision === "retired") {
            throw new AgentRetired(this.agentId);
        }
        if (decision === "suspended") {
            throw new AgentSuspended({
                action,
                agentId: this.agentId,
                reason: resp.reason,
                auditEventId: resp.audit_event_id,
            });
        }
        if (decision !== "allow") {
            throw new AuthorizationDenied({
                action,
                agentId: this.agentId,
                reason: resp.reason,
                auditEventId: resp.audit_event_id,
            });
        }
        return resp;
    }
    // ── gate ───────────────────────────────────────────────────────────────────
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
    gate(action, options, fn) {
        const self = this;
        return async function gated(...args) {
            const cred = await self.credential({
                scopes: options.scopes,
                ttlMinutes: options.ttlMinutes,
            });
            await self.check(action, {
                credential: cred,
                resource: options.resource,
                initiator: options.initiator,
            });
            return fn(...args);
        };
    }
    // ── lifecycle ──────────────────────────────────────────────────────────────
    /** Manually suspend this agent. */
    async suspend() {
        return this.client.updateAgentStatus(this.agentId, "suspended");
    }
    /** Reactivate a suspended agent. */
    async reactivate() {
        return this.client.updateAgentStatus(this.agentId, "active");
    }
    /**
     * Hard-lock this agent. Irreversible.
     * After retiring, all authorization checks will raise AgentRetired.
     */
    async retire() {
        return this.client.updateAgentStatus(this.agentId, "retired");
    }
    // ── inspection ─────────────────────────────────────────────────────────────
    /** Return current status, roles, and metadata for this agent. */
    async permissions() {
        return this.client.getAgent(this.agentId);
    }
    /**
     * Return the tamper-evident audit trail for this agent.
     * Events are hash-chained — any tampering breaks the chain.
     */
    async auditTrail(params) {
        const resp = await this.client.getAuditTrail({
            agent_id: this.agentId,
            limit: params?.limit,
            offset: params?.offset,
        });
        return resp.events;
    }
    // ── delegation ─────────────────────────────────────────────────────────────
    /**
     * Spawn a child agent under this agent, inheriting a constrained scope.
     * Returns a new AgentHandle scoped to the child agent.
     */
    async delegate(params) {
        const registration = await this.client.delegateAgent(this.agentId, params);
        const handle = new AgentHandle(this.client, registration.agent_id);
        return { handle, registration };
    }
}
// Wire up the factory so IronWeftClient.agent() works without a direct import.
// This runs once when agent.ts is first imported (i.e. when index.ts loads).
setAgentHandleFactory((client, agentId) => new AgentHandle(client, agentId));
//# sourceMappingURL=agent.js.map