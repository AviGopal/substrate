## Why

We need an internal observability dashboard that lets the team explore system state through natural language queries. Unlike the conventional customer-facing dashboard (repos/metabob-cloud-dashboard), this dashboard uses MiniBob as the backend "brain" to dynamically control the UI through impulse execution. This creates a powerful exploration tool where MiniBob can query deployments, data, services, and composition graphs—rendering appropriate visualizations on demand.

**Key Insight:** The strength of this paradigm is that we can render a UI for any data we have access to in any way that we are able. MiniBob processes queries through its goal processor, either finding matching activity templates via Thompson Sampling or improvising. Successful improvisations are automatically extracted into reusable templates via Ribosome, making the system self-improving.

## What Changes

- **New repository**: `repos/metabob-internal-dashboard` - React 19 + Bun + shadcn/ui frontend
- **New Helm chart**: `helm/charts/metabob-internal-dashboard/` for Kubernetes deployment
- **Helmfile integration**: Add release to `helm/activity-system-minimal.yaml.gotmpl`
- **New Istio routing**: `internal.metabob.{local|com}` virtual service
- **MiniBob integration**: WebSocket/HTTP connection from dashboard to MiniBob for query execution
- **UI-as-impulse architecture**: UI components treated as impulses that MiniBob can create, modify, position, and destroy

## Capabilities

### New Capabilities

- `impulse-driven-ui`: Architecture where UI components are proper impulse pointer types (`ui_component`) following impulse-pointer-mvp patterns. UI impulses reference data impulses via `dataRef`, include `metadata` for LLM reasoning, and the dashboard acts as a "visual resolver". Components have type, position, size, and data bindings.
- `query-interface`: Floating centered text input for natural language queries. Persists through all UI states. Sends queries to MiniBob for processing.
- `dynamic-rendering`: System for MiniBob to render responses as appropriate component types (tables, graphs, JSON, narrative, actions, system_health). Component selection based on data shape and query intent.
- `system-introspection`: MiniBob tools for querying deployment state (k8s pods/services), SurrealDB data, connected services health, org/user/instance data, composition graphs, and observation-hierarchy metrics (system health, circuit breaker, tool patterns, peer anomalies).

### Modified Capabilities

- `minibob-tools`: Add tools for UI component manipulation (create_component, update_component, delete_component) and system introspection (query_kubernetes, query_surrealdb, query_system_health, query_tool_patterns, query_composition_patterns, query_peer_anomalies, get/set_circuit_breaker)

## Impact

**Code Changes:**
- `repos/metabob-internal-dashboard/`: New React frontend with impulse-driven component system
- `repos/minibob/src/tools.ts`: Add UI control and system introspection tools
- `repos/minibob/templates/`: Add internal-dashboard query handling templates

**API Changes:**
- MiniBob gains WebSocket endpoint for streaming UI updates
- New impulse pointer types for UI components

**Deployment:**
- New Helm chart in `helm/charts/metabob-internal-dashboard/`
- New release in `helm/activity-system-minimal.yaml.gotmpl`
- Istio VirtualService for `internal.metabob.local` routing

**Dependencies:**
- Requires MiniBob v0.1.x with understanding system
- Requires activity-api for execution trace queries
- Optional: Kubernetes API access for deployment introspection
- **Depends on**: `impulse-pointer-mvp` (impulse metadata and dataRef pattern for ui_component pointer type)
- **Depends on**: `observation-hierarchy-foundation` (system health, circuit breaker, multi-scale metrics endpoints)
