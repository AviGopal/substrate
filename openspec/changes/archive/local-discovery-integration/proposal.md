## Why

### The Cold-Start Problem

Running react-renderer locally today requires manually exporting three environment variables before every `bun run dev` session:

```bash
export DISCOVERY_ENABLED=true
export DISCOVERY_VESSEL_ENDPOINT=https://discovery.metabob.com
export METABOB_API_KEY=mb-...
```

Without these exports the `initializeDiscovery()` function in `repos/react-renderer/src/index.ts` falls through to a cluster-internal default (`http://discovery-vessel.activity-system.svc.cluster.local:8080`) that is unreachable from a developer laptop, meaning discovery silently fails on every local start. The health endpoint reports `status: "disabled"` and MiniBob never finds the renderer.

MiniBob already solves this problem for its own config: `repos/minibob/src/config.ts` reads `~/.metabob/config.json` with a three-level priority chain (env → project → user). React-renderer has no equivalent — it only reads `process.env`.

### The Org Isolation Gap

When react-renderer does register (via manual env exports), the `DiscoveryConfig` it builds in `initializeDiscovery()` passes `metadata.environment` but does **not** pass `orgId`. The discovery-vessel registry (`repos/discovery-vessel/src/registry.ts`, `findByShape()`) filters on `orgId` when the caller supplies one, but registration records with no `orgId` are visible to **all** org queries because the filter is `!v.orgId || v.orgId === options.orgId`. A react-renderer registered without an `orgId` can be discovered by users from any org — a multi-tenant correctness bug.

The `orgId` is available inside every API key. Identity-vessel `POST /v1/keys/validate` returns `{ valid, org_id, user_id, key_id, scopes }`. React-renderer already requires a `METABOB_API_KEY` for heartbeat authentication (via `VesselClient.config.authToken`), so the information is present — it just is not being extracted and forwarded to the registry.

### The Activity→UI Gap

No existing activity template demonstrates the full local loop: MiniBob running a tool, producing a `ui_component` impulse, posting it to a discovered react-renderer, and a Playwright test asserting the iframe at `/view` updated. This makes the development feedback loop entirely manual.

## What Changes

### react-renderer

1. **Config loading** (`src/index.ts`, new `src/config-loader.ts`): Before calling `initializeDiscovery()`, load `~/.metabob/config.json` (same key paths as MiniBob's `UserConfig`) and use its values as fallbacks. Precedence: env var > project `.metabob/config.json` > `~/.metabob/config.json` > hardcoded default. After this change, `bun run dev` with no env exports connects to `https://discovery.metabob.com` automatically.

2. **Discovery always-on locally** (`src/index.ts`): The current check `process.env.DISCOVERY_ENABLED !== 'false'` means discovery runs when the env var is absent — this is already the right polarity. The change is to supply a meaningful default `discoveryEndpoint` from the config loader rather than the cluster-internal URL.

3. **Org-scoped registration** (`src/index.ts`): On startup, after loading the API key, call identity-vessel `POST /v1/keys/validate` with the key. Extract `org_id` from the response. Pass `orgId` in the `DiscoveryConfig` so `VesselClient.register()` includes it in the `RegisterRequest` body. The discovery-vessel `VesselRegistry.register()` already indexes by `orgId` — no changes needed there.

4. **`VESSEL_ENDPOINT` local default** (`src/index.ts`): When `VESSEL_ENDPOINT` is not set, default to `http://localhost:${PORT}` instead of the cluster-internal URL, so the registered endpoint is reachable from the developer's machine.

### MiniBob

No source changes. MiniBob's `vessel-discovery.ts` already queries for vessels by shape. When react-renderer is correctly registered with the caller's `orgId`, the registry's `findByShape()` will return it. The query already propagates `orgId` from MiniBob's authenticated context.

### New Activity Template (react-renderer repo)

A new activity template `templates/render-file-tree.json` that:
- Runs `find <directory> -maxdepth 2 -type f` via a `bash` resolver task
- Formats output as a `data-table` primitive (columns: `path`, `size`, `modified`)
- POSTs the resulting impulse to the discovered react-renderer endpoint

### Playwright Test (new file)

`test/e2e/local-discovery.test.ts` in the react-renderer repo: starts both servers, triggers the `render-file-tree` activity via MiniBob CLI, then asserts the `/view` iframe updates within 5 seconds.

## Capabilities Added / Modified

| Component | Change Type | Summary |
|-----------|-------------|---------|
| react-renderer config loading | New | Reads `~/.metabob/config.json` as fallback, same pattern as MiniBob |
| react-renderer discovery registration | Modified | Includes `orgId` derived from identity-vessel key validation |
| react-renderer local endpoint default | Modified | `http://localhost:PORT` when `VESSEL_ENDPOINT` unset |
| `render-file-tree` activity template | New | Bash → data-table → react-renderer pipeline |
| E2E Playwright test | New | Automated assertion of full local loop |

## Impact

### Files Changed Per Repo

**`repos/react-renderer/`**
- `src/index.ts` — `initializeDiscovery()` reads loaded config; calls identity-vessel for `orgId`; defaults `VESSEL_ENDPOINT` to `localhost`
- `src/config-loader.ts` — new file, mirrors MiniBob's config priority pattern
- `templates/render-file-tree.json` — new activity template
- `test/e2e/local-discovery.test.ts` — new Playwright test

**`repos/minibob/`**
- No source changes

**`repos/discovery-vessel/`**
- No changes (org isolation already implemented in `registry.ts`)

**`packages/vessel-discovery-client/`**
- No changes (`DiscoveryConfig` already has `orgId` field — verify in Task 2.3)

### Breaking Changes

None. All changes are additive or fix silent failures. The discovery opt-out (`DISCOVERY_ENABLED=false`) remains honoured. Vessels without an `orgId` still register and are visible to org-unscoped queries, preserving backward compatibility with k8s deployments that do not pass an org.
