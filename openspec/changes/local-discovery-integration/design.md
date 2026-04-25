# Design

## 1. Config Loading Precedence

React-renderer adopts the same three-level priority chain already implemented in `repos/minibob/src/config.ts`:

```
Priority 1 (highest): Environment variable
Priority 2:           .metabob/config.json   (project root of the react-renderer repo)
Priority 3:           ~/.metabob/config.json (user home)
Hardcoded default:    (lowest)
```

### New file: `src/config-loader.ts`

Exports a single async function `loadRendererConfig()` returning:

```typescript
interface RendererConfig {
  discoveryEndpoint: string   // where to register
  metabobApiKey: string       // used for registration auth + identity validation
  identityEndpoint: string    // for /v1/keys/validate call
  vesselEndpoint: string      // what URL to advertise in the registry
  discoveryEnabled: boolean   // false only if DISCOVERY_ENABLED=false explicitly
}
```

Key paths read from `~/.metabob/config.json`:

| Field | JSON path(s) |
|---|---|
| `metabobApiKey` | `metabob.apiKey` → `instance.apiKey` |
| `discoveryEndpoint` | `discovery.endpoint` → default `https://discovery.metabob.com` |
| `identityEndpoint` | parsed from API key `iss` field → default `https://identity.metabob.com` |
| `vesselEndpoint` | `process.env.VESSEL_ENDPOINT` → `http://localhost:${PORT}` |

The `discovery.endpoint` key is not currently in most user configs; `https://discovery.metabob.com` is the correct default for all developers targeting canary.

---

## 2. Org ID Flow: API Key → Identity Validation → Registration → Discovery Filtering

```
react-renderer startup
───────────────────────────────────────────────────────────

1. loadRendererConfig()
   reads METABOB_API_KEY || ~/.metabob/config.json → metabob.apiKey
   → apiKey = "mb-..."

2. resolveOrgId(apiKey, identityEndpoint)
   POST https://identity.metabob.com/v1/keys/validate
   body: { api_key: apiKey }
   response: { success: true, data: { valid: true, org_id: "metabob", ... } }
   → orgId = "metabob"
   (on failure: log warning, orgId = undefined — registration proceeds without org scope)

3. new VesselClient({ ..., orgId, authToken: apiKey })
   VesselClient.register() POSTs to discovery-vessel /register:
   { vesselId, vesselName, shapes, endpoint, orgId: "metabob", ... }

4. VesselRegistry.register() in discovery-vessel:
   orgIndex["metabob"].add("react-renderer-local")
   shapeIndex["ui_component"].add("react-renderer-local")

MiniBob query
───────────────────────────────────────────────────────────

5. MiniBob calls vessel discovery for shape "ui_component"
   propagates orgId from authenticated API key context

6. VesselRegistry.findByShape("ui_component", { orgId: "metabob" }):
   filter: !v.orgId || v.orgId === "metabob"
   → returns react-renderer-local  (orgId matches)
   → does NOT return vessels registered under other orgs
```

### Identity Endpoint Derivation

API keys embed the issuer URL in their payload: `mb-[base64(payload)]-[sig]`. The base64 payload includes an `iss` field pointing to the identity-vessel that issued the key. `parseIdentityEndpoint()` decodes this to know which identity-vessel to call for validation. Fallback: `https://identity.metabob.com`.

### Validation Failure Handling

If identity-vessel is unreachable or returns an invalid-key response, react-renderer logs:
```
[Discovery] Warning: could not resolve orgId from identity-vessel (will register without org scope)
```
Registration proceeds with `orgId: undefined`. This preserves startup resilience while making the gap visible in logs.

---

## 3. Activity → Impulse → react-renderer → WebSocket → iframe Update Chain

```
minibob --single "show me the file tree for /home/avi/documents/work/exp-repo"

MiniBob:
  1. Thompson Sampling / template matching selects "render-file-tree"
  2. Task: scan-directory  (bash resolver)
     find /path -maxdepth 2 -type f -printf '%p\t%s\t%TY-%Tm-%Td\n'
     → bash_output impulse

  3. Task: format-as-table  (llm resolver)
     Parses bash_output into { columns: ["path","size","modified"], data: [...] }
     → ui_component impulse { primitive: { type: "data-table", ... } }

  4. Task: post-to-renderer  (http resolver with discoveryShape)
     Queries discovery for "ui_component"
     → react-renderer at http://localhost:3000
     POST http://localhost:3000/impulses  { primitive: { type: "data-table", ... } }

react-renderer:
  5. POST /impulses handler → impulseStore.create(impulse)
  6. broadcaster.broadcast({ type: "impulse_create", impulse })
  7. WebSocket sends to all sessions

Browser (/view):
  8. ws.onmessage → { type: "impulse_create", impulse }
  9. impulses.set(id, impulse), redraw()
  10. renderPrimitive({ type: "data-table", ... }) → <table> in DOM
```

### render-file-tree Template Structure

```json
{
  "id": "render-file-tree",
  "description": "Run find on a directory and render result as a data-table in react-renderer",
  "category": "ui",
  "input_shapes": ["goal"],
  "output_shapes": ["render_receipt"],
  "tasks": [
    {
      "id": "scan-directory",
      "resolver": "bash",
      "config": {
        "command": "find {{directory}} -maxdepth 2 -type f -printf '%p\\t%s\\t%TY-%Tm-%Td\\n' 2>/dev/null | head -100"
      },
      "outputShapes": ["bash_output"]
    },
    {
      "id": "format-as-table",
      "resolver": "llm",
      "prompt": {
        "template": "Parse the following find output into a JSON object with exactly two keys: 'columns' (array [\"path\",\"size\",\"modified\"]) and 'data' (array of row objects). Return only valid JSON, no explanation.\n\nFind output:\n{{bash_output}}"
      },
      "inputShapes": ["bash_output"],
      "outputShapes": ["ui_component"]
    },
    {
      "id": "post-to-renderer",
      "resolver": "http",
      "config": {
        "discoveryShape": "ui_component",
        "method": "POST",
        "path": "/impulses"
      },
      "inputShapes": ["ui_component"],
      "outputShapes": ["render_receipt"]
    }
  ],
  "variables": [
    { "name": "directory", "type": "string", "required": true,
      "description": "Directory path to scan" }
  ]
}
```

The `http` resolver with `discoveryShape` queries discovery at runtime, picks the highest-confidence vessel for `ui_component`, and POSTs the impulse body to its `/impulses` endpoint. No vessel endpoint is hardcoded in the template.

---

## 4. Playwright Verification Strategy

### What to Assert

| Step | Selector / Assertion |
|---|---|
| Page loads | HTTP 200 on `GET /view` |
| Initial state | `.empty` div visible (no impulses yet) |
| After dispatch | `table` element present in DOM |
| Column headers | `th:first-child` contains "path" |
| Row data | `tbody tr` count > 0 |
| WS connected | Status indicator text "connected" |

### Timing

`page.waitForSelector('table', { timeout: 5000 })` is the gate. Dispatch is a background process; the table appearing confirms the full chain (activity → impulse → POST → broadcast → WS → DOM) completed.

### CI Exclusion

The test is tagged `@local-only` and excluded from the default `bun test` run via Playwright config project filters. It runs only under `bun test --grep @local-only` or in an explicit integration test job with real credentials.
