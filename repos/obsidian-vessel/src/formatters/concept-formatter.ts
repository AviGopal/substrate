/**
 * Concept Formatter
 *
 * Renders a concept-db ConceptRecord (plus its neighbors) as a markdown
 * note that takes advantage of Obsidian's formatting affordances:
 *
 *   - Frontmatter carries substrate ids, timestamps, AND tags
 *     (`concept/<source-type>`, `shape/<slug>`) for tag-pane filtering.
 *   - Aliases let `Ctrl+O` find by short_id, shape (Title Case or
 *     snake_case), or summary head.
 *   - Body opens with an H1 derived from the shape, so the outline view
 *     is populated and the note title is human at-a-glance.
 *   - A `> [!abstract]` callout surfaces the one-line summary right
 *     under the title.
 *   - A compact stats callout shows relevance / loaded / succeeded /
 *     failed, with the same data also in frontmatter for queries.
 *   - When `concept.pointer.path` is present, a `> [!quote] Source`
 *     callout points at the file the concept tracks.
 *   - The `## Related` section renders each edge_type as a Title Case
 *     subheading with an emoji prefix; each neighbor line is
 *     "de-normalized" with the neighbor's source_type and relevance
 *     inline so the reader doesn't need to click through. Neighbors
 *     are deduplicated by (target, edge_type).
 *   - Concept-bridge-minted noise edges (those whose description is
 *     literally "Auto-discovered relationship") collapse under a
 *     `<details>` so they don't drown signal edges.
 */

import type { ConceptRecord, ConceptNeighbor } from '../concept-db-client';
import { shortConceptId } from '../concept-db-client';

const BRIDGE_NOISE_DESCRIPTION = 'Auto-discovered relationship';

const EDGE_EMOJI: Record<string, string> = {
  derived_from: '🌱',
  description_of: '📖',
  contradicts: '⚠️',
  related_to: '🔗',
  example_of: '🎯',
  sequence_next: '➡️',
  sequence_prev: '⬅️',
  resolves_to: '🪝',
};

// Pin a sensible order so the most semantically-loaded edges appear
// first when the related section has several types.
const EDGE_ORDER = [
  'derived_from',
  'description_of',
  'contradicts',
  'example_of',
  'resolves_to',
  'sequence_next',
  'sequence_prev',
  'related_to',
];

export function slugifyShape(input: string, maxLen: number = 60): string {
  const s = (input || 'concept')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Strip filesystem-unsafe characters from a string for use in a
 * filename. Obsidian rejects `/`, `\`, `:`, `*`, `?`, `"`, `<`, `>`,
 * `|`. Leading/trailing whitespace + periods are also stripped (some
 * filesystems treat trailing `.` as namespace boundaries). Collapses
 * internal whitespace runs to single spaces.
 */
export function safeBaseName(input: string, maxLen: number = 120): string {
  let s = (input || 'Untitled')
    .replace(/[\/\\:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s.]+|[\s.]+$/g, '');
  if (!s) s = 'Untitled';
  if (s.length > maxLen) s = s.slice(0, maxLen).trim();
  return s;
}

/**
 * Compute the canonical title for a concept — the humanized shape,
 * filesystem-safe. This is the basename of the note file (without
 * `.md` and without any disambiguator suffix).
 */
export function conceptTitle(concept: ConceptRecord): string {
  const shape = concept.shape || concept.source_type || 'Concept';
  return safeBaseName(humanizeShape(shape));
}

/**
 * Build the vault-relative path for a concept's note.
 *
 *   <syncRoot>/<source_type>/<Title Case>.md
 *
 * When two concepts share both source_type and title (genuine
 * duplicates the dedup management activity should catch), the caller
 * passes a `collisions` map from `${sourceType}/${title}` → list of
 * concept ids encountered in the current pull. If the concept's
 * `(sourceType, title)` key collides, we append a 5-char short_id
 * disambiguator with the middle-dot separator: `Overview · y-CPp.md`.
 *
 * Without a collisions map we don't disambiguate — bare titles only.
 * The single-concept materialize path (e.g. writeback after a vault
 * edit) uses this fallback.
 */
export function conceptNotePath(
  concept: ConceptRecord,
  syncRoot: string,
  collisions?: Map<string, string[]>,
): string {
  const sourceType = concept.source_type || 'uncategorized';
  const title = conceptTitle(concept);
  let basename = title;
  if (collisions) {
    const key = `${sourceType}/${title}`;
    const conflicts = collisions.get(key);
    if (conflicts && conflicts.length > 1) {
      basename = `${title} · ${disambigSlice(concept.id)}`;
    }
  }
  return `${syncRoot}/${sourceType}/${basename}.md`;
}

/**
 * Pick a 5-char disambiguator slice from the concept id. We strip the
 * `concept_` prefix that every substrate-minted id carries — otherwise
 * the first 5 chars are always "conce" and the disambiguator is
 * useless. Falls back to the bare shortConceptId for ids that don't
 * follow the convention.
 */
function disambigSlice(id: string): string {
  const short = shortConceptId(id);
  const stripped = short.startsWith('concept_') ? short.slice('concept_'.length) : short;
  return stripped.slice(0, 5);
}

/**
 * Pre-scan a batch of concepts to build the collision index for
 * `conceptNotePath`. Returns a map from `<source_type>/<title>` to
 * the list of concept ids that would collide on that path.
 */
export function buildCollisionMap(concepts: ConceptRecord[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of concepts) {
    const sourceType = c.source_type || 'uncategorized';
    const title = conceptTitle(c);
    const key = `${sourceType}/${title}`;
    const arr = map.get(key) ?? [];
    arr.push(c.id);
    map.set(key, arr);
  }
  return map;
}

interface RenderOptions {
  pulledAt?: string;
}

function yamlQuote(s: string): string {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
}

export function humanizeShape(shape: string): string {
  return (shape || 'Concept')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

function humanizeEdgeType(edgeType: string): string {
  const t = edgeType.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function neighborDisplay(n: ConceptNeighbor): string {
  if (n.shape) return humanizeShape(n.shape);
  if (n.summary) return n.summary.replace(/\n+/g, ' ').slice(0, 80).trim();
  return shortConceptId(n.id);
}

/**
 * Compute the wikilink target for a neighbor. We want Obsidian's primary
 * filename-match resolver to succeed (rather than rely on the slower
 * alias-index fallback, which doesn't always fire reliably for
 * programmatically-created files until the metadataCache is fully
 * built).
 *
 * Filenames are `<Title Case>.md` within `<source_type>/` folders.
 * The neighbor record carries `shape` and (often) `source_type` so we
 * can reconstruct the title. We don't know if the neighbor's title
 * collides with another concept in its source_type folder — if it
 * does, the link will resolve to one of them (Obsidian's picker
 * surfaces the choice on click). The aliases short_id in the target's
 * frontmatter remains the safety net.
 *
 * Falls back to bare short_id when shape is missing — those neighbors
 * are usually concept-bridge-minted with no metadata and the alias
 * path is the only option.
 */
function neighborLinkTarget(n: ConceptNeighbor): string {
  if (!n.shape) return shortConceptId(n.id);
  return safeBaseName(humanizeShape(n.shape));
}

/**
 * Render a single neighbor line. The link target is the filename stem
 * so Obsidian's filename-match resolves directly; the display text is
 * the humanized shape. Metadata (source_type · relevance) and the edge
 * description are denormalized inline so the line is self-describing.
 */
function renderNeighborLine(n: ConceptNeighbor): string {
  const target = neighborLinkTarget(n);
  const display = neighborDisplay(n);
  const meta: string[] = [];
  if (n.source_type) meta.push(n.source_type);
  if (typeof n.relevance === 'number') meta.push(`rel ${n.relevance.toFixed(2)}`);
  if (typeof n.edge_weight === 'number') meta.push(`w ${n.edge_weight.toFixed(2)}`);
  const metaSuffix = meta.length ? ` · ${meta.join(' · ')}` : '';
  const tail = n.edge_description
    ? ` — ${n.edge_description.replace(/\n+/g, ' ').slice(0, 200)}`
    : '';
  return `- [[${target}|${display}]]${metaSuffix}${tail}`;
}

/**
 * Dedupe neighbors by (short_id, edge_type). Concept-db sometimes
 * returns the same edge twice when neighbor walks pick it up from
 * both directions.
 */
function dedupeNeighbors(neighbors: ConceptNeighbor[]): ConceptNeighbor[] {
  const seen = new Set<string>();
  const out: ConceptNeighbor[] = [];
  for (const n of neighbors) {
    const key = `${shortConceptId(n.id)}::${n.edge_type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(n);
  }
  return out;
}

function isBridgeNoise(n: ConceptNeighbor): boolean {
  return (n.edge_description || '').trim() === BRIDGE_NOISE_DESCRIPTION;
}

function compareEdgeTypes(a: string, b: string): number {
  const ai = EDGE_ORDER.indexOf(a);
  const bi = EDGE_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

/**
 * Render the `## Related` section. Substantive edges render as Title
 * Case subheadings with an emoji prefix; bridge-noise edges collapse
 * under a single `<details>` block at the bottom.
 */
export function renderRelatedSection(rawNeighbors: ConceptNeighbor[]): string {
  if (!rawNeighbors.length) return '';
  const neighbors = dedupeNeighbors(rawNeighbors);
  const signal: ConceptNeighbor[] = [];
  const noise: ConceptNeighbor[] = [];
  for (const n of neighbors) {
    (isBridgeNoise(n) ? noise : signal).push(n);
  }

  const groups = new Map<string, ConceptNeighbor[]>();
  for (const n of signal) {
    const key = n.edge_type || 'related_to';
    const arr = groups.get(key) ?? [];
    arr.push(n);
    groups.set(key, arr);
  }

  const parts: string[] = [];
  const hasSignal = groups.size > 0;
  if (hasSignal) {
    parts.push('## Related', '');
    const keys = Array.from(groups.keys()).sort(compareEdgeTypes);
    for (const key of keys) {
      const emoji = EDGE_EMOJI[key] || '🔗';
      parts.push(`### ${emoji} ${humanizeEdgeType(key)}`);
      for (const n of groups.get(key)!) parts.push(renderNeighborLine(n));
      parts.push('');
    }
  }

  if (noise.length) {
    if (!hasSignal) parts.push('## Related', '');
    parts.push('<details>');
    parts.push(`<summary>Auto-discovered (${noise.length})</summary>`);
    parts.push('');
    for (const n of noise) parts.push(renderNeighborLine(n));
    parts.push('');
    parts.push('</details>');
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * Render the source pointer as a `> [!quote] Source` callout when the
 * concept carries one. Handles common pointer shapes:
 *   { type: "memo", path: "...", section: "..." }
 *   { type: "human_input", session_date: "..." }
 *   { type, ...arbitrary fields }
 */
function renderPointerCallout(pointer: Record<string, unknown> | undefined): string {
  if (!pointer || typeof pointer !== 'object') return '';
  const type = typeof pointer.type === 'string' ? pointer.type : null;
  const path = typeof pointer.path === 'string' ? pointer.path : null;
  const section = typeof pointer.section === 'string' ? pointer.section : null;
  const date = typeof pointer.session_date === 'string' ? pointer.session_date : null;

  let line: string;
  if (path) {
    line = `\`${path}\``;
    if (section) line += ` § ${section}`;
  } else if (type === 'human_input' && date) {
    line = `Operator session · ${date}`;
  } else {
    // `{type: "memo"}` and similar bare-type pointers carry no
    // location signal; suppress rather than render an empty Source.
    return '';
  }
  return `> [!quote] Source\n> ${line}\n`;
}

function renderStatsCallout(concept: ConceptRecord): string {
  const parts: string[] = [];
  if (typeof concept.relevance === 'number') parts.push(`relevance ${concept.relevance.toFixed(2)}`);
  if (typeof concept.times_loaded === 'number') parts.push(`loaded ${concept.times_loaded}`);
  if (typeof concept.times_succeeded === 'number') parts.push(`succeeded ${concept.times_succeeded}`);
  if (typeof concept.times_failed === 'number' && concept.times_failed > 0) {
    parts.push(`failed ${concept.times_failed}`);
  }
  if (!parts.length) return '';
  return `> [!info] Stats\n> ${parts.join(' · ')}\n`;
}

function renderAbstractCallout(summary: string): string {
  if (!summary) return '';
  return `> [!abstract] Summary\n> ${summary.replace(/\n+/g, ' ')}\n`;
}

/**
 * Render the complete note: frontmatter + title + abstract + stats +
 * source + body + related.
 */
export function renderConceptNote(
  concept: ConceptRecord,
  neighbors: ConceptNeighbor[] = [],
  options: RenderOptions = {},
): string {
  const pulledAt = options.pulledAt || new Date().toISOString();
  const shortId = shortConceptId(concept.id);
  const summary = (concept.summary || '').replace(/\n+/g, ' ').trim();
  const titleHuman = humanizeShape(concept.shape || concept.source_type || 'Concept');

  // ─── Frontmatter ─────────────────────────────────────────────────────
  const fm: string[] = ['---'];
  fm.push(`concept_id: ${shortId}`);
  if (concept.shape) fm.push(`shape: ${concept.shape}`);
  if (concept.source_type) fm.push(`source_type: ${concept.source_type}`);
  if (summary) fm.push(`summary: ${yamlQuote(summary)}`);
  if (concept.relevance !== undefined) fm.push(`relevance: ${concept.relevance}`);
  if (concept.times_loaded !== undefined) fm.push(`times_loaded: ${concept.times_loaded}`);
  if (concept.times_succeeded !== undefined) fm.push(`times_succeeded: ${concept.times_succeeded}`);
  if (concept.times_failed !== undefined) fm.push(`times_failed: ${concept.times_failed}`);
  if (concept.updated_at) fm.push(`updated_at: ${concept.updated_at}`);
  fm.push(`last_substrate_pull_at: ${pulledAt}`);
  fm.push('pending_sync: false');
  fm.push('concept-db: true');

  // Tags for Obsidian's tag pane. Nested form `concept/<source>` and
  // `shape/<slug>` lets the operator filter the whole vault by category
  // with a single click. Slashes work inside YAML inline tags but for
  // safety we keep slug values kebab-case only.
  const tags: string[] = [];
  if (concept.source_type) tags.push(`concept/${slugifyShape(concept.source_type)}`);
  if (concept.shape) tags.push(`shape/${slugifyShape(concept.shape)}`);
  if (tags.length) {
    fm.push('tags:');
    for (const t of tags) fm.push(`  - ${t}`);
  }

  fm.push('aliases:');
  fm.push(`  - ${shortId}`);
  if (concept.shape) {
    fm.push(`  - ${yamlQuote(titleHuman)}`);
    fm.push(`  - ${concept.shape}`);
  }
  if (summary) {
    const head = summary.slice(0, 60).trim();
    if (head && head !== titleHuman) fm.push(`  - ${yamlQuote(head)}`);
  }
  fm.push('---');

  // ─── Title + Callouts ────────────────────────────────────────────────
  const heading = `# ${titleHuman}`;
  const abstract = renderAbstractCallout(summary);
  const stats = renderStatsCallout(concept);
  const source = renderPointerCallout(concept.pointer);

  // ─── Body ────────────────────────────────────────────────────────────
  // Drop summary from body when it's already in the abstract callout.
  let body = (concept.content || '').trim();
  if (summary && body.trim() === summary) body = '';

  const related = renderRelatedSection(neighbors);

  const sections: string[] = [fm.join('\n'), '', heading, ''];
  if (abstract) sections.push(abstract);
  if (stats) sections.push(stats);
  if (source) sections.push(source);
  if (body) sections.push(body);
  if (related) sections.push(related);

  return sections.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
