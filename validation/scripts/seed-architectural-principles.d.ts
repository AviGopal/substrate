#!/usr/bin/env bun
/**
 * seed-architectural-principles — Stage 0 of openspec change
 *   2026-06-03-pre-lift-bootstrap-and-architecture-aware-loop
 *
 * Mints architectural principle concepts into concept-db with
 * source_type="architectural_pattern_principle". Each principle carries a
 * `severity` field in metadata: "structural" (violations emit substrateGap),
 * "guidance" (advisory), "advisory" (informational only).
 *
 * Source mix:
 *   1. Foundation-doc sections (IMPULSE_ACTIVITY_FOUNDATION.md) — H2/H3 split
 *      via the markdown_split_sections resolver. Each section's summary +
 *      capped body becomes one principle concept with severity="guidance"
 *      (foundation-doc states intent; not all sections are check-targets).
 *   2. Session-articulated insights — hand-listed below, severity="structural"
 *      for the load-bearing architectural rules the four detectors enforce.
 *
 * After this script runs, the four horizon detectors in
 * repos/development-vessel/src/resolvers/ can query
 *   /concepts/search?source_type=architectural_pattern_principle
 * and derive check predicates from the returned set.
 *
 * Usage:
 *   bun validation/scripts/seed-architectural-principles.ts
 *
 * Idempotency: each concept carries metadata.signature; pre-mint search by
 * signature skips matches.
 */
export {};
//# sourceMappingURL=seed-architectural-principles.d.ts.map