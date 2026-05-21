# Spec — raw-key-stash-cleanup

## ADDED Requirements

### Requirement: Dashboard MUST NOT persist raw API key material in sessionStorage
After this change, no code path in `metabob-cloud-dashboard` writes the raw `secret` field returned from `/v2/api-keys` to `window.sessionStorage`. The Usage tab functions using only `api_key_id`.

#### Scenario: Creating a key does not stash raw material
- **GIVEN** the user clicks "Create API Key" and the create mutation returns `{ key: { id }, secret }`
- **WHEN** the response is processed
- **THEN** `window.sessionStorage.getItem("metabob_raw_api_keys")` is unchanged (still null or pre-existing entries only)

#### Scenario: Usage tab renders for a freshly created key
- **GIVEN** a newly created `api_key_id`
- **WHEN** the user opens the /mcp Usage tab and selects that key
- **THEN** `GET /api/mcp/usage?api_key_id=<id>` resolves and the tab renders the zero-shape body (`total_calls=0`) without consulting any raw-key stash

### Requirement: BFF `/api/mcp/usage` MUST be GET-only
`POST /api/mcp/usage` returns `405 Method Not Allowed`. The only accepted shapes are `GET /api/mcp/usage?api_key_id=<id>` (single-key) and `GET /api/mcp/usage` (org-scoped batch).

#### Scenario: Legacy POST is rejected
- **GIVEN** a client sends `POST /api/mcp/usage` with body `{ api_key_id, raw_key }`
- **WHEN** the BFF handles the request
- **THEN** the response status is `405` and no upstream call to user-vessel is made
