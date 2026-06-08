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
import type {
  RegisterAgentRequest,
  RegisterAgentResponse,
  AgentPermissionsResponse,
  AgentStatus,
  UpdateAgentStatusResponse,
  IssueCredentialRequest,
  IssueCredentialResponse,
  DelegateAgentRequest,
  DelegateAgentResponse,
  AuthorizeRequest,
  AuthorizeResponse,
  BatchAuthorizeItem,
  BatchAuthorizeResponse,
  BatchResultItem,
  LogAuditEventRequest,
  LogAuditEventResponse,
  AuditTrailParams,
  AuditTrailResponse,
  UpdateTenantRequest,
  UpdateTenantResponse,
  RotateKeyResponse,
} from "./types.js";

// Forward-declared so client.ts can reference it without a circular import.
// agent.ts sets this via setAgentHandleFactory() before the module resolves.
let _agentHandleFactory: ((client: IronWeftClient, agentId: string) => AgentHandleInterface) | null = null;

/** Minimal interface used by IronWeftClient — avoids importing AgentHandle directly. */
export interface AgentHandleInterface {
  readonly agentId: string;
}

/** Called by agent.ts at module load time to wire up the factory. */
export function setAgentHandleFactory(
  factory: (client: IronWeftClient, agentId: string) => AgentHandleInterface
): void {
  _agentHandleFactory = factory;
}

export interface IronWeftClientOptions {
  /**
   * Bearer token — must start with `iw_live_` or `iw_test_`.
   * If omitted, reads from IRONWEFT_API_KEY env var (falls back to IRONWEFT_TENANT_API_KEY).
   */
  apiKey?: string;
  /** Override the base URL (useful for testing). Defaults to https://ironweft.io */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 10 000. */
  timeoutMs?: number;
  /** Cache allow decisions in-process. TTL bound to credential expiry. Default: true. */
  cache?: boolean;
}

export class IronWeftClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly _cache: AuthCache | null;

  constructor(options: IronWeftClientOptions = {}) {
    const resolved =
      options.apiKey ??
      process.env["IRONWEFT_API_KEY"] ??
      process.env["IRONWEFT_TENANT_API_KEY"];
    if (!resolved) {
      throw new IronWeftError(
        "apiKey is required. Pass it explicitly or set the IRONWEFT_API_KEY environment variable."
      );
    }
    this.apiKey = resolved;
    this.baseUrl = (options.baseUrl ?? "https://ironweft.io").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this._cache = (options.cache ?? true) ? new AuthCache() : null;
  }

  // ── internal ───────────────────────────────────────────────────────────────

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Core fetch wrapper. Handles timeouts, JSON parsing, and error lifting.
   */
  async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | undefined>;
    }
  ): Promise<T> {
    const { body, params } = options ?? {};

    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const qstr = qs.toString();
      if (qstr) url = `${url}?${qstr}`;
    }

    const headers: Record<string, string> = this.authHeaders();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === "AbortError") {
        throw new IronWeftError(`Request timed out after ${this.timeoutMs}ms: ${method} ${path}`);
      }
      throw new IronWeftError(`Network error: ${String(err)}`);
    }
    clearTimeout(timer);

    let data: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { detail: text };
    }

    if (!response.ok) {
      const detail =
        typeof data === "object" && data !== null && "detail" in data
          ? String((data as Record<string, unknown>).detail)
          : JSON.stringify(data);
      throw new IronWeftError(`IronWeft API ${response.status}: ${detail}`);
    }

    return data as T;
  }

  // ── agents ─────────────────────────────────────────────────────────────────

  /**
   * Register a new agent.
   * Returns agent_id, public_key, status, risk_tier, tier_reason, created_at.
   */
  async registerAgent(params: {
    name: string;
    sponsorId: string;
    description?: string;
    roles?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<RegisterAgentResponse> {
    const body: RegisterAgentRequest = {
      agent_name: params.name,
      sponsor_id: params.sponsorId,
      description: params.description,
      initial_roles: params.roles,
      metadata: params.metadata,
    };
    return this.request<RegisterAgentResponse>("POST", "/agents", { body });
  }

  /**
   * Fetch an agent's current status, roles, and metadata.
   */
  async getAgent(agentId: string): Promise<AgentPermissionsResponse> {
    return this.request<AgentPermissionsResponse>("GET", `/agents/${agentId}/permissions`);
  }

  /**
   * Update an agent's lifecycle status: active | suspended | retired.
   */
  async updateAgentStatus(agentId: string, status: AgentStatus): Promise<UpdateAgentStatusResponse> {
    return this.request<UpdateAgentStatusResponse>("PATCH", `/agents/${agentId}`, {
      body: { status },
    });
  }

  // ── credentials ────────────────────────────────────────────────────────────

  /**
   * Issue a short-lived scoped JWT for an agent.
   * Returns credential (raw JWT string), expires_at, scopes.
   */
  async issueCredential(params: {
    agentId: string;
    scopes: string[];
    ttlMinutes?: number;
    context?: Record<string, unknown>;
  }): Promise<IssueCredentialResponse> {
    const body: IssueCredentialRequest = {
      agent_id: params.agentId,
      scopes: params.scopes,
      ttl_minutes: params.ttlMinutes,
      context: params.context,
    };
    return this.request<IssueCredentialResponse>("POST", "/agents/credentials", { body });
  }

  // ── delegate ───────────────────────────────────────────────────────────────

  /**
   * Spawn a child agent under a parent, inheriting a subset of its permissions.
   */
  async delegateAgent(
    parentAgentId: string,
    params: {
      name: string;
      scopes: string[];
      roles?: string[];
      description?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<DelegateAgentResponse> {
    const body: DelegateAgentRequest = {
      agent_name: params.name,
      scopes: params.scopes,
      initial_roles: params.roles,
      description: params.description,
      metadata: params.metadata,
    };
    return this.request<DelegateAgentResponse>("POST", `/agents/${parentAgentId}/delegate`, { body });
  }

  // ── authorize ──────────────────────────────────────────────────────────────

  /**
   * Evaluate a policy decision for a given credential and action.
   * Returns decision, reason, allowed_scopes, audit_event_id.
   * Allow decisions are cached in-process (TTL = credential expiry).
   * Pass skipCache: true to force a live round-trip (e.g. after a policy change).
   */
  async authorize(params: {
    credential: string;
    action: string;
    resource?: string;
    parameters?: Record<string, unknown>;
    context?: Record<string, unknown>;
    initiator?: string;
    skipCache?: boolean;
  }): Promise<AuthorizeResponse> {
    const { credential, action, resource = "", parameters = {}, context, initiator, skipCache } = params;

    if (this._cache && !skipCache) {
      const cached = this._cache.get(credential, action, resource, parameters);
      if (cached) return cached;
    }

    const body: AuthorizeRequest = { credential, action, resource, parameters, context, initiator };
    const result = await this.request<AuthorizeResponse>("POST", "/authorize", { body });

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
  async authorizeBatch(params: {
    credential: string;
    actions: BatchAuthorizeItem[];
    skipCache?: boolean;
  }): Promise<BatchAuthorizeResponse> {
    const { credential, actions, skipCache } = params;

    if (!actions.length) {
      return { results: [], summary: { total: 0, allow: 0, deny: 0, challenge: 0 } };
    }

    const results: (BatchResultItem | null)[] = Array(actions.length).fill(null);
    const uncachedIndices: number[] = [];

    if (this._cache && !skipCache) {
      for (let i = 0; i < actions.length; i++) {
        const a = actions[i];
        const cached = this._cache.get(
          credential,
          a.action,
          a.resource ?? "",
          (a.parameters ?? {}) as Record<string, unknown>
        );
        if (cached) {
          results[i] = {
            ref: a.ref,
            action: a.action,
            decision: cached.decision,
            reason: cached.reason,
            audit_event_id: cached.audit_event_id,
            _cached: true,
          };
        } else {
          uncachedIndices.push(i);
        }
      }
    } else {
      for (let i = 0; i < actions.length; i++) uncachedIndices.push(i);
    }

    if (uncachedIndices.length > 0) {
      const batchActions = uncachedIndices.map(i => {
        const a = actions[i];
        const item: Record<string, unknown> = { action: a.action, resource: a.resource ?? "" };
        if (a.parameters) item["parameters"] = a.parameters;
        if (a.context) item["context"] = a.context;
        if (a.initiator) item["initiator"] = a.initiator;
        if (a.ref !== undefined) item["ref"] = a.ref;
        return item;
      });

      const resp = await this.request<{ results: BatchResultItem[] }>(
        "POST",
        "/authorize/batch",
        { body: { credential, actions: batchActions } }
      );

      for (let j = 0; j < uncachedIndices.length; j++) {
        const i = uncachedIndices[j];
        const r = resp.results[j];
        results[i] = r;
        if (this._cache && r.decision === "allow") {
          const a = actions[i];
          this._cache.set(
            credential,
            a.action,
            a.resource ?? "",
            (a.parameters ?? {}) as Record<string, unknown>,
            { decision: r.decision, reason: r.reason, allowed_scopes: [], audit_event_id: r.audit_event_id ?? "" }
          );
        }
      }
    }

    const final = results.filter((r): r is BatchResultItem => r !== null);
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
  invalidateCache(credential?: string): void {
    if (!this._cache) return;
    if (credential) {
      this._cache.invalidateCredential(credential);
    } else {
      this._cache.clear();
    }
  }

  // ── audit ──────────────────────────────────────────────────────────────────

  /**
   * Write a structured audit event to the hash-chained log.
   */
  async logAuditEvent(params: {
    agentId: string;
    eventType: string;
    action: string;
    outcome: string;
    metadata?: Record<string, unknown>;
  }): Promise<LogAuditEventResponse> {
    const body: LogAuditEventRequest = {
      agent_id: params.agentId,
      event_type: params.eventType,
      action: params.action,
      outcome: params.outcome,
      metadata: params.metadata,
    };
    return this.request<LogAuditEventResponse>("POST", "/audit/log", { body });
  }

  /**
   * Fetch paginated audit events, optionally filtered by agent.
   */
  async getAuditTrail(params?: AuditTrailParams): Promise<AuditTrailResponse> {
    return this.request<AuditTrailResponse>("GET", "/audit/trail", {
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
  async updateTenant(
    tenantId: string,
    params: { webhookUrl?: string; ipAllowlist?: string[] }
  ): Promise<UpdateTenantResponse> {
    const body: UpdateTenantRequest = {
      webhook_url: params.webhookUrl,
      ip_allowlist: params.ipAllowlist,
    };
    return this.request<UpdateTenantResponse>("PATCH", `/tenants/${tenantId}`, { body });
  }

  /**
   * Rotate the tenant API key. The old key is immediately invalidated.
   */
  async rotateTenantKey(tenantId: string): Promise<RotateKeyResponse> {
    return this.request<RotateKeyResponse>("POST", `/tenants/${tenantId}/rotate-key`);
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
  agent(agentId: string): AgentHandleInterface {
    if (!_agentHandleFactory) {
      throw new IronWeftError(
        "AgentHandle factory not registered. Import from 'ironweft' (index.ts) to ensure all modules are initialized."
      );
    }
    return _agentHandleFactory(this, agentId);
  }
}
