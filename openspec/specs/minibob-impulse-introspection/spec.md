# minibob-impulse-introspection Specification

## Purpose
TBD - created by archiving change workbench-vessel-selector. Update Purpose after archive.
## Requirements
### Requirement: MiniBob exposes GET /impulses endpoint
MiniBob's HTTP server SHALL handle `GET /impulses` and return a JSON response with status 200. The response body SHALL conform to:
```
{
  impulses: Array<{
    id: string,
    shape: string,
    pointer_type: string,
    loaded: boolean,
    summary: string | null
  }>
}
```
The `shape` field SHALL be taken from `impulse.metadata.shape`. The `pointer_type` field SHALL be taken from `impulse.pointer.type`. The `summary` field SHALL be taken from `impulse.metadata.summary` when present, otherwise `null`.

#### Scenario: MiniBob has impulses in memory
- **WHEN** `GET /impulses` is requested and the in-memory store contains two impulses
- **THEN** the response is `{ impulses: [ ... ] }` with two entries and status 200
- **THEN** each entry contains `id`, `shape`, `pointer_type`, `loaded`, and `summary`

#### Scenario: MiniBob has no impulses in memory
- **WHEN** `GET /impulses` is requested and the in-memory store is empty
- **THEN** the response is `{ impulses: [] }` with status 200

### Requirement: GET /impulses returns CORS headers
The `GET /impulses` response SHALL include `Access-Control-Allow-Origin: *` and `Access-Control-Allow-Methods: GET, OPTIONS` headers, consistent with other MiniBob endpoints that are accessed from browser clients.

#### Scenario: Browser client fetches impulse list
- **WHEN** a browser issues `GET /impulses` with an `Origin` header
- **THEN** the response includes `Access-Control-Allow-Origin: *`

#### Scenario: CORS preflight OPTIONS request
- **WHEN** a browser issues `OPTIONS /impulses`
- **THEN** the response has status 204 and includes the required CORS headers

### Requirement: ImpulseStore exposes getAllImpulses() public method
The `ImpulseStore` class SHALL expose a `getAllImpulses(): Impulse[]` method that returns all impulses currently held in the private `impulses` Map. The method SHALL return a new array (not the Map reference itself) so callers cannot mutate store state.

#### Scenario: getAllImpulses returns a snapshot
- **WHEN** `getAllImpulses()` is called on a store with three impulses
- **THEN** it returns an array of length 3
- **THEN** mutating the returned array does not affect the store's internal Map

### Requirement: GET /impulses does not require authentication
The endpoint SHALL be served without requiring an `Authorization` header, consistent with the existing `/health`, `/status`, and `/manifest` endpoints in MiniBob.

#### Scenario: Unauthenticated request
- **WHEN** `GET /impulses` is requested with no Authorization header
- **THEN** the response is 200 with the impulse list (not 401 or 403)

