## ADDED Requirements

### Requirement: Callback props stored in refs to prevent reconnect storm
`useWebSocket` SHALL store `onOpen`, `onClose`, `onMessage`, and `onError` callback props in `useRef` values that are updated on every render via `useEffect`. The `connect` useCallback SHALL read callbacks exclusively from these refs at event time. The `connect` useCallback's dependency array SHALL NOT include `onOpen`, `onClose`, `onMessage`, or `onError`.

#### Scenario: New onMessage prop does not trigger reconnect
- **WHEN** a parent component re-renders and passes a new inline `onMessage` function reference to `useWebSocket`
- **THEN** the existing WebSocket connection is NOT torn down and the new callback is used for the next incoming message without reconnecting

#### Scenario: connect identity is stable across renders
- **WHEN** `useWebSocket` re-renders due to unrelated parent state changes with the same primitive options (`url`, `autoReconnect`, `reconnectBaseDelayMs`, `maxReconnectAttempts`)
- **THEN** the `connect` function reference does NOT change and the `useEffect` that calls `connect` does NOT re-fire

#### Scenario: Latest callback is always invoked
- **WHEN** the caller updates its `onMessage` handler after the WebSocket is already connected
- **THEN** the updated handler is called for all subsequent messages without any reconnect

#### Scenario: Callback ref is initialized before first connect
- **WHEN** `useWebSocket` mounts and `connect` fires for the first time
- **THEN** `onMessageRef.current` is already set to the latest `onMessage` prop value so no message is processed with a stale handler
