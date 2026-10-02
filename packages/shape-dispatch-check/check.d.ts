#!/usr/bin/env bun
/**
 * Shape-dispatch agreement check.
 *
 * Verifies vessel invariant 2: every advertised shape has a matching dispatch
 * case and every dispatch case has a matching advertised shape.
 *
 * Usage:
 *   bun packages/shape-dispatch-check/check.ts <vessel-root>
 *   bun packages/shape-dispatch-check/check.ts          # uses cwd
 *
 * Exit 0: no violations.
 * Exit 1: violations found.
 *
 * Suppression:
 *   // @shape-dispatch:private
 *   case 'internalShape':   ← excluded from the orphan-handler check
 *
 * Config override (shape-dispatch.config.json in vessel root):
 *   { "mappings": { "shapeName": ["pointerType1", "pointerType2"] } }
 *   Maps advertised shapes to one or more dispatch case literals when they
 *   differ (e.g. identity-vessel: "authentication" → ["apiKey", "session"]).
 */
export {};
//# sourceMappingURL=check.d.ts.map