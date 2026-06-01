# Display vessel — host peer implementation

## Why

`2026-05-31-display-perception-vessel` defines shape contracts for
read-only display sensing. `2026-05-31-display-control-extension`
defines the action sibling. **This proposal implements the actual
peer-vessel that hosts both** — the binary that runs on the
operator's machine, owns the display, and federates back to the
substrate through `discovery-vessel`.

The two siblings are spec-shaped (contracts, posture, gates). This
spec is implementation-shaped: distribution, lifecycle, federation
handshake, per-platform shellouts, identity. The split mirrors the
existing convention — e.g. `2026-04-26-impulse-activity-loop`
defines IAL contracts while individual vessel repos implement them.

The substrate cannot acquire perception or action capability without
a binary on the operator's machine. This is that binary.

## What changes

### Distribution: `bun build --compile`

Single-file binaries via `bun build --compile --target=bun-<platform>`,
matching the canonical pattern in
`docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md`. Targets:

| Binary name | Target |
|---|---|
| `metabob-display-vessel-linux-x64` | `bun-linux-x64` |
| `metabob-display-vessel-linux-arm64` | `bun-linux-arm64` |
| `metabob-display-vessel-darwin-x64` | `bun-darwin-x64` |
| `metabob-display-vessel-darwin-arm64` | `bun-darwin-arm64` |
| `metabob-display-vessel-windows-x64` | `bun-windows-x64` |

Tauri shell deferred — consent UX for v1 is a CLI prompt on first
run + `systemctl --user status` for state inspection.

OmniParser V2 weights ship inside the binary (~200MB+ embedded
asset). Substrate-container image is untouched. Operator-laptop,
not substrate-portable.

### Install path

```bash
curl -fsSL https://metabob.example/install-display-vessel.sh | sh
```

The install script:

1. Detects platform, downloads matching binary to
   `~/.local/bin/metabob-display-vessel`.
2. Writes systemd user unit (Linux), launchd plist (macOS), or
   Windows Service definition (Windows).
3. Generates an ed25519 keypair to `~/.metabob/display-vessel/keys/`
   (H2-ready: `vessel_id = base32(multihash(SHA-256, pubkey))`).
4. Reads substrate `endpoint` + `apiKey` from `~/.metabob/config.json`
   (existing config surface — see project CLAUDE.md "Configuration").
5. Enables and starts the service:
   `systemctl --user enable --now metabob-display-vessel.service`.

First run prompts for Screen Recording permission on macOS;
Wayland portal grant on Linux; no prompt required on X11 or
Windows. Permission state cached in
`~/.metabob/display-vessel/state.json`.

### Lifecycle

- **Auto-restart:** systemd `Restart=always`+`RestartSec=5s`.
  launchd `KeepAlive=true`. Windows Service Recovery: restart on
  fail with 5s delay.
- **Sleep / wake:** no explicit handling. The 60s discovery-vessel
  heartbeat naturally times out during sleep; on resume the daemon
  re-registers fresh. 5-minute discovery TTL is the upper bound on
  staleness.
- **Updates:** v1 ships no auto-update. Operators rerun the
  install-script to upgrade. Future:
  `2026-05-30-vessel-binary-redeploy-on-source-drift` patterns
  extend to host-peer vessels too.

### Communication

- Registers with discovery-vessel via existing
  `RegisterVesselRequest` shape — no discovery-vessel change
  required for v1.
- Advertises resolver contract: `resolve_endpoint`,
  `resolve_request_format=pointer`, `auth_scheme=ApiKey`,
  `resolve_timeout_ms=30000` (perception detection takes longer
  than typical resolvers).
- Heartbeat every 60s.
- Auth: HMAC API key (same as existing vessels). Pubkey-derived
  `vessel_id` is included in registration metadata, becomes
  load-bearing when H2 ships.

### Network topology — three options, ship #1 first

| Option | How it works | Ship status |
|---|---|---|
| **#1 — Local-only** | Vessel binds `127.0.0.1:8270`. Substrate-live reaches via docker bridge gateway IP (`host.docker.internal` on macOS/Windows; `172.17.0.1` on Linux). `resolve_endpoint = "http://127.0.0.1:8270/resolve"` registered with discovery; discovery rewrites to bridge IP for substrate-container resolvers. | **v1.** |
| **#2 — Reverse-tunnel** | Host vessel opens outbound WebSocket to substrate (firewall-friendly). Substrate dispatches multiplex over the persistent connection. | **Openspec follow-up** — addresses canary substrate reachability where host-peer is behind NAT. |
| **#3 — Tailscale / WireGuard** | Both endpoints on tailnet. Offloads NAT traversal + authentication to the VPN layer. | **Operator discretion** — documented, no code dependency. |

### Display API per platform — child-process shellouts

Pure-TS vessel with ~50 LOC of platform branching. No native
bindings. Capture and input are delegated to mature CLI tools that
ship with or are widely available on each platform.

| Platform | Capture | Input | Notes |
|---|---|---|---|
| Linux / X11 | `scrot -o /tmp/out.png` | `xdotool key/type/mousemove/click` | Cheapest path. No permissions. |
| Linux / Wayland (sway/Hyprland) | `grim` + `slurp` | `ydotool` (requires `uinput` group) | Portal-mediated permission grant per session. |
| Linux / Wayland (GNOME/KDE) | `gnome-screenshot` / `spectacle` | `ydotool` | Portal grants required. |
| macOS | `screencapture -x` | `osascript` (built-in) or `cliclick` (brew) | Screen Recording permission grant required. |
| Windows | PowerShell `System.Drawing.Bitmap` | `nircmd` (free) or PowerShell `SendKeys` | No permission grant needed for capture. |

The branching lives in
`repos/display-vessel/src/lib/platform.ts` with one
`ScreenCapturePort` interface and one `InputPort` interface per
platform implementation. Tests stub both ports via a
`FakePlatformPort` so the rest of the vessel is platform-agnostic.

### OmniParser bundle

- Model weights (`omniparser-v2-{version}.onnx` + tokenizer JSON +
  caption-classifier head) bundled as Bun embedded assets:
  ```ts
  import modelBytes from "../assets/omniparser-v2.onnx" with { type: "file" };
  ```
- Lazy-loaded on first detection request. Held in memory across
  subsequent calls. Released on idle (configurable;
  default 5 min idle → release).
- Inference via `onnxruntime-node` (pure-Node ONNX runtime;
  works under Bun). CPU-only; no CUDA dependency.

### Identity

- ed25519 keypair generated at install time. Public key derives
  `vessel_id` via `base32(multihash(SHA-256, pubkey))`. Private key
  never leaves `~/.metabob/display-vessel/keys/` (file-permission
  600, owner-only).
- HMAC API key (existing identity-vessel scheme) used for
  discovery-vessel auth path for v1.
- Pubkey-derived `vessel_id` included as a metadata field in
  registration. Becomes load-bearing when H2 ships and discovery-
  vessel enforces pubkey-vessel-id matching.

### Three-place rule

Per `repos/development-vessel/CLAUDE.md` discipline (every new
shape registered in `config.ts` `discovery.shapes` + handled in
`routes/impulses.ts` + has a seed template), every shape this
vessel resolves is registered three times:

- `displayCapture` — capture resolver path
- `displayObjectDetection` — detection resolver path
- `displayTextTokens` — OCR resolver path
- `displayContextAggregate` — aggregator resolver path
- `displayContextSummary` — LLM-summarizer dispatch path
- `displayAction_write` (Phase B+) — action resolver path
- `pixel_region_hash` — verifier helper resolver
- `functional_caption_classifier` — caption-class projection
- `displayConsentState` — attestation state read
- `actionAborted` — emitted via WebSocket back to activity-api

## Out of scope

- **Perception shape contracts** — `2026-05-31-display-perception-vessel`.
- **Action shape contracts + reversibility-class policy** —
  `2026-05-31-display-control-extension`.
- **H2 implementation** —
  `2026-04-26-security-hardening-findings` (this spec is
  H2-ready: keypair generated, vessel_id derived, registration
  includes pubkey hash. Enforcement on the discovery-vessel side
  is separate.).
- **Tauri-shell consent UX** — v1 ships CLI prompt; richer UX is
  a follow-up.
- **Auto-update mechanism** — v1 ships manual rerun of install
  script.
- **Cross-platform native input via uinput / Win32 hooks** — v1
  uses well-established shellouts; native bindings deferred to
  a follow-up if shellouts prove insufficient.
- **Federation across multiple host-peer vessels per operator** —
  e.g. multi-monitor or multi-machine. v1 assumes one host-peer
  per operator. Multi-host federation rides
  `2026-05-23-vessel-federation`.

## Dependencies

- **`2026-05-31-display-perception-vessel`** — shape contracts
  hosted by this vessel. The two ship together; this spec is the
  binary, the perception spec is the contract.
- **`2026-05-31-display-control-extension`** Phase B onward —
  for the action resolver path. v1 of this vessel may ship
  perception-only; action lands when the control spec gates open.
- **`2026-05-23-vessel-federation`** — peer-aware discovery
  infrastructure. Required for cross-substrate reach (e.g. a host
  vessel registering with a canary substrate from a laptop).
- **`2026-04-26-security-hardening-findings/`** H2 — vessel_id
  enforcement. This spec is H2-ready but does not require H2
  shipped.
- **OmniParser V2** — upstream model license; bundling discipline
  tracked in `repos/display-vessel/CLAUDE.md` (created on Phase A).

## Risk

- **Sleep / wake reliability across platforms.** Heartbeat
  timeout + re-registration is the only mechanism. Mitigation:
  60s heartbeat + 300s TTL bound staleness to 5 min;
  observability via discovery-vessel registry stats.
- **Install-UX friction.** `curl | sh` is the standard pattern but
  trips zero-trust operator policies. Mitigation: install script
  is signed; binary checksum published; alternative
  `brew install metabob-display-vessel` for macOS users.
- **OmniParser V2 license posture.** Microsoft's license must be
  re-verified at every bundle update. Mitigation: tracked in
  `repos/display-vessel/CLAUDE.md`; release CI step fails on
  license-file diff.
- **Wayland portal permission UX is opaque.** Operators may not
  realize a portal grant is required. Mitigation: first-run
  detection emits a `host_vessel_capability_missing` impulse if
  capture fails with EACCES; operator-side documentation in
  install-script output.
- **Reverse-tunnel topology (#2) may not be needed** for v1 if
  all operators run substrate-live locally. Defer until canary
  substrate reach is a concrete need.
- **OmniParser inference latency on CPU is ~1-3s per frame.**
  Mitigation: capture vessel returns the `displayCapture` impulse
  immediately; detection is dispatched async; the action loop
  budgets accordingly.

## Open questions (operator decides)

These four questions are surfaced for operator decision; they are
not resolved in this proposal:

1. **Wayland-first or X11-first for Linux v1?** X11 is simpler
   (no portal grants, mature `xdotool`/`scrot` toolchain) but
   distros are moving to Wayland. Recommendation: ship X11 first
   to unblock action quickly, add Wayland in Phase D — but
   operator may prefer Wayland-first to dogfood the
   portal-mediated grant flow earlier.
2. **Consent UX surface — Tauri vs OS-native + CLI?** Tauri is a
   ~30MB additional binary footprint but gives a real status UI.
   CLI is zero additional footprint but requires the operator to
   know `systemctl status`. Recommendation: CLI for v1, Tauri
   when action graduates beyond `reversible`.
3. **H2 readiness — ship pubkey-derived vessel_id in this
   openspec or defer?** This spec is H2-ready (keypair generated,
   id derived). Discovery-vessel enforcement is the separate
   gate. Question: should this spec also patch discovery-vessel
   to accept (advisory) pubkey claims, or strictly defer all H2
   work to the security-hardening spec?
4. **Generalize `DEV_VESSEL_ENDPOINT` env var (from recent iter
   `87265468`) to `<SHAPE>_VESSEL_ENDPOINT` for routing config
   consistency?** Today's pattern of per-vessel `_VESSEL_ENDPOINT`
   env vars is ad-hoc. Recommendation: introduce
   `DISPLAY_VESSEL_ENDPOINT` to match the existing pattern; the
   broader normalization is a separate spec.

## Companion concepts

- `concept_HKlz4FAc2cpf` — `substrate_self_fix_pattern` (the
  peer vessel is the third arm of the substrate's perception of
  itself — alongside trace store and concept graph).
- `concept_WikGVLa5d6kp` — `selector_anchor_vocabulary_gate`
  (peer-vessel-resolved signatures are the action-class
  anchors the selector needs).
- `concept_MNYEq7xc_46U` — `architectural_asymmetry` (host-peer
  topology is the natural fix for the asymmetry between
  in-container substrate and outside-container operator).

## Related openspecs

- `2026-05-31-display-perception-vessel/` — shapes hosted by
  this vessel.
- `2026-05-31-display-control-extension/` — action shapes hosted
  by this vessel.
- `2026-05-31-display-signature-partitioning/` — signature tier
  infrastructure the vessel's emissions consume.
- `2026-05-31-display-failure-mode-extensions/` — failure-mode
  vocabulary the vessel's verifiers emit.
- `2026-05-23-vessel-federation/` — peer-aware discovery the
  host-peer relies on.
- `2026-04-26-security-hardening-findings/` — H2 enforcement
  pathway (advisory in v1).
- `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` — canonical
  vessel template this spec follows.
