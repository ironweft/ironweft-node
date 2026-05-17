# ironweft

Official Node.js / TypeScript SDK for the [IronWeft](https://ironweft.io) Agent IAM API.

- Zero dependencies — uses Node 18+ native `fetch`
- Full TypeScript types
- Mirrors the Python SDK interface

## Requirements

Node.js 18 or later.

## Installation

```bash
npm install ironweft
```

## Quickstart

```typescript
import {
  IronWeftClient,
  AuthorizationDenied,
  AgentSuspended,
} from "ironweft";

const client = new IronWeftClient({ apiKey: "iw_live_xxx" });

// 1. Register an agent (one-time setup)
const reg = await client.registerAgent({
  name: "Grace",
  sponsorId: "user_margaret_chen",
  roles: ["call_agent"],
});
console.log("Registered:", reg.agent_id);

// 2. Get a handle scoped to that agent
const agent = client.agent(reg.agent_id);

// 3a. Explicit check — issue credential then authorize
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
  // → run payment logic here
} catch (err) {
  if (err instanceof AgentSuspended)    console.error("Agent suspended");
  if (err instanceof AuthorizationDenied) console.error("Denied:", err.reason);
}

// 3b. gate() — wraps credential issuance + authorize automatically
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
  if (err instanceof AuthorizationDenied) console.error("Blocked:", err.message);
}

// 4. Pull the audit trail
const events = await agent.auditTrail({ limit: 10 });
for (const event of events) {
  console.log(event.action, event.outcome, event.chain_hash.slice(0, 12));
}
```

## API Reference

### `new IronWeftClient(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | required | Your `iw_live_xxx` API key |
| `baseUrl` | `string` | `https://ironweft.io` | Override for testing |
| `timeoutMs` | `number` | `10000` | Request timeout in ms |

### `client.agent(agentId)` → `AgentHandle`

Returns a handle scoped to one agent. Most operations live here.

---

### AgentHandle

#### `agent.credential(params)` → `Promise<string>`

Issue a short-lived JWT credential.

| Param | Type | Default |
|-------|------|---------|
| `scopes` | `string[]` | required |
| `ttlMinutes` | `number` | `15` |
| `context` | `Record<string, unknown>` | — |

Returns the raw JWT string.

---

#### `agent.check(action, params)` → `Promise<AuthorizeResponse>`

Call `/authorize`. Returns the full response on allow.

| Param | Type | Description |
|-------|------|-------------|
| `action` | `string` | Action to authorize, e.g. `"payment.send"` |
| `params.credential` | `string` | JWT from `agent.credential()` |
| `params.resource` | `string` | Optional resource identifier |
| `params.parameters` | `object` | Optional action parameters |
| `params.context` | `object` | Optional context object |
| `params.initiator` | `string` | Optional initiator identifier |

Throws:
- `AgentRetired` — agent is hard-locked
- `AgentSuspended` — agent is temporarily suspended
- `AuthorizationDenied` — policy denied the action

---

#### `agent.gate(action, options, fn)` → `wrapped fn`

Higher-order function that wraps an async function with automatic credential issuance and authorization. The TypeScript equivalent of the Python `@agent.gate()` decorator.

```typescript
const wrappedFn = agent.gate(
  "payment.send",
  {
    scopes: ["payments:write"],
    resource: "account_7721",   // optional
    ttlMinutes: 15,             // optional, default 15
    initiator: "user_abc",      // optional
  },
  async (amount: number, accountId: string) => {
    // runs only on allow
  }
);

await wrappedFn(100, "account_7721");
```

Throws the same errors as `agent.check()`.

---

#### `agent.permissions()` → `Promise<AgentPermissionsResponse>`

Fetch current status, roles, and metadata.

---

#### `agent.auditTrail(params?)` → `Promise<AuditEvent[]>`

Return the hash-chained audit trail for this agent.

| Param | Type | Default |
|-------|------|---------|
| `limit` | `number` | — |
| `offset` | `number` | — |

---

#### `agent.suspend()` / `agent.reactivate()` / `agent.retire()`

Lifecycle management. `retire()` is irreversible.

---

#### `agent.delegate(params)` → `Promise<{ handle: AgentHandle, registration: DelegateAgentResponse }>`

Spawn a child agent with a constrained scope under this agent. Returns both an AgentHandle for the child and the full registration response.

---

### Direct client methods

All AgentHandle methods have equivalent client-level methods for when you need more control:

| Method | Endpoint |
|--------|----------|
| `client.registerAgent(params)` | `POST /agents` |
| `client.getAgent(agentId)` | `GET /agents/{id}/permissions` |
| `client.updateAgentStatus(agentId, status)` | `PATCH /agents/{id}` |
| `client.issueCredential(params)` | `POST /agents/credentials` |
| `client.delegateAgent(parentId, params)` | `POST /agents/{id}/delegate` |
| `client.authorize(params)` | `POST /authorize` |
| `client.logAuditEvent(params)` | `POST /audit/log` |
| `client.getAuditTrail(params?)` | `GET /audit/trail` |
| `client.updateTenant(tenantId, params)` | `PATCH /tenants/{id}` |
| `client.rotateTenantKey(tenantId)` | `POST /tenants/{id}/rotate-key` |

---

### Errors

All errors extend `IronWeftError`.

| Class | When thrown |
|-------|-------------|
| `IronWeftError` | Network errors, API errors (4xx/5xx), config errors |
| `AuthorizationDenied` | `/authorize` returns `deny` or `challenge` |
| `AgentSuspended` | `/authorize` returns `suspended` |
| `AgentRetired` | `/authorize` returns `retired` |

`AuthorizationDenied` exposes `.action`, `.agentId`, `.reason`, `.auditEventId`.
`AgentSuspended` extends `AuthorizationDenied`.
`AgentRetired` exposes `.agentId`.

## Building from source

```bash
npm install
npm run build        # outputs to dist/
npm run typecheck    # type-check without emitting
```
