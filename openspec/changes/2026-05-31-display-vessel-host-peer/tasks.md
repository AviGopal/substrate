# Tasks — display-vessel-host-peer

Ordered for the main operator development agent. Each task lists the
implementation files, acceptance criterion, and the gate it unblocks.

## Phase A — Skeleton + identity (independent, ship first)

- [ ] **A.1** — Create `repos/display-vessel/` per
  `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` discipline.
  - `package.json`, `tsconfig.json`, `bun.lockb`, `CLAUDE.md` per
    template invariants.
  - `src/index.ts` (Hono server entry); `src/config.ts`
    (discovery.shapes declaration); `src/routes/impulses.ts`
    (three-place rule dispatcher); `src/lib/identity.ts` (HMAC
    API key resolution from `~/.metabob/config.json`).
  - Acceptance: empty server responds 200 on `/health`;
    `bun run typecheck` clean.
- [ ] **A.2** — ed25519 keypair generation on first run.
  `src/lib/keypair.ts` reads / generates
  `~/.metabob/display-vessel/keys/ed25519.{pub,sec}` with
  permission 0600 on the private key. Derives `vessel_id` via
  `base32(multihash(SHA-256, pubkey))`.
  - Include `vessel_id` (pubkey-derived) and `pubkey_hash` in
    registration metadata for H2-readiness.
  - Acceptance: unit test asserts deterministic vessel_id from a
    fixed seed pubkey; file permissions correct on POSIX.
- [ ] **A.3** — Discovery registration loop. Reuse
  `DiscoveryRegistrationLoop` pattern from
  `goal-host-vessel` / `concept-db`. Registers on startup with
  60s heartbeat; resolver contract advertises `auth_scheme=ApiKey`,
  `resolve_endpoint`, `resolve_request_format=pointer`,
  `resolve_timeout_ms=30000`.
  - Acceptance: against a stubbed discovery-vessel, registration
    + heartbeat fire correctly; vessel_id stable across restarts.
- [ ] **A.4** — Shape registration via the three-place rule for
  the five v1 perception shapes (`displayCapture`,
  `displayObjectDetection`, `displayTextTokens`,
  `displayContextAggregate`, `displayContextSummary`) plus
  `pixel_region_hash`, `functional_caption_classifier`,
  `displayConsentState`. All return stub responses (`501 not
  implemented`) until later phases land.
  - Acceptance: discovery probe at runtime returns the eight
    shapes; stub resolvers return 501 with structured failure-mode
    `{ type: "verifier_negative", reason: "phase A stub" }`.

## Phase B — Linux X11 capture + input (depends on A)

- [ ] **B.1** — `ScreenCapturePort` interface + Linux/X11
  implementation in `src/lib/platform/linux-x11.ts`. Shells out
  to `scrot -o /tmp/metabob-display-capture-{uuid}.png` and
  reads the bytes into a tmpfs-bounded LRU
  (`src/lib/capture-lru.ts`, default 100MB cap, eviction emits
  log event).
  - Acceptance: integration test against a headless X11 server
    (`xvfb-run`) captures a known frame; LRU eviction triggers
    after the cap.
- [ ] **B.2** — `InputPort` interface + Linux/X11 implementation
  in `src/lib/platform/linux-x11-input.ts`. Shells out to
  `xdotool key/type/mousemove/click/scroll/...`. Maps the
  Anthropic `computer_20251124` action enum to the corresponding
  `xdotool` invocation.
  - Acceptance: unit tests cover each action enum value;
    integration test against headless X11 asserts correct effect
    on a known target window.
- [ ] **B.3** — `displayAction_write` resolver (action path).
  Wires `InputPort` behind the three-place dispatcher. Enforces
  rate limits (≤10 actions/s, ≤30 burst, ≥50ms inter-action
  delay) at the dispatch boundary.
  - Reads `scope_context` from the incoming impulse; validates
    against current `displayConsentState`; refuses if expired or
    missing for `soft_irreversible` / `hard_irreversible`.
  - Acceptance: integration test asserts rate limits enforce;
    refusal path returns `failure_mode { type: "consent_revoked",
    revocation_source: "session_timeout" }` correctly.
- [ ] **B.4** — `pixel_region_hash` resolver. SHA-256 over a
  specified region of the most-recent capture in the LRU.
  Returns the hex hash + region tuple.
  - Acceptance: deterministic hash for identical regions;
    different hash for different regions.
- [ ] **B.5** — `actionAborted` WebSocket emission path. On
  hotkey trigger or attestation revocation, emit
  `actionAborted` to activity-api via the existing WebSocket
  client pattern (modeled after concept-db's ExecutionObserver).
  - Stub the hotkey binding for now; Phase E wires the actual
    bind.
  - Acceptance: stub-triggered abort emits the impulse with
    correct frontmatter.

## Phase C — OmniParser V2 detection (depends on A)

- [ ] **C.1** — Bundle OmniParser V2 weights as embedded assets
  in the binary build:
  ```ts
  import modelBytes from "../assets/omniparser-v2.onnx" with { type: "file" };
  ```
  Document model version + license in
  `repos/display-vessel/CLAUDE.md` + add a release-CI step that
  fails on license-file diff.
- [ ] **C.2** — Lazy-loaded ONNX runtime via `onnxruntime-node`.
  Held in memory across requests; released after configurable
  idle (default 5 min).
  - Acceptance: first request loads (slow); subsequent are fast;
    idle release frees model.
- [ ] **C.3** — `displayObjectDetection` resolver. Takes a
  `displayCapture` impulse pointer; runs OmniParser inference;
  returns `displayObjectDetection` body with detected_elements +
  model_id + capture_metadata.
  - Confidence-tier mapping per
    `2026-05-31-display-failure-mode-extensions` Phase C.3 —
    OmniParser confidence ≥ 0.9 → tier 1; 0.6-0.9 → tier 2;
    0.3-0.6 → tier 3; < 0.3 → tier 4 + emit
    `verifier_negative.check_id = "detection_confidence"`.
  - Acceptance: against a known UI screenshot fixture, returns
    detected elements with sensible bboxes + classes.
- [ ] **C.4** — `functional_caption_classifier` resolver.
  Lightweight pattern-based classifier ("Submit"/"Send"/
  "Confirm" → `submit_action`; "Cancel"/"Back"/"Close" →
  `cancel_action`; etc.) implemented in
  `src/lib/caption-classifier.ts`. Pattern table seeded from
  common UI vocabulary; configurable via
  `~/.metabob/display-vessel/classifier-patterns.json`.
  - Acceptance: classifier returns expected class for sample
    captions; falls back to `unclassified` on no match.

## Phase D — Linux Wayland support (depends on B + C)

- [ ] **D.1** — Wayland capture path. `src/lib/platform/
  linux-wayland.ts` shells out to `grim` (sway, Hyprland) or
  `gnome-screenshot` (GNOME) or `spectacle` (KDE). Auto-detect
  compositor via `$XDG_CURRENT_DESKTOP` / `$WAYLAND_DISPLAY`.
  - Region capture via `grim -g "$(slurp)"`.
  - Portal-grant flow: first capture triggers the OS portal
    dialog. On EACCES, emit
    `host_vessel_capability_missing { capability: "display_capture",
    reason: "wayland_portal_grant_denied" }` impulse.
  - Acceptance: integration test under a Wayland session
    captures correctly; denial path emits the impulse.
- [ ] **D.2** — Wayland input path via `ydotool`. Requires
  `uinput` group membership for the user running the vessel;
  install script flags this requirement.
  - Acceptance: integration test under Wayland sends a known
    keystroke that reaches the focused window.
- [ ] **D.3** — Platform auto-detection. `src/lib/platform/
  index.ts` returns the right `ScreenCapturePort` + `InputPort`
  per `process.platform` + `$WAYLAND_DISPLAY` detection.

## Phase E — macOS + Windows shellouts (depends on B + C)

- [ ] **E.1** — macOS capture. `src/lib/platform/darwin.ts`
  shells out to `screencapture -x /tmp/...`. First-run triggers
  Screen Recording permission grant; cached in
  `~/.metabob/display-vessel/state.json`.
  - Acceptance: integration test on a macOS CI runner (or
    skip-gated if unavailable) captures a frame.
- [ ] **E.2** — macOS input. `osascript` (built-in) for keystroke
  + click via System Events; or `cliclick` (via brew) for richer
  control. Map Anthropic action enum to the chosen backend.
- [ ] **E.3** — Windows capture. PowerShell
  `System.Drawing.Bitmap.FromImage` capture invoked via
  `child_process.spawn("powershell.exe", ...)`. No permission
  grant required.
- [ ] **E.4** — Windows input. `nircmd sendkeypress` and
  `nircmd setcursor` for mouse + keyboard; or PowerShell
  SendKeys + AutoHotkey fallback documented for advanced users.

## Phase F — Install script + service units (depends on B)

- [ ] **F.1** — `scripts/install-display-vessel.sh` in the
  super-repo. Detects platform; downloads matching binary; sets
  up service unit; generates keypair; first-run prompts for any
  required permission.
  - Acceptance: dry-run installs on a Linux test VM; service
    enabled and started; vessel registers with the substrate.
- [ ] **F.2** — systemd user unit
  `metabob-display-vessel.service` in
  `repos/display-vessel/dist/systemd/`. `Type=simple`,
  `Restart=always`, `RestartSec=5s`, environment loaded from
  `~/.metabob/config.json`.
- [ ] **F.3** — launchd plist for macOS in
  `repos/display-vessel/dist/launchd/
  com.metabob.display-vessel.plist`. `KeepAlive=true`.
- [ ] **F.4** — Windows Service definition + installer script in
  `repos/display-vessel/dist/windows/`. Recovery: restart on
  fail with 5s delay.
- [ ] **F.5** — Update path documentation in
  `repos/display-vessel/docs/UPDATING.md`. v1 ships manual
  rerun of install script. Auto-update is a follow-up.

## Phase G — Operator interrupt hotkey + reverse-tunnel topology (depends on F)

- [ ] **G.1** — Global hotkey binding. Default: Escape pressed
  twice within 250ms. Implementation per platform:
  - Linux X11: `xev`-style listener on root window;
  - Linux Wayland: `libinput` reader (requires uinput group);
  - macOS: `CGEventTap` via `node-mac-permissions` or
    `osascript` polling fallback;
  - Windows: `RegisterHotKey` via PowerShell hosted call.
  - Acceptance: hotkey trigger fires `actionAborted` end-to-end
    on each supported platform.
  - Configuration via `~/.metabob/display-vessel/hotkey.json`.
- [ ] **G.2** — Reverse-tunnel topology (network option #2).
  Outbound WebSocket from host vessel to substrate; substrate
  dispatches multiplex over the persistent connection. Skipped
  by default; opt-in via `MODE=reverse_tunnel` env var.
  - Acceptance: with `MODE=reverse_tunnel`, vessel reaches a
    canary substrate behind NAT.
- [ ] **G.3** — Document Tailscale / WireGuard topology (#3) in
  `repos/display-vessel/docs/NETWORK.md`. No code; pure
  documentation of operator-side VPN setup.

## Gates

| Phase | Gates | Notes |
|---|---|---|
| A | None — skeleton ships standalone | Empty resolvers return 501 stubs. |
| B | Phase A | Minimum-viable Linux/X11 capture + input + action dispatch. |
| C | Phase A | Detection lands independently of platform; weights are bundled. |
| D | Phase B + C | Wayland is incremental over the X11 path. |
| E | Phase B + C | macOS and Windows are platform-incremental. |
| F | Phase B (minimum) | Install script can ship after the first capture+input path works. |
| G | Phase F | Hotkey binding requires the install path; reverse-tunnel requires the basic registration loop. |

## Cross-references

- `2026-05-31-display-perception-vessel/` — shape contracts this
  vessel hosts.
- `2026-05-31-display-control-extension/` — action contracts +
  `displayActionFirstEncounter` + `evaluate-display-action-class-
  graduation` flow.
- `2026-05-31-display-signature-partitioning/` — selector-side
  signature partitioning of impulses this vessel emits.
- `2026-05-31-display-failure-mode-extensions/` —
  `consent_revoked`, `action_reversal_failed`,
  `confidence_tier`, `root_cause_step`.
- `2026-05-23-vessel-federation/` — peer-aware discovery
  infrastructure (this vessel is the canonical first host-peer).
- `2026-04-26-security-hardening-findings/` — H2 pubkey-vessel-id
  enforcement (this vessel is H2-ready; enforcement separate).
- `docs/architecture/TYPESCRIPT_VESSEL_TEMPLATE.md` — canonical
  vessel construction template.
