# Changelog

All notable changes to `@metabob/vessel-discovery-client` will be documented in
this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this package adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-04-23

### Added

- Resolver-contract fields on `DiscoveryConfig` and `VesselRegistration`:
  `resolve_endpoint`, `resolve_request_format`, `auth_scheme`,
  `resolve_timeout_ms`. Vessels can now advertise *how* their impulse-resolve
  endpoint is shaped at registration time, and discovery clients can rely on
  the advertisement instead of hardcoding `/v2/impulses/resolve` + `Bearer`.
- `auth_token_source` and `auth_delegation_mode` fields. These extend the
  resolver contract with *whose* credential to attach (caller-identity vs.
  user-identity) and how to obtain a user-bound token (forward vs. exchange).
  See `docs/specs/auth-token-source-field.md`.
- Type aliases `ResolveRequestFormat`, `ResolveAuthScheme`, `AuthTokenSource`,
  `AuthDelegationMode` exported from the package root.

### Notes

- All new fields are optional. Vessels that don't advertise them keep the
  pre-1.1.0 defaults (`/v2/impulses/resolve`, `pointer` body, `none` auth,
  `caller_identity` token source, `forward` delegation). Fully backward
  compatible — no migration needed for existing vessels.

## [1.0.0] - 2026-03

### Added

- Initial release of the shared vessel-discovery client.
- `DiscoveryClient` for vessel registration, heartbeat, and capability lookup.
- Hono and Express middleware adapters under `./middleware`.
- Core types: `DiscoveryConfig`, `VesselRegistration`, `VesselCapability`,
  `HealthStatus`.
