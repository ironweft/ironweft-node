/**
 * IronWeft Node.js SDK — Quickstart
 *
 * Mirrors the Python quickstart example.
 * Run with: npx tsx examples/quickstart.ts
 *
 * Set IW_API_KEY and IW_AGENT_ID in your environment (or .env file).
 */

import {
  IronWeftClient,
  AuthorizationDenied,
  AgentSuspended,
} from "../src/index.js";

const API_KEY  = process.env["IW_API_KEY"]  ?? "iw_live_xxx";
const AGENT_ID = process.env["IW_AGENT_ID"] ?? "agt_xxx";

const client = new IronWeftClient({ apiKey: API_KEY });

// ── 1. Register an agent (one-time setup) ────────────────────────────────────
const registration = await client.registerAgent({
  name: "Grace",
  sponsorId: "user_margaret_chen",
  roles: ["call_agent"],
});
console.log("Registered:", registration.agent_id);

// ── 2. Get a handle scoped to that agent ─────────────────────────────────────
const agent = client.agent(AGENT_ID);

// ── 3a. Explicit check — issue credential then authorize ─────────────────────
const cred = await agent.credential({
  scopes: ["payments:write"],
  ttlMinutes: 15,
});

try {
  const result = await agent.check("payment.send", {
    credential: cred,
    resource: "account_7721",
  });
  console.log("Allowed — audit event:", result.audit_event_id);
  // → run the payment logic here
} catch (err) {
  if (err instanceof AgentSuspended) {
    console.error("Agent suspended after consecutive denies");
  } else if (err instanceof AuthorizationDenied) {
    console.error("Denied:", err.reason);
  } else {
    throw err;
  }
}

// ── 3b. gate() — wraps credential issuance + authorize automatically ─────────
const sendPayment = agent.gate(
  "payment.send",
  { scopes: ["payments:write"] },
  async (amount: number, accountId: string) => {
    console.log(`Sending $${amount} to ${accountId}`);
  }
);

try {
  await sendPayment(2400.00, "account_7721");
} catch (err) {
  if (err instanceof AuthorizationDenied) {
    console.error("Blocked:", err.message);
  } else {
    throw err;
  }
}

// ── 4. Pull the audit trail ───────────────────────────────────────────────────
const events = await agent.auditTrail({ limit: 10 });
for (const event of events) {
  console.log(event.action, event.outcome, event.chain_hash.slice(0, 12));
}
