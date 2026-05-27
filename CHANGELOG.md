# Changelog

All notable changes to the IronWeft Node.js / TypeScript SDK. Follows [Semantic Versioning](https://semver.org/).

---

## [0.2.0] — 2026-05-17

### Added
- `AgentHandle` via `client.agent(agentId)` — scoped client for per-agent operations
- `AgentHandle.gate()` — higher-order function wrapping any async function with per-call credential issuance + authorization
- `AgentHandle.batch()` — evaluate up to 50 actions in one `/authorize/batch` call
- `AgentHandle.delegate()` — spawn a child agent, returns `{ handle: AgentHandle, registration }`
- `AgentHandle.suspend()`, `reactivate()`, `retire()` — lifecycle management
- `AgentHandle.permissions()`, `auditTrail()` — inspection helpers
- `AgentSuspended` and `AgentRetired` error classes (extend `AuthorizationDenied`)
- In-process authorization cache (TTL-bound to credential expiry); disable with `cache: false`
- `client.invalidateCache(credential?)` — evict cached decisions after policy changes
- Full TypeScript types exported from package root — `IronWeftClientOptions`, `AgentStatus`, `BatchAuthorizeItem`, `AuditEvent`, and more
- `client.delegateAgent()`, `client.updateTenant()`, `client.rotateTenantKey()` — new management methods

### Changed
- `IronWeftClient` constructor now accepts `IronWeftClientOptions` object (was positional `apiKey` string in 0.1.0)
- `client.authorize()` now caches `allow` decisions in-process by default

### Fixed
- Prototype chain correctly set on all error classes for reliable `instanceof` checks in transpiled JS

---

## [0.1.0] — 2026-04-30

### Added
- Initial release
- `IronWeftClient` with `registerAgent()`, `issueCredential()`, `authorize()`, `getAuditTrail()`
- `IronWeftError` and `AuthorizationDenied` error classes
