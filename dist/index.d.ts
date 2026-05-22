/**
 * IronWeft Node.js / TypeScript SDK
 *
 * @example
 * import { IronWeftClient, AuthorizationDenied, AgentSuspended } from "ironweft";
 *
 * const client = new IronWeftClient({ apiKey: "iw_live_xxx" });
 * const agent  = client.agent("agt_xxx");
 *
 * const cred = await agent.credential({ scopes: ["payments:write"], ttlMinutes: 15 });
 *
 * try {
 *   await agent.check("payment.send", { credential: cred, resource: "account_7721" });
 *   // → run payment logic
 * } catch (err) {
 *   if (err instanceof AuthorizationDenied) console.error("Denied:", err.reason);
 *   if (err instanceof AgentSuspended)      console.error("Agent suspended");
 * }
 */
export { IronWeftClient } from "./client.js";
export type { IronWeftClientOptions, AgentHandleInterface } from "./client.js";
export { AuthCache } from "./cache.js";
export { AgentHandle } from "./agent.js";
export { IronWeftError, AuthorizationDenied, AgentSuspended, AgentRetired } from "./errors.js";
export type { AgentStatus, RegisterAgentRequest, RegisterAgentResponse, AgentPermissionsResponse, UpdateAgentStatusResponse, IssueCredentialRequest, IssueCredentialResponse, DelegateAgentRequest, DelegateAgentResponse, AuthDecision, AuthorizeRequest, AuthorizeResponse, BatchAuthorizeItem, BatchResultItem, BatchSummary, BatchAuthorizeResponse, LogAuditEventRequest, LogAuditEventResponse, AuditEvent, AuditTrailResponse, AuditTrailParams, UpdateTenantRequest, UpdateTenantResponse, RotateKeyResponse, } from "./types.js";
//# sourceMappingURL=index.d.ts.map