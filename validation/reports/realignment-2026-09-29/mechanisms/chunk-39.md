# Mechanism chunk 39: stateful-ui-vessel

Area: `stateful-ui-vessel` (`repos/stateful-ui-vessel`, unit on substrate-live `:8270`).
Class history: `classes/human-surface-escalation.json` (38 attempts, 35 problems, 5 claims).
Live checks run 2026-09-29, read-only, on substrate-live.

## Dedupe

All 8 chunk entries name **one vessel**, reported by 7 sources (memory-3, memory-6,
validation-other-1, reports-4 and vessel-docs-tooling, openspec-8, openspec-9,
live-resolvers, git-small). Together they describe four distinct parts:

| # | Mechanism | Chunk entries folded in |
|---|---|---|
| A | The vessel and unit on `:8270` (the replaced human surface) | "stateful-ui-vessel :8270" x2, "stateful-ui-vessel face :8270", "stateful-ui-vessel" x3 |
| B | The panel/feedback store `/workspace/state/ui-panel-store.json` (becfa05, 08-28) | "stateful-ui-vessel panel store" |
| C | The `uiQuestion` read route (6dc8107, 08-28, "give the escalation channel a reader") | "stateful-ui uiQuestion reader + panel persistence" |
| D | `/api/signature-inputs` (operator presence, read by dev-vessel's state signature) | not named in the chunk; found live and included because it is a reader the retirement must move |

A related item sits outside the chunk but decides every verdict below: dev-vessel still
**pins** `:8270` in its callers. See "What keeps it alive".

## Live evidence (2026-09-29)

- Unit `stateful-ui-vessel` is `active`, started 2026-09-28 10:01 UTC, and registers itself in
  discovery ("[discovery] registered as stateful-ui-vessel"). `/health` → `{"panels":794}`.
  Beside it, `human-surface-vessel` `:8310` is active and serves the same 8 ui shapes plus 3 more
  (`/health`: 4170 panels, 500 feedback).
- The store is **still written**. `/workspace/state/ui-panel-store.json` (656 KB) had an mtime of
  2026-09-29 05:19. Panels created per day: 09-22 37, 09-23 54, 09-24 54, 09-25 69, 09-26 62,
  09-27 26, 09-28 16. Kinds across all panels: gap_needs_human 336, gap_pending_verification 270,
  gap_needs_localization 77, info 50, gap_reland_needs_human 26, question 21, code_change 11,
  plus one literal `{{goal}}` panel (an unrendered template leaking in).
- Feedback in the store: 5 entries in total, the latest a DURABILITY-PROBE dismiss on 09-25
  (raw/live-resolvers.md:164). **No human reads this surface.**
- Commits to the repo: 0056f17 (06-15, split), 6dc8107 and becfa05 (08-28, operator), then five
  substrate-authored mitosis cutovers: bfccbaf, 4670c72 and 1b447c6 (09-20), 48493bb (09-23),
  b9b5d8d (09-28). **The substrate is spending landings on a surface it has replaced.**
- The 8 registered shapes all have a second owner in human-surface; `uiPanel_write` and
  `uiQuestion_write` have a third owner in the dev-vessel passthrough. 6 of the 8 had no traced
  output in 30 days (raw/live-resolvers.md:165, :193, :195).

### What keeps it alive (grep in `/workspace/git/vessels/development-vessel/src`)

- `resolvers/ui-write-passthrough.ts:24-30`: `STATEFUL_UI_VESSEL_ENDPOINT ?? "http://127.0.0.1:8270"`
  POSTs to `/resolve`. The env var is unset in the unit and the env file, so the default is the
  live value. It is called from `routes/impulses.ts:629` and `docs-decision-solicit.ts:136`, and
  from `gap-to-feature.ts:1238` (needs-human), `:2913` (reland-needs-human), `:2939`
  (pending-verify) and `:5162`. Those 3 escalation kinds make up 632 of the 794 panels.
- `docs-decision-deliver.ts:42` and `docs-decision-answer-scan.ts:151` default to `:8270`.
  `solicitation-outcome-scan.ts:38` tries discovery first and then falls back to `:8270`.
- `compute-state-signature.ts:46,249` reads `:8270/api/signature-inputs` for **operator presence**.
  It returns `panels_open_count 790` and `unanswered_asks_age_ms_p95 ≈ 22.8 days`: a constant
  "operator absent" reading that no human could ever change. `human-surface :8310` also serves
  `/api/signature-inputs` (HTTP 200). The state signature therefore folds in a fossil's reading,
  though it could read the live surface.
- Seed prompts `seed/draft-gap-closing-activity.ts:118` and `seed/draft-activity-from-pattern.ts:138`
  teach the drafter `substrateGap_write → :8270/v2/impulses/resolve`. That address is doubly wrong,
  because dev-vessel serves `substrateGap_write`. `activity-create-variant.ts:639` and
  `author-composed-capability.ts:409` hardcode `:8270` in their allow and fallback lists.
- On node 2, stateful-ui is masked. The same pinned default there throws "Unable to connect" 2873
  times since 09-26 (class problem record, claim 1 "later"). This is the same cause wearing a
  different hat: a pinned peer instead of routing by shape (laws 1 and 11, decentralization).

### Recurrence (why this is THE failure)

- 2026-08-07: `human-surface-stack` declared stateful-ui retired (falsifier 5, design §4), and
  `do-anything-surface` cites that retirement. **It was never executed** (claims 3 and 4).
- 2026-09-22: memory recorded "248 escalations asked of a vessel no human reads". The diagnosis was
  filed, but neither the pin nor the unit changed. Panels went from 480 to 794 afterwards, and the
  substrate authored 3 more landings on it.
- The cause is the same every time: a writer pins a peer address, and a replacement that is
  declared but not cut over leaves two live owners with nothing comparing them.

## Verdicts

| Mechanism | Verdict | Used now | Where it goes |
|---|---|---|---|
| A. stateful-ui-vessel `:8270` | **duplicate-of** human-surface-vessel `:8310`, then **fossil** once the pins are moved | yes: written by pinned callers, read by no human | Retire the unit via `DISABLED_VESSELS` (or remove it from the profile manifest), then deregister its 8 shapes from discovery. The repo stays as history. Mark the submodule archived in the super-repo `repos/` listing, with the pointer "superseded by human-surface-vessel (human-surface-stack, 08-07)". |
| B. panel store `ui-panel-store.json` | **fossil**, archive the data | yes (written 09-29 05:19) | Snapshot it to the volume archive (`/workspace/state/archive/ui-panel-store-<date>.json`, gitignored runtime state). **Do not import it into human-surface wholesale**: 632 panels are gap escalations whose gaps have moved on, plus test residue (`{{goal}}`, the durability probe). If any carry value, re-derive them from the gap store (needs-human is a gap condition, not a stored panel). |
| C. `uiQuestion` read route (6dc8107) | **merge-into** human-surface-vessel `uiQuestion` (already served there, with the consumption link increment 1, 1704850a/cbd134e5) | no human reader. `solicitation_outcome_scan` resolves it discovery-first. | Nothing to port. Human-surface already owns the read side. Retire it with A. |
| D. `/api/signature-inputs` | **merge-into** human-surface `/api/signature-inputs` (live, 200) | yes: `compute_state_signature` reads it every tick | Repoint the reader by shape/discovery, not by address. Until then, the operator-presence dimension of the state signature is a constant from a surface nobody reads. |
| (related) dev-vessel `:8270` pins: `ui-write-passthrough.ts`, `docs-decision-deliver/answer-scan`, `compute-state-signature`, seed prompts | **broken** | yes (632 escalation panels) | Replace each with discovery-routed resolution of `uiPanel_write`/`uiQuestion_write`/`uiQuestion`. Make the passthrough a shape route, so on node 2 it reaches the hub's surface over p2p instead of throwing. |

## Discoverability and ordering

Retiring the vessel first would repeat the node-2 failure: escalations would throw into a dark
port. The order that avoids a hole:

1. **Route the writers by shape.** `resolveUiWritePassthrough` and the other five pinned sites
   should call discovery for the `uiQuestion_write` owner. `solicitation-outcome-scan.ts:38`
   already does this with `resolveObsidianEndpointViaDiscovery`, so it is the pattern to reuse
   (law 3). Fix the drafter seed prompts, which teach the wrong vessel.
2. **Only then mask `:8270`** and deregister it. After that, discovery has a single owner for the
   8 ui shapes, and human-surface is the only answer to "who serves uiQuestion".
3. **Class detector (law 6).** A registry check should flag any shape with two or more live owners
   where one owner's supersession is declared (in a proposal or doc) but its unit is still active.
   The same check should flag hardcoded peer ports in `src` whose vessel is masked or superseded.
   The recurrence here (08-07 declared, 09-22 diagnosed, 09-28 still written) is exactly the
   class nothing watches. It should mint a gap with `edit_site` = the pinning file, not the victim
   vessel. The five wasted landings on stateful-ui came from `edit_site` pointing at the victim.

Note that the human-surface repo itself was unauthorable until 09-26 (fb042e9, private remote;
class problem "25 of 47 parked patches target human-surface proxy.ts"). Check that it is
authorable before routing escalation work there, or the substrate will keep landing on the one
surface it can author, which is the stale one.
