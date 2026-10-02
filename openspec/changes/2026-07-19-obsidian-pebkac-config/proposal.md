# Obsidian config surface — collapse to point-and-go {discovery, apiKey} with an honest connection test, so a vault cannot be silently misconfigured into a dead join

**Date:** 2026-07-19
**Vessel:** obsidian-vessel (plugin settings surface + sidecar)
**Stage:** SPEC (grounded in a read of settings-tab.ts / settings.ts / sidecar-manager.ts)
**Lever:** law 13 (humans are resolvers, not preprocessors) + law 1 (behavior is a shape read at use time). A vault should join with exactly what point-and-go needs — a discovery endpoint and an api key — and derive the rest at use time. Every extra knob is a way to silently break the join.

## Problem (grounded 2026-07-19)

The config surface was partly collapsed (commit b68063b "collapse config surface to {discoveryVesselEndpoint, apiKey}"), but only the *Connection* header narrowed; the tab still renders a wide, misconfigurable surface (`repos/obsidian-vessel/src/settings-tab.ts`, `settings.ts`):

- **Test Connection is misleading + buggy.** It probes only the local sidecar `http://127.0.0.1:${settings.federationHealthPort}/health` (`settings-tab.ts:232`), reading `federationHealthPort` (desired 8402) **not** `getActiveSidecarPort()` (`sidecar-manager.ts:453`), which returns the *actual* port after the auto-shift loop (`:340-353` walks 8402→+20 when held). So when 8402 is busy the sidecar comes up on 8403 and Test Connection **false-negatives**. It never verifies the two things the user actually set — that `{discoveryEndpoint, apiKey}` authenticate against discovery.
- **The two load-bearing fields get zero validation.** `validateSettings` (`settings.ts:302-330`) checks `serverPort` range, `syncIntervalMinutes` range, and `canvasFolder` — but not `discoveryVesselEndpoint` (no URL parse) or `apiKey` (no non-empty check). A blank key or malformed URL surfaces no error.
- **Static-interval timers as config** (law 5): "Sync Interval" minutes (`settings-tab.ts:258`) and Concept-DB "Sync interval (seconds)" (`:134`) are sliders — cadence should be a rhythm impulse, not a knob.
- **Misconfigurable local ports.** "Server Port" 27182 (`settings.ts:96`) is user-editable yet frozen into the sidecar env at spawn (`sidecar-manager.ts:362`) — change-without-restart mismatch. It should auto-pick a free port like the health port already does.
- **Dead UI:** an empty "Vessel Registration" `h3` (`settings-tab.ts:328`).
- **ports-as-truth** in the src default (`discoveryVesselEndpoint` defaults to `http://127.0.0.1:18100`) and the README ("Server port 27182", "Sidecar health port 8402" with a `curl :8402/health` verification that is wrong once the port auto-shifts).

## Approach — the minimal config page

- **§1 Connection:** Discovery Endpoint (validated absolute http(s) URL; placeholder not a baked default), API Key (password, non-empty-validated), **Test Connection** that probes `<discovery>/bootstrap` (or an authenticated `/health`) with the apiKey via `getActiveSidecarPort()` and reports **reachable + authenticated + relay-reserved** — not just local-sidecar-up.
- **§2 Status** (read-only): keep the existing connection/shapes display (good feedback).
- **§3 Feature toggles:** Concept-DB sync, Goal Dispatch, Graph Backbone — booleans only, no intervals.
- **§4 Advanced (collapsed):** relay multiaddr override + Restart sidecar (keep), bun path.
- Everything else (ports, folders, TTLs, heartbeats, shapes, source-types, batch sizes) leaves the visible surface and is derived from `<discovery>/bootstrap` at use time or defaulted; local ports auto-pick a free port.

## Decision (flagged for ratification)

**`main.js` build-artifact treadmill.** `main.js` is a ~2 MB **git-tracked** bundle (not gitignored); every src change needs a manual `bun run build` + committed regenerated bundle or the plugin ships stale — and a substrate-authored src goal that skips the rebuild lands a stale plugin. **Decide:** (a) **keep tracked** + make the rebuild a mandatory co-landed step of every obsidian src goal (drop-in install, no toolchain — most PEBKAC-resistant for the *installer*); or (b) **untrack** + produce it via install.sh/build (no stale-bundle risk, but the installer needs a build toolchain). Recommendation: (a) — the installing human is the PEBKAC surface this change targets, and (a) keeps their install a drop-in; the rebuild burden moves onto the (automatable) authoring path.

## Tasks

- [ ] T1 `settings-tab.ts`: Test Connection uses `getActiveSidecarPort()` and verifies `{discovery, apiKey}` authenticate (bootstrap/auth round-trip), reporting reachable/authenticated/relay-reserved.
- [ ] T2 `settings.ts` + `settings-tab.ts`: validate `discoveryVesselEndpoint` (absolute http(s) URL) and `apiKey` (non-empty), inline red-text on change.
- [ ] T3 `settings-tab.ts`: auto-pick a free `serverPort` (mirror the health-port loop); remove the Server Port field and the dead "Vessel Registration" h3.
- [ ] T4 `settings-tab.ts` + `settings.ts`: move/remove the static interval sliders (law 5) — Advanced-only or rhythm-driven.
- [ ] T5 [doc] `repos/obsidian-vessel/README.md`: drop ports-as-truth (27182/8402 + curl verification); state local ports auto-select and reachability is the relay circuit.
- [ ] T6 [decision] `main.js` tracked-bundle policy (above).
