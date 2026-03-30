# Specification: Impulse Reference Protocol

## ADDED Requirements

### Requirement: WebSocket messages use impulse IDs

WebSocket messages between UI vessel and clients SHALL reference impulses by ID string rather than serializing full impulse content in every message.

#### Scenario: Impulse create message includes full impulse
- **WHEN** a new impulse is added to the state space
- **THEN** the vessel broadcasts an `impulse_create` message with the complete impulse object (initial sync)

#### Scenario: Impulse update message uses patch
- **WHEN** an existing impulse is modified
- **THEN** the vessel broadcasts an `impulse_update` message with `impulseId: string` and only the changed fields in a `patch` object

#### Scenario: Impulse delete message uses ID only
- **WHEN** an impulse is removed from the state space
- **THEN** the vessel broadcasts an `impulse_delete` message with only `impulseId: string`

### Requirement: Client maintains local impulse map

The client (React frontend) SHALL maintain a Map<string, Impulse> of all impulses received, indexed by impulse ID for efficient lookups.

#### Scenario: Impulse stored in map on create
- **WHEN** client receives an `impulse_create` message
- **THEN** it adds the impulse to its local map with key `impulse.id`

#### Scenario: Impulse updated in map via patch
- **WHEN** client receives an `impulse_update` message
- **THEN** it retrieves the impulse from the map by ID and applies the patch fields

#### Scenario: Impulse removed from map on delete
- **WHEN** client receives an `impulse_delete` message
- **THEN** it deletes the entry from the map using the impulse ID

### Requirement: References are lazy-loaded

When an impulse references another impulse (e.g., query result references the original query), it SHALL use the impulse ID rather than embedding the full impulse object.

#### Scenario: Query result references query impulse
- **WHEN** a `queryResult` impulse is created for a user query
- **THEN** it has `pointer.query_impulse_id: string` instead of embedding the full query impulse

#### Scenario: Client resolves reference by lookup
- **WHEN** rendering a component that needs to display the original query
- **THEN** the client looks up the referenced impulse by ID from its local map

### Requirement: State sync on reconnect

When a WebSocket client connects or reconnects, the server SHALL send a `state_sync` message with all current impulses to initialize the client's state.

#### Scenario: Initial connection state sync
- **WHEN** a client first connects to the WebSocket
- **THEN** the server sends a `state_sync` message with `impulses: Impulse[]` containing all active impulses

#### Scenario: Reconnect state sync
- **WHEN** a client reconnects after a disconnection
- **THEN** the server sends a fresh `state_sync` message to ensure the client has current state

#### Scenario: Incremental updates after sync
- **WHEN** a client has received a state sync
- **THEN** subsequent updates use `impulse_update` patches rather than resending full impulses

### Requirement: Message format is versioned

WebSocket messages SHALL include a `type` field for message discrimination and support future protocol extensions without breaking existing clients.

#### Scenario: Message type discriminates handling
- **WHEN** a client receives a WebSocket message
- **THEN** it checks the `type` field to determine how to process the message

#### Scenario: Unknown message types ignored
- **WHEN** a client receives a message with an unknown `type`
- **THEN** it logs a warning but does not crash or error

### Requirement: Bandwidth optimization via references

The impulse reference protocol SHALL reduce WebSocket bandwidth by avoiding redundant full impulse serialization.

#### Scenario: Large impulse updated efficiently
- **WHEN** an impulse with large `content` (e.g., 10KB of data) has a single field updated
- **THEN** the update message contains only the impulse ID and the changed field (e.g., 100 bytes) instead of resending 10KB

#### Scenario: Multiple references avoid duplication
- **WHEN** ten UI components reference the same impulse
- **THEN** the impulse is sent once in `impulse_create` and referenced by ID in components, not serialized ten times

### Requirement: Garbage collection of unused impulses

The server MAY delete impulses from the state space that are no longer referenced by active UI components, and clients MUST handle `impulse_delete` messages gracefully.

#### Scenario: Unused impulse cleaned up
- **WHEN** an impulse is not referenced by any active UI component for a threshold period
- **THEN** the server sends an `impulse_delete` message and removes it from state

#### Scenario: Client handles missing reference
- **WHEN** a component tries to render an impulse that was deleted
- **THEN** the client handles the missing impulse gracefully (e.g., shows placeholder or requests re-sync)
