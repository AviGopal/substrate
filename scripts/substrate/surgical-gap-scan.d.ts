#!/usr/bin/env bun
/**
 * surgical-gap-scan.ts — SUPPLY of localized, single-edit, landable gaps for the
 * autonomous gap-compose loop (the last lever for unaided self-development).
 *
 * The autonomous loop (gap_to_feature -> feature_compose -> cutover) LANDS a fix
 * on origin/dev when handed a SURGICAL gap (a concrete existing edit-site + a
 * single-file fix). The substrate's own detectors emit mostly hard/architectural
 * gaps, so the loop starves. This scanner manufactures a high-PRECISION supply of
 * surgical gaps from a deterministic source scan.
 *
 * DETECTION (high precision over recall — a false positive wastes a loop cycle):
 *   Pattern HARDCODED_FETCH_ENDPOINT — an INLINE hardcoded `fetch("http://host:port…")`
 *   (or `ws://…`) string literal in vessel src. This is genuine drift risk (a
 *   port/host change silently breaks the call) and violates the foundation's "no
 *   hardcoded endpoints, route via discovery/env" principle. The fix is a single-line
 *   edit: replace the literal with the env-defaulted endpoint constant the file
 *   ALREADY defines (ACTIVITY_API_ENDPOINT / DISCOVERY_ENDPOINT / DEV_VESSEL_ENDPOINT /
 *   LIGHT_DISPATCH_ENDPOINT / …). We only flag literals that are NOT already a
 *   `const NAME = "http://…"` named default and NOT behind a `?? ` env fallback —
 *   i.e. genuinely inline, genuinely surgical.
 *
 * SCOPE (broadened 2026-06-29): the scan covers EVERY vessel under <repos>/<v>/src
 * (auto-discovered), not a fixed 3-vessel list. The fetch-anchoring + idiomatic
 * exclusions (named-default const, `?? ` fallback) are what keep this high-precision
 * fleet-wide — a bare "any localhost literal" scan was measured noisy (121 survivors,
 * dominated by comments / doc-strings / `||`-defaults / object-property defaults),
 * whereas the fetch-anchored form yields only genuine runtime call-sites (e.g. the
 * boredom-vessel `fetch(\`http://127.0.0.1:8280/dispatch\`)` whose file already defines
 * LIGHT_DISPATCH_ENDPOINT for :8280). Two structural candidate patterns were
 * considered and REJECTED on this codebase: `new WebSocket(...)`/`new URL(...)` inline
 * literals (0 hits — WS urls all derive from a base via `.replace`), and a hardcoded
 * `.listen(NNNN)` / `port: NNNN` server port (no `.listen(literal)` sites; the
 * `port:` hits are domain config / examples / idiomatic config-defaults → <90%
 * precision). Endpoint literals remain the one high-precision pattern.
 *
 * Each genuine hit -> ONE `systematic_failure` substrateGap with:
 *   - deterministic id (hex content hash; NEVER a 10/13-digit number, which
 *     gapClassKey would strip and collapse distinct gaps) -> re-runs UPSERT, no dupes,
 *   - classification_metadata { file_path, edit_site (file:line), suspected_real_location,
 *     single_file:true, proposed_fix, line } — exactly the fields localizeGap (path b)
 *     + landabilityScore reward (+0.3 edit-site, +0.1 single_file, +0.15 surgical cat).
 *
 * READ-ONLY: scans source, writes gaps. The downstream typecheck + semantic +
 * cutover gates catch a bad fix (-> UNFAVORABLE, no land), so a low-quality gap
 * costs a cycle but cannot land breakage. Precision still matters: keep it tight.
 *
 * Bounded: scans a fixed small vessel set, caps total gaps per run. Idempotent.
 *
 * Env:
 *   DEV_VESSEL_ENDPOINT   dev-vessel resolve endpoint (default http://127.0.0.1:8090)
 *   SURGICAL_SCAN_VESSELS comma list of vessels to scan (default: ALL vessels with a src/ dir under <repos>)
 *   SURGICAL_SCAN_CAP     max gaps to emit per run (default 4)
 *   SURGICAL_SCAN_REPOS   repos root (default <super-repo>/repos)
 *   SURGICAL_SCAN_DRYRUN  =1 -> print gaps, do not write
 */
export {};
//# sourceMappingURL=surgical-gap-scan.d.ts.map