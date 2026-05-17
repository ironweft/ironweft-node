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

import { IronWeftClient, setAgentHandleFactory } from "./client.js";
import { AuthorizationDenied, AgentSuspended, AgentRetired } from "./errors.js";
import type { AgentPermissionsResponse, AuditEvent, DelegateAgentResponse } from "./types.js";

export class AgentHandle {
  readonly agentId: string;
  private readonly client: IronWeftClient;

  constructor(client: IronWeftClient, agentId: string) {
    this.client = client;
    this.agentId = agentId;
  }

  // ── credential ─────────────────────────────────────────────────────────────

  /**
   * Issue a short-lived credential for this agent.
   * Returns the raw JWT string.
   */
  async credential(params: {
    scopes: string[];
    ttlMinutes?: number;
    context?: Record<string, unknown>;
  }): Promise<string> {
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
  async check(
    action: string,
    params: {
      credential: string;
      resource?: string;
      parameters?: Record<string, unknown>;
      context?: Record<string, unknown>;
      initiator?: string;
    }
  ): Promise<{ decision: string; reason: string; allowed_scopes: string[]; audit_event_id: string }> {
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
  gate<TArgs extends unknown[], TReturn>(
    action: string,
    options: {
      scopes: string[];
      resource?: string;
      ttlMinutes?: number;
      initiator?: string;
    },
    fn: (...args: TArgs) => Promise<TReturn>
  ): (...args: TArgs) => Promise<TReturn> {
    const self = this;
    return async function gated(...args: TArgs): Promise<TReturn> {
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
  async suspend(): Promise<{ agent_id: string; status: string }> {
    return this.client.updateAgentStatus(this.agentId, "suspended");
  }

  /** Reactivate a suspended agent. */
  async reactivate(): Promise<{ agent_id: string; status: string }> {
    return this.client.updateAgentStatus(this.agentId, "active");
  }

  /**
   * Hard-lock this agent. Irreversible.
   * After retiring, all authorization checks will raise AgentRetired.
   */
  async retire(): Promise<{ agent_id: string; status: string }> {
    return this.client.updateAgentStatus(this.agentId, "retired");
  }

  // ── inspection ─────────────────────────────────────────────────────────────

  /** Return current status, roles, and metadata for this agent. */
  async permissions(): Promise<AgentPermissionsResponse> {
    return this.client.getAgent(this.agentId);
  }

  /**
   * Return the tamper-evident audit trail for this agent.
   * Events are hash-chained — any tampering breaks the chain.
   */
  async auditTrail(params?: { limit?: number; offset?: number }): Promise<AuditEvent[]> {
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
  async delegate(params: {
    name: string;
    scopes: string[];
    roles?: string[];
    description?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ handle: AgentHandle; registration: DelegateAgentResponse }> {
    const registration = await this.client.delegateAgent(this.agentId, params);
    const handle = new AgentHandle(this.client, registration.agent_id);
    return { handle, registration };
  }
}

// Wire up the factory so IronWeftClient.agent() works without a direct import.
// This runs once when agent.ts is first imported (i.e. when index.ts loads).
setAgentHandleFactory((client, agentId) => new AgentHandle(client, agentId));
