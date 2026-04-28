# vessel-impulse-state-panel Specification

## Purpose
Defines the `ImpulseStatePanel` "Vessel State" section: when a vessel is selected in the trajectory store, the panel polls the vessel's `/impulses` endpoint and subscribes to its WebSocket for `impulse:created` events, rendering the live set of unique shape names as badges so authors can see what shapes are currently present on a chosen vessel without leaving the workbench.
## Requirements
### Requirement: ImpulseStatePanel renders a "Vessel State" section when a vessel is selected
When `selectedVesselId` and `selectedVesselEndpoint` are non-null in the trajectory store, `ImpulseStatePanel` SHALL render a collapsible "Vessel State" section below the existing tabs. The section header SHALL display "Live shapes on {vesselName}" where `vesselName` is resolved from `useVesselRegistry` by matching `selectedVesselId`, falling back to `selectedVesselId` itself when no match is found.

#### Scenario: Vessel is selected and registry lookup succeeds
- **WHEN** `selectedVesselId` is "minibob-abc" and the registry has a vessel with name "MiniBob Dev"
- **THEN** the section header reads "Live shapes on MiniBob Dev"

#### Scenario: Vessel is selected but registry lookup finds no name
- **WHEN** `selectedVesselId` is "minibob-xyz" and no matching vessel is in the registry
- **THEN** the section header reads "Live shapes on minibob-xyz"

#### Scenario: No vessel selected
- **WHEN** `selectedVesselId` is `null`
- **THEN** the "Vessel State" section is not rendered

### Requirement: Panel polls GET /impulses on the selected vessel every 10 seconds for snapshot
When a vessel is selected, `ImpulseStatePanel` SHALL call `GET {selectedVesselEndpoint}/impulses` on mount and then every 10 s. The response SHALL be used to populate the initial set of live shapes displayed in the "Vessel State" section.

#### Scenario: Polling returns impulse list
- **WHEN** the vessel is selected and 10 s have passed
- **THEN** a new GET request is issued to `{selectedVesselEndpoint}/impulses`
- **THEN** the displayed shapes are updated to reflect the latest snapshot

#### Scenario: Poll request fails
- **WHEN** GET /impulses returns a non-2xx response or throws
- **THEN** the previously displayed shapes are retained
- **THEN** no error is surfaced to the user (silent degradation)

### Requirement: Panel subscribes to the selected vessel's WebSocket for impulse:created events
When a vessel is selected, `ImpulseStatePanel` SHALL open a `useWebSocket` connection to `${selectedVesselEndpoint}/ws`. On receiving a message with `type === "impulse:created"`, it SHALL extract `impulse.metadata.shape` and `impulse.pointer.type` and add them to the displayed live shape set.

#### Scenario: WebSocket emits impulse:created event
- **WHEN** the WS connection receives `{ type: "impulse:created", impulse: { metadata: { shape: "file" }, pointer: { type: "file" } } }`
- **THEN** "file" is added to the live shapes displayed in the "Vessel State" section

#### Scenario: WebSocket emits non-impulse:created event
- **WHEN** the WS connection receives a message with a type other than "impulse:created"
- **THEN** the live shapes set is unchanged

#### Scenario: WebSocket connection is lost
- **WHEN** the WS connection to the selected vessel drops
- **THEN** the panel retains the last-known shapes (does not clear them)
- **THEN** the WebSocket hook's built-in reconnect logic attempts to reconnect

### Requirement: Vessel State section renders shape badges
Each unique shape observed (from polling or WS) SHALL be rendered as a small badge showing the shape name. Duplicate shapes SHALL be deduplicated; only unique shape names are shown.

#### Scenario: Multiple impulses with the same shape
- **WHEN** polling returns three impulses all with shape "file"
- **THEN** exactly one "file" badge is rendered in the Vessel State section

#### Scenario: Impulses with different shapes
- **WHEN** polling returns impulses with shapes "file", "memo", and "gitDiff"
- **THEN** three separate badges are rendered, one for each shape

### Requirement: Vessel State section clears when a different vessel is selected
When `selectedVesselId` changes (a new vessel is selected), the accumulated live shapes SHALL be cleared and re-populated from the new vessel's polling and WS stream.

#### Scenario: User switches vessels
- **WHEN** the user connects to vessel B after having vessel A selected
- **THEN** the live shapes set is reset to empty
- **THEN** the WS subscription switches to vessel B's endpoint
- **THEN** polling is directed to vessel B's endpoint

