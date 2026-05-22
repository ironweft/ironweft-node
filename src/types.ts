/**
 * IronWeft API request and response types.
 */

// ── Agent ──────────────────────────────────────────────────────────────────

export interface RegisterAgentRequest {
  agent_name: string;
  sponsor_id: string;
  description?: string;
  initial_roles?: string[];
  metadata?: Record<string, unknown>;
}

export interface RegisterAgentResponse {
  agent_id: string;
  public_key: string;
  status: AgentStatus;
  risk_tier: string;
  tier_reason: string;
  created_at: string;
}

export type AgentStatus = "active" | "suspended" | "retired";

export interface AgentPermissionsResponse {
  agent_id: string;
  status: AgentStatus;
  roles: string[];
  metadata: Record<string, unknown>;
}

export interface UpdateAgentStatusRequest {
  status: AgentStatus;
}

export interface UpdateAgentStatusResponse {
  agent_id: string;
  status: AgentStatus;
}

// ── Credentials ────────────────────────────────────────────────────────────

export interface IssueCredentialRequest {
  agent_id: string;
  scopes: string[];
  ttl_minutes?: number;
  context?: Record<string, unknown>;
}

export interface IssueCredentialResponse {
  credential: string;
  expires_at: string;
  scopes: string[];
}

// ── Delegate ───────────────────────────────────────────────────────────────

export interface DelegateAgentRequest {
  agent_name: string;
  scopes: string[];
  initial_roles?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface DelegateAgentResponse {
  agent_id: string;
  parent_agent_id: string;
  delegation_chain: string[];
  public_key: string;
  status: AgentStatus;
  risk_tier: string;
  tier_reason: string;
  created_at: string;
}

// ── Authorize ──────────────────────────────────────────────────────────────

export type AuthDecision = "allow" | "deny" | "challenge" | "suspended" | "retired";

export interface AuthorizeRequest {
  credential: string;
  action: string;
  resource?: string;
  parameters?: Record<string, unknown>;
  context?: Record<string, unknown>;
  initiator?: string;
}

export interface AuthorizeResponse {
  decision: AuthDecision;
  reason: string;
  allowed_scopes: string[];
  audit_event_id: string;
  /** Set by the SDK cache; not present in API responses. */
  _cached?: boolean;
}

// ── Batch Authorize ────────────────────────────────────────────────────────

export interface BatchAuthorizeItem {
  action: string;
  resource?: string;
  parameters?: Record<string, unknown>;
  context?: Record<string, unknown>;
  initiator?: string;
  /** Caller-supplied ID echoed back in each result for correlation. */
  ref?: string;
}

export interface BatchResultItem {
  ref?: string;
  action: string;
  decision: AuthDecision;
  reason: string;
  audit_event_id?: string;
  _cached?: boolean;
}

export interface BatchSummary {
  total: number;
  allow: number;
  deny: number;
  challenge: number;
}

export interface BatchAuthorizeResponse {
  results: BatchResultItem[];
  summary: BatchSummary;
}

// ── Audit ──────────────────────────────────────────────────────────────────

export interface LogAuditEventRequest {
  agent_id: string;
  event_type: string;
  action: string;
  outcome: string;
  metadata?: Record<string, unknown>;
}

export interface LogAuditEventResponse {
  event_id: string;
  chain_hash: string;
}

export interface AuditEvent {
  event_id: string;
  agent_id: string;
  event_type: string;
  action: string;
  outcome: string;
  chain_hash: string;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface AuditTrailResponse {
  events: AuditEvent[];
  total: number;
}

export interface AuditTrailParams {
  agent_id?: string;
  limit?: number;
  offset?: number;
}

// ── Tenant ─────────────────────────────────────────────────────────────────

export interface UpdateTenantRequest {
  webhook_url?: string;
  ip_allowlist?: string[];
}

export interface UpdateTenantResponse {
  tenant_id: string;
  updated: boolean;
}

export interface RotateKeyResponse {
  tenant_id: string;
  api_key: string;
  warning: string;
}
