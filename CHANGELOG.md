# Changelog

All notable changes to the IronWeft Node.js / TypeScript SDK. Follows [Semantic Versioning](https://semver.org/).

---

## [0.2.2] — 2026-06-08

### Fixed
- Strip leading/trailing whitespace from API key (env vars with trailing spaces no longer cause request errors)

---

## [0.2.1] — 2026-06-08

### Added
- CJS (CommonJS) support — `require('ironweft')` now works in CommonJS projects alongside existing ESM `import`

### Changed
- `apiKey` in `IronWeftClientOptions` is now optional; reads `IRONWEFT_API_KEY` from the environment if not passed explicitly (falls back to `IRONWEFT_TENANT_API_KEY` for backwards compatibility)

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
