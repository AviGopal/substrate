## ADDED Requirements

### Requirement: Hook fetches vessel registry from discovery-vessel
The `useVesselRegistry` hook SHALL query `VITE_DISCOVERY_ENDPOINT + "/resolve"` with body `{ pointer: { type: "vesselRegistry" } }` and return a list of registered vessels. Each vessel record SHALL include: `vesselId`, `name` (or vesselId when name is absent), `endpoint`, `resolve_endpoint`, `shapes` (string array), `health` (`"healthy" | "degraded" | "unknown"`), and `lastSeen` (ISO timestamp string).

#### Scenario: Discovery-vessel returns registered vessels
- **WHEN** the hook mounts and `VITE_DISCOVERY_ENDPOINT` is set
- **THEN** the hook issues a POST to `{VITE_DISCOVERY_ENDPOINT}/resolve` with `{ pointer: { type: "vesselRegistry" } }`
- **THEN** the hook returns an array of vessel objects with the specified fields

#### Scenario: No discovery endpoint configured
- **WHEN** `VITE_DISCOVERY_ENDPOINT` is empty or undefined
- **THEN** the hook returns an empty array and does not attempt any network request

#### Scenario: Discovery-vessel request fails
- **WHEN** the fetch to discovery-vessel throws or returns a non-2xx response
- **THEN** the hook returns an empty array and exposes `error` with the failure details
- **THEN** no unhandled exception propagates to the caller

### Requirement: Hook filters results to executor-capable vessels
The hook SHALL filter the registry response to include only vessels that advertise the `goalExecution` shape in their `shapes` array.

#### Scenario: Mixed registry with executor and non-executor vessels
- **WHEN** discovery-vessel returns vessels with and without `goalExecution` in shapes
- **THEN** the hook returns only vessels that include `goalExecution`

#### Scenario: No executor vessels registered
- **WHEN** no vessel in the registry advertises `goalExecution`
- **THEN** the hook returns an empty array

### Requirement: Hook polls every 30 seconds with staleTime of 15 seconds
The hook SHALL use React Query (`useQuery`) with `refetchInterval: 30_000` and `staleTime: 15_000`. The query key SHALL be `["vessels", "registry"]`.

#### Scenario: Initial fetch followed by automatic refresh
- **WHEN** the hook is mounted and the query succeeds
- **THEN** a subsequent refetch is scheduled 30 s later without user interaction

#### Scenario: Cached data served within stale window
- **WHEN** the hook is mounted and a cached result is less than 15 s old
- **THEN** the hook returns the cached data immediately without a network request

### Requirement: Hook exposes loading and error state
The hook SHALL return `{ vessels, isLoading, error }`. `isLoading` SHALL be `true` during the initial fetch only. `error` SHALL be `null` when no error has occurred.

#### Scenario: Loading state during first fetch
- **WHEN** the hook mounts and no cached data exists
- **THEN** `isLoading` is `true` and `vessels` is an empty array

#### Scenario: Error state after failed fetch
- **WHEN** the fetch fails
- **THEN** `error` is a non-null Error instance and `vessels` is an empty array
