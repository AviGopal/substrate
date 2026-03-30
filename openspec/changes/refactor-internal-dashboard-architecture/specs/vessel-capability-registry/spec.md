# Specification: Vessel Capability Registry

## ADDED Requirements

### Requirement: Vessels declare resolvable impulse shapes

Each vessel SHALL declare the impulse shapes it can resolve in a capability registry. The registry entry MUST include `vessel_id`, `resolves` array, and `mcp_endpoint`.

#### Scenario: Valid capability declaration
- **WHEN** a vessel is registered in the capability registry
- **THEN** its entry includes `vessel_id` (string), `resolves` (array of shape names), and `mcp_endpoint` (URL)

#### Scenario: Multiple shapes supported
- **WHEN** a vessel can resolve multiple impulse types
- **THEN** all supported shapes are listed in the `resolves` array

### Requirement: Registry stored in metabob-proto

The vessel capability registry SHALL be defined in `repos/metabob-proto/src/vessel-registry.ts` as the single source of truth for vessel capabilities across the system.

#### Scenario: Proto package exports registry
- **WHEN** another package imports `@metabob/proto`
- **THEN** it can access the vessel capability registry via named export

#### Scenario: Registry is TypeScript-typed
- **WHEN** accessing the registry
- **THEN** all entries conform to the `VesselCapability` interface with proper type safety

### Requirement: Router selects vessel by impulse shape

An impulse router SHALL use the capability registry to find which vessel can resolve a given impulse based on its `shape` field.

#### Scenario: Shape matches single vessel
- **WHEN** an impulse has `shape: "activityListRequest"` and only one vessel declares it in `resolves`
- **THEN** the router selects that vessel for resolution

#### Scenario: Shape matches no vessel
- **WHEN** an impulse has a shape not declared in any vessel's `resolves` list
- **THEN** the router throws an error indicating no resolver is available

#### Scenario: Shape matches multiple vessels
- **WHEN** multiple vessels declare the same shape in their `resolves` list
- **THEN** the router selects the first matching vessel (or uses a priority/strategy if defined)

### Requirement: Dynamic vessel discovery

Vessels can be added to or removed from the registry without modifying client code. Clients SHALL use the registry for routing instead of hardcoded service URLs.

#### Scenario: New vessel added
- **WHEN** a new vessel with unique impulse shapes is added to the registry
- **THEN** clients automatically route matching impulses to the new vessel without code changes

#### Scenario: Vessel endpoint changed
- **WHEN** a vessel's MCP endpoint URL changes in the registry
- **THEN** clients use the updated endpoint on next impulse resolution without redeployment

### Requirement: Registry format supports metadata

Capability entries MAY include optional metadata fields beyond the required `vessel_id`, `resolves`, and `mcp_endpoint` for future extensions (e.g., priority, health checks, rate limits).

#### Scenario: Optional metadata present
- **WHEN** a registry entry includes optional fields like `priority` or `version`
- **THEN** the entry is still valid and core routing works correctly

#### Scenario: Router ignores unknown metadata
- **WHEN** a registry entry has metadata fields the router doesn't understand
- **THEN** the router processes the entry without error, using only required fields
