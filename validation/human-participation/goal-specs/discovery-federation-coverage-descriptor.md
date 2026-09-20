# Attach an honest federation `coverage` descriptor in `repos/discovery-vessel/src/index.ts`

Change `repos/discovery-vessel/src/index.ts` so `forwardToPeers` returns per-peer OUTCOMES
instead of discarding them, and so the `/resolve` response for `vesselCapability` and
`vesselRegistry` carries a `coverage` descriptor.

## 2. Current behaviour (quoted, file:line)

`repos/discovery-vessel/src/index.ts`

- `:62-96` — `forwardToPeers(...)` returns `Promise<Array<Record<string, unknown>>>`; rows only.
- `:84` — `      if (!res.ok) return` — the peer's HTTP status is destroyed. A peer that
  answers `401` is indistinguishable from a peer that answered nothing.
- `:94` — `    } catch { /* peer unreachable / timed out — skip it; the local result stands */ }`
  — the error class is destroyed. This is what makes a **misconfigured** peer byte-identical
  to **no peers configured**.
- `:272-297` union merge — `:280` `const localIds = new Set((cap.vessels ?? []).map((v) => String(v.vesselId ?? "")))`,
  `:284-291` `const usable = peerVessels.filter(...)` returning
  `dialable && !selfEcho && !localIds.has(String(v.vesselId ?? ""))`, `:292` `if (usable.length > 0) {`.
  Three distinct drop causes (`not_dialable`, `self_echo`, id collision) collapse into one
  silent `usable.length === 0`. Local ui vessels register **bare** ids
  (`repos/human-surface-vessel/src/discovery-registration.ts:36` `vesselId: VESSEL_ID`), so a
  remote bare `stateful-ui-vessel` is dropped WHOLE by `localIds.has`.
- `:218` `const DISCOVERY_SHAPES = [...]` is the only other `vesselRegistry` mention:
  **`vesselRegistry` does not fan out to peers today.** Do NOT add peer forwarding for it.

## 3. Required behaviour (predicate)

1. `forwardToPeers` returns `{ vessels, outcomes }` where `outcomes: Array<{ peer: string,
   status: "answered" | "unreachable" | "empty", rows: number, as_of: string | null,
   reason: string | null }>`. One entry per configured peer, **always** — never a short array.
   - transport/URL throw → `status:"unreachable"`, `reason` = the error `code` when present
     (`ERR_INVALID_URL`, `TimeoutError`, `ENOTFOUND`), else the message's first 80 chars.
   - `!res.ok` → `status:"unreachable"`, `reason: "http_" + res.status`.
   - ok with `>0` rows → `status:"answered"`, `rows` = row count, `as_of` = max
     `lastSeen` across returned rows (ISO string) or `null`.
   - ok with `0` rows → `status:"empty"`, `reason: "no_producers"`.
2. Drop causes from the merge are recorded per peer as additional `reason` counters:
   `self_echo`, `not_dialable`, `local_id_collision`. A peer whose every row was dropped
   stays `status:"answered"` with `rows` = rows received and a `drops` object
   `{ self_echo, not_dialable, local_id_collision }` — it must NEVER become `unreachable`.
3. The response object built at `:300-308` gains a sibling `coverage`:
   `{ owners_queried: string[], owners_answered: [{peer, rows, as_of}],
      owners_unreachable: [{peer, reason}], owners_empty: string[],
      coverage_fraction: number, coverage_denominator: string, as_of: string }`
   - `owners_queried` = `["self", ...currentPeerEndpoints()]`. With no peers it is `["self"]`.
   - `coverage_fraction` = answered-or-empty / `owners_queried.length`; `1` in the
     self-only case.
   - `coverage_denominator` is explicit prose, same convention as
     `scripts/substrate/federation-relay/federation-probe-tick.ts:1265`
     (`'invariant x applicable-config-class; undecidable does NOT count as decided'`):
     use `"configured owner endpoints plus self; unreachable does NOT count as covered"`.
   - `as_of` = `new Date().toISOString()` (observation time), distinct from per-owner `as_of`.
4. **MINT NO SHAPE.** Reuse: `coverage_fraction` + prose `coverage_denominator`
   (`federation-probe-tick.ts:1264-1265`); answered / unreachable-with-reason / empty mirrors
   that file's `pass | fail | undecidable` + `undecidable_reason` (`:56`, `:71`); freshness
   uses the registry row's existing `lastSeen` (`repos/discovery-vessel/src/types.ts:340`)
   the way `federation-probe-tick.ts:905-907` does, and the age/fresh pair is named after
   `scripts/substrate/federation-relay/federation-transport-server.ts:558-559`
   (`report_age_ms` / `report_is_fresh`) if an age field is added.
5. Degenerate case is part of the contract: with no peers the response still carries a
   well-formed descriptor, and `coverage` must NEVER gate or filter `content.vessels` /
   `content.found`. A locally reachable activity stays reachable regardless of coverage.
6. **Reader (or this is hollow):** the falsifier test in
   `repos/discovery-vessel/test/federation-coverage.test.ts` asserts every field. The
   descriptor is also the runtime detector for "a configured peer never answered once" —
   with today's live config it must surface
   `owners_unreachable:[{peer:'http://syzygy.host:18100""', reason:"ERR_INVALID_URL"}]`.

## 4. What must NOT change

- `repos/discovery-vessel/src/types.ts` — **byte-identical**. Do not widen the
  `ResolveResponse` interface (`:429-436`); one file per goal. Build the response in
  `index.ts` with a locally widened type
  (`const response: ResolveResponse & { coverage?: Coverage } = { ... }`).
  Adding the interface field is a separate follow-up goal.
- `content.vessels`, `content.found`, and `metadata` must be byte-identical to today for
  every input that reaches them, including the union-merge admission predicate at `:284-291`
  — this change OBSERVES the filter, it does not change which rows survive it.
- `forwardResolveToPeers` (`:103-130`, incl. its own `catch { }` at `:127`) is out of scope.
- No peer forwarding added for `vesselRegistry`.

## 5. Falsifier — `repos/discovery-vessel/test/federation-coverage.test.ts`

Runs entirely against a locally constructed app + a stub peer; no live substrate writes.

- **(a) one unreachable peer ≠ no peers.** Resolve `{type:"vesselCapability",shape:"uiQuestion"}`
  twice: once with `PEER_DISCOVERY_ENDPOINTS="http://127.0.0.1:1"` (connection refused), once
  with it empty. Assert the two `coverage` objects DIFFER, and specifically assert
  `owners_unreachable[0].reason` is a non-empty string and `owners_unreachable[0].peer ===
  "http://127.0.0.1:1"`. Asserting only that a `coverage` key exists is NOT a pass — a
  `coverage:{}` stub would satisfy that. Today both responses are identical once `resolvedAt`
  is removed; assert that too, so the test fails pre-change.
- **(b) positive control, same run, same address form.** Start a stub HTTP peer on an
  ephemeral port answering `200 {"content":{"vessels":[]}}`. Point
  `PEER_DISCOVERY_ENDPOINTS` at it. Assert the stub peer appears in `owners_empty` (and/or
  `owners_answered` with `rows:0`) and is **absent from `owners_unreachable`**. Then, in the
  same test, a second stub answering `401` must appear in `owners_unreachable` with
  `reason === "http_401"`. Answered-empty vs unreachable must be distinguishable at the same
  address form — that is the control for leg (a)'s negative.
- **(c) degenerate case.** No peers: assert `coverage.owners_queried` deep-equals `["self"]`,
  `owners_unreachable` is `[]`, `coverage_fraction === 1`, `typeof coverage_denominator ===
  "string"` and non-empty, `Date.parse(coverage.as_of)` is finite; and assert
  `content.vessels` is deep-equal to the same resolve with `coverage` stripped — i.e. the
  descriptor did not gate participation.
- **Drop-cause leg.** A stub peer returning one row with `vesselId` equal to a locally
  registered bare id must yield that peer `status:"answered"` with
  `drops.local_id_collision === 1` and must NOT appear in `owners_unreachable`.
- **Not coverable by this test:** a real libp2p-circuit peer, and cross-substrate auth
  (`HUB_API_KEY`) — both need the live hub. Name that skip in the test output.

## 6. Risks and blast radius

- `/resolve` is the fixed point every vessel calls. An extra top-level sibling is additive;
  no known reader enumerates response keys, but the risk is real — hence the byte-identity
  requirement on `content` and `metadata` in §4.
- `forwardToPeers`'s return type changes; it has exactly one call site (`:275`). Grep
  `forwardToPeers` and confirm the count before editing.
- Response size grows by one small object per configured peer (currently 1).
- Once landed, the descriptor will immediately report the live config defect as
  `ERR_INVALID_URL`. That is the intended first finding, not a regression.
