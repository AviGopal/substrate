/**
 * Pure body-envelope strip functions for concept-writeback.
 *
 * Kept in a separate module from `concept-writeback.ts` so that tests
 * can import them without dragging in the `obsidian` runtime (which is
 * only available inside the Obsidian process).
 *
 * The render path in `concept-formatter.ts` wraps `concept.content`
 * with a leading `# <title>` heading and a contiguous run of obsidian
 * callouts (`[!abstract] Summary`, `[!info] Stats`, `[!quote] Source`)
 * before the body, and appends a `## Related` section after it.
 *
 * Writeback must strip BOTH ends so the next pull does not accumulate
 * another copy of the wrap into `concept.content`. The load-bearing
 * invariant is:
 *
 *   stripWritebackEnvelope(render(c)) === c.content
 *
 * when `c.content` is empty user prose.
 *
 * Cites concept_kxeA7gRK7NEW (writeback_echo_loop) and
 * concept_HqdWDywYZzK3 (round_trip_idempotence_contract).
 */

/**
 * Strip the trailing `## Related` block from the body. The related
 * section is the rendered edge view (wikilinks grouped by edge_type),
 * not part of the concept's text.
 */
export function stripRelated(body: string): string {
  const relIdx = body.search(/^##\s+Related\s*$/m);
  if (relIdx < 0) return body.trim();
  return body.slice(0, relIdx).trim();
}

/**
 * Strip the contiguous run of *render-time* leading wrap that
 * `renderConceptNote` prepends to the body:
 *
 *   1. a single `# <title>` line (only the first non-blank line, and
 *      only if it begins with `# ` — sub-headings like `## Foo` are
 *      preserved as user content);
 *   2. any contiguous run of obsidian callouts of types
 *      `[!abstract]`, `[!info]`, or `[!quote]`, each consisting of one
 *      or more consecutive lines beginning with `>` and separated from
 *      the next block by one or more blank lines.
 *
 * User-authored callouts of other types (`[!note]`, `[!warning]`, …)
 * are preserved. Any other content immediately after the heading (a
 * paragraph, a sub-heading, etc.) terminates the wrap-stripping pass.
 *
 * Idempotent: a second pass over the result is a no-op.
 */
export function stripRenderedWrap(body: string): string {
  const lines = body.split('\n');
  let i = 0;

  // Skip leading blank lines.
  while (i < lines.length && lines[i].trim() === '') i++;

  // (1) Optional single `# <title>` line — only the renderer's H1.
  if (i < lines.length && /^#\s+\S/.test(lines[i])) {
    i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  // (2) Contiguous run of rendered callouts.
  const renderedCalloutHead = /^>\s*\[!(abstract|info|quote)\]/;
  while (i < lines.length) {
    if (!renderedCalloutHead.test(lines[i])) break;
    while (i < lines.length && /^>/.test(lines[i])) i++;
    while (i < lines.length && lines[i].trim() === '') i++;
  }

  return lines.slice(i).join('\n').trim();
}

/**
 * Compose `stripRelated` (trailing) + `stripRenderedWrap` (leading)
 * to recover the pure concept-content body that should be POSTed back
 * to concept-db.
 */
export function stripWritebackEnvelope(body: string): string {
  return stripRenderedWrap(stripRelated(body));
}
