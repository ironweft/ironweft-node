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
// Client (must come before agent so the factory can be registered)
export { IronWeftClient } from "./client.js";
// AgentHandle — importing this registers the factory with IronWeftClient
export { AgentHandle } from "./agent.js";
// Errors
export { IronWeftError, AuthorizationDenied, AgentSuspended, AgentRetired } from "./errors.js";
//# sourceMappingURL=index.js.map