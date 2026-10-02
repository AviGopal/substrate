/**
 * rules.ts — THE RULE TABLE. Single source of truth.
 *
 * `check.ts` (the gate) and `emit-concepts.ts` (the drafter's lesson channel)
 * both generate from this table, so a rule cannot be enforced without also being
 * taught, or taught without being enforced — design.md §3.4.
 *
 * TIERS, and the honest reason for the split
 * ------------------------------------------
 * The vacuity test for any check is: *if I write the violating code the rule is
 * actually about, does the check still pass?* If yes, the check is decoration.
 *
 *   static-easy — the check decides the rule. Writing the violation trips it.
 *   static-hard — the check decides a PROVABLE HALF of the rule. The residue is
 *                 semantic or runtime and belongs to the probe. Each such rule
 *                 carries `notCovered`, which the README renders verbatim.
 *
 * No rule in this table is scored as more than it is.
 */

import {
  type ScannedFile,
  findRegions,
  findMatching,
  lineOf,
  codeIdentifiers,
  jsxExpressions,
} from './scan.ts';

export type Tier = 'static-easy' | 'static-hard';

export interface RawFinding {
  ruleId: string;
  /** Short machine-ish classification, printed as `[kind]`. */
  kind: string;
  /** The offending symbol/expression, printed after the kind. */
  name: string;
  file: string;
  line: number;
  /** Overrides `rule.hint` when the fix is finding-specific. */
  hint?: string;
}

export interface RuleContext {
  root: string;
  /** `.ts` / `.tsx` / `.css` under the surface root, excluding build output. */
  sources: ScannedFile[];
  /** `.js` / `.css` / `.html` under `<root>/dist`. */
  distFiles: ScannedFile[];
}

export interface Rule {
  id: string;
  slug: string;
  /** The contract sentence, as a refusable condition. */
  statement: string;
  tier: Tier;
  /** What the static check actually decides. */
  checks: string;
  /** For static-hard rules: the residue this check does NOT decide. */
  notCovered?: string;
  /** Default hint. Must name BOTH fix paths: the repair and the exemption. */
  hint: string;
  matcher: (ctx: RuleContext) => RawFinding[];
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const TSX = (f: ScannedFile) => f.ext === '.tsx';
const TS_TSX = (f: ScannedFile) => f.ext === '.ts' || f.ext === '.tsx';

const LIVENESS_RE = /\b(refetchInterval|EventSource|setInterval)\b/;

function hasLiveness(f: ScannedFile): boolean {
  return LIVENESS_RE.test(f.code);
}

function firstLineMatching(f: ScannedFile, re: RegExp): number {
  const m = re.exec(f.code);
  return m ? lineOf(f.code, m.index) : 1;
}

/**
 * Region from a declaration index to either its brace BODY or its statement end.
 *
 * The first `{` after a declaration is very often a PARAMETER DESTRUCTURE
 * (`({ value }: Props) => { … }`), not the body. Taking it would scan `{ value }`
 * and never see the body at all — which would let the violating code these rules
 * are about pass by being respelled with destructured params. So a candidate
 * brace is accepted only when the preceding non-whitespace is `=>` (arrow body)
 * or `)` (function body).
 */
function statementRegion(code: string, fromIdx: number): { start: number; end: number } {
  const semiIdx = code.indexOf(';', fromIdx);
  const limit = semiIdx === -1 ? code.length : semiIdx;

  let search = fromIdx;
  while (true) {
    const braceIdx = code.indexOf('{', search);
    if (braceIdx === -1) break;

    let j = braceIdx - 1;
    while (j >= 0 && /\s/.test(code[j])) j--;
    const isBody = code[j] === ')' || (code[j] === '>' && code[j - 1] === '=');

    if (isBody) {
      const close = findMatching(code, braceIdx);
      if (close !== -1) return { start: braceIdx, end: close };
      break;
    }

    // Not the body — skip this brace whole (it may itself contain braces) and
    // keep looking. A destructure never spans past the statement end.
    const close = findMatching(code, braceIdx);
    if (close === -1) break;
    if (close > limit && semiIdx !== -1 && braceIdx > limit) break;
    search = close + 1;
  }

  return { start: fromIdx, end: limit };
}

// ---------------------------------------------------------------------------
// P1 — verdict beside status
// ---------------------------------------------------------------------------

const p1: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TSX)) {
    if (/\breached\b/.test(f.code)) continue;
    // `.status` as a JSX expression container: `{run.status}`, `{x?.status}`,
    // `{run.status === 'failed' ? … : …}`. Deliberately anchored on an
    // identifier chain immediately inside the brace, so an ordinary function
    // body that happens to contain `.status` is not mistaken for JSX.
    const re = /\{\s*[A-Za-z_$][\w$?.[\]]*\.status\b[^{}]{0,60}\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.code)) !== null) {
      out.push({
        ruleId: 'P1',
        kind: 'status_without_verdict',
        name: m[0].trim().slice(0, 60),
        file: f.path,
        line: lineOf(f.code, m.index),
      });
      break; // one finding per file is enough; the fix is file-scoped
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P2 — a suggestion inserts, never dispatches
// ---------------------------------------------------------------------------

const P2_FORBIDDEN: [RegExp, string][] = [
  [/\b(?:dispatch|submit|mutate)[A-Za-z]*\s*\(/g, 'dispatch_call'],
  [/\buse\w*Dispatch(?:Mutation)?\s*\(/g, 'dispatch_hook'],
  [/\brequestSubmit\s*\(/g, 'request_submit'],
];

const p2: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  const declRe = /\b(?:const|let|var|function)\s+(\w*(?:[Ss]tarter|[Ss]uggestion)\w*)\b/g;

  for (const f of ctx.sources.filter(TS_TSX)) {
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(f.code)) !== null) {
      const { start, end } = statementRegion(f.code, d.index + d[0].length);
      const body = f.code.slice(start, end);
      for (const [re, kind] of P2_FORBIDDEN) {
        const rx = new RegExp(re.source, re.flags);
        let m: RegExpExecArray | null;
        while ((m = rx.exec(body)) !== null) {
          out.push({
            ruleId: 'P2',
            kind,
            name: `${d[1]} → ${m[0].trim()}`,
            file: f.path,
            line: lineOf(f.code, start + m.index),
          });
        }
      }
    }
    declRe.lastIndex = 0;
  }
  return out;
};

// ---------------------------------------------------------------------------
// P3 — arrivals are buffered, not spliced
// ---------------------------------------------------------------------------

const p3: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TSX)) {
    if (!hasLiveness(f)) continue;
    if (!/\.map\s*\(/.test(f.code)) continue;

    const liveList = /<LiveList\b[^>]*>/.exec(f.code);
    if (!liveList) {
      out.push({
        ruleId: 'P3',
        kind: 'unbuffered_live_list',
        name: 'live region renders .map() without <LiveList>',
        file: f.path,
        line: firstLineMatching(f, LIVENESS_RE),
      });
      continue;
    }
    if (!/\bbuffer\s*=/.test(liveList[0])) {
      out.push({
        ruleId: 'P3',
        kind: 'missing_buffer_prop',
        name: '<LiveList> without an explicit buffer= prop',
        file: f.path,
        line: lineOf(f.code, liveList.index),
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P4 — stable domain id, never an index key
// ---------------------------------------------------------------------------

/**
 * Name of the second parameter of an inline callback, tolerating TypeScript
 * annotations (`(row: Row, idx: number) => …`). Returns null when the callback
 * is a passed identifier, is destructured, or takes fewer than two parameters.
 */
function secondCallbackParam(body: string): string | null {
  const head = /^\s*(?:async\s+)?(?:function\s*)?\(/.exec(body);
  if (!head) return null;
  const open = head[0].length - 1;
  const close = findMatching(body, open);
  if (close === -1) return null;
  const params = body.slice(open + 1, close);

  // Split on top-level commas only.
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of params) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  if (parts.length < 2) return null;

  const m = /^\s*([A-Za-z_$][\w$]*)/.exec(parts[1]);
  return m ? m[1] : null;
}

const p4: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TSX)) {
    for (const region of findRegions(f.code, /\.(?:map|flatMap)\s*\(/)) {
      // Capture the SECOND callback parameter — whatever it is called.
      // `key={idx}` is exactly the same bug as `key={i}`; nothing here is
      // hardcoded to `i`.
      const indexVar = secondCallbackParam(region.body);
      if (!indexVar) continue;

      const keyRe = /\bkey\s*=\s*\{/g;
      let k: RegExpExecArray | null;
      while ((k = keyRe.exec(region.body)) !== null) {
        const openIdx = region.body.indexOf('{', k.index);
        const close = findMatching(region.body, openIdx);
        if (close === -1) continue;
        const expr = region.body.slice(openIdx + 1, close);
        const ids = codeIdentifiers(expr);
        // Index-derived iff the index var is the ONLY identifier in the
        // expression. `key={`${item.id}-${i}`}` is composite and allowed.
        if (ids.has(indexVar) && ids.size === 1) {
          out.push({
            ruleId: 'P4',
            kind: 'index_key',
            name: `key={${expr.trim()}}`,
            file: f.path,
            line: lineOf(f.code, region.open + 1 + k.index),
            hint:
              `Key on a stable domain id (e.g. key={item.id} / key={run.dispatchId}) instead of the ` +
              `callback index '${indexVar}', or add '// @interaction:exempt P4 — <reason>' on the ` +
              `preceding line if this list is genuinely static and never reorders.`,
          });
        }
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P5 — comparators end in a unique tiebreaker and read nothing volatile
// ---------------------------------------------------------------------------

const P5_VOLATILE = new Set([
  'status',
  'updatedAt',
  'progress',
  'elapsed',
  'lastSeen',
  'iteration',
  'poolSize',
]);
const P5_STABLE_TIEBREAK = /\b(id|dispatchId|traceId)\b/;

const p5: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TS_TSX)) {
    for (const region of findRegions(f.code, /\.(?:sort|toSorted)\s*\(/)) {
      const body = region.body;
      if (!/=>|function/.test(body)) continue;

      const props = new Set<string>();
      for (const m of body.matchAll(/\.([A-Za-z_$][\w$]*)\b/g)) props.add(m[1]);
      // Method calls are not compared fields.
      for (const m of body.matchAll(/\.([A-Za-z_$][\w$]*)\s*\(/g)) props.delete(m[1]);

      const volatile = [...props].filter((p) => P5_VOLATILE.has(p));
      if (volatile.length > 0) {
        out.push({
          ruleId: 'P5',
          kind: 'volatile_sort_field',
          name: `comparator reads ${volatile.join(', ')}`,
          file: f.path,
          line: region.line,
          hint:
            `A comparator must not read a value that changes during a run (${volatile.join(', ')}) — ` +
            `sort on a value fixed at creation and tie-break on a unique id, or add ` +
            `'// @interaction:exempt P5 — <reason>' on the preceding line.`,
        });
        continue;
      }

      if (props.size < 2 && !P5_STABLE_TIEBREAK.test(body)) {
        out.push({
          ruleId: 'P5',
          kind: 'no_tiebreaker',
          name: `comparator over ${props.size} field(s) with no id tiebreaker`,
          file: f.path,
          line: region.line,
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P6 — auto-updating regions expose pause and interval
// ---------------------------------------------------------------------------

const p6: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TS_TSX)) {
    if (!hasLiveness(f)) continue;
    const hasPause = /\b(paused|isPaused|setPaused)\b/.test(f.code);
    // Deliberately word-bounded: `refetchInterval` and `setInterval` — the
    // liveness sources themselves — must NOT satisfy this, or the rule is vacuous.
    const hasInterval = /\b(interval|refreshInterval|intervalMs)\b/.test(f.code);
    const missing = [
      !hasPause ? 'pause control' : null,
      !hasInterval ? 'interval control' : null,
    ].filter(Boolean);
    if (missing.length > 0) {
      out.push({
        ruleId: 'P6',
        kind: 'uncontrolled_live_region',
        name: `live region missing ${missing.join(' and ')}`,
        file: f.path,
        line: firstLineMatching(f, LIVENESS_RE),
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P7 — feedback options are declared, and no agree-affordance is offered
// ---------------------------------------------------------------------------

const P7_AGREE = /(\bagree\b|👍|\bthumbs.?up\b|\blooks good\b|\blgtm\b)/i;

const p7: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TSX)) {
    // options={...}
    const re = /\boptions\s*=\s*\{/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.code)) !== null) {
      const openIdx = f.code.indexOf('{', m.index);
      const close = findMatching(f.code, openIdx);
      if (close === -1) continue;
      const expr = f.code.slice(openIdx + 1, close).trim();
      const line = lineOf(f.code, m.index);

      if (/^[[{]/.test(expr)) {
        out.push({
          ruleId: 'P7',
          kind: 'inline_option_set',
          name: `options={${expr.slice(0, 40)}…}`,
          file: f.path,
          line,
        });
        continue;
      }
      const idMatch = /^([A-Za-z_$][\w$]*)/.exec(expr);
      if (!idMatch) continue;
      const root = idMatch[1];
      const imported = new RegExp(
        `import[^;]*\\b${root}\\b[^;]*from`,
        's',
      ).test(f.code);
      if (!imported) {
        out.push({
          ruleId: 'P7',
          kind: 'undeclared_option_set',
          name: `options={${root}} is not an imported identifier`,
          file: f.path,
          line,
        });
      }
    }

    // Agree-shaped affordance, anywhere in the file.
    const agree = P7_AGREE.exec(f.code);
    if (agree) {
      out.push({
        ruleId: 'P7',
        kind: 'agree_affordance',
        name: agree[0],
        file: f.path,
        line: lineOf(f.code, agree.index),
        hint:
          `An agree-affordance collects assent, not information — replace it with mutually ` +
          `exclusive verdict options, or add '// @interaction:exempt P7 — <reason>' on the ` +
          `preceding line.`,
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P8 — content before, never replaced by, its length or identifier
// ---------------------------------------------------------------------------

const P8_METRIC = /\b(chars|length|traceId|trace_id|dispatchId|sizeBytes)\b/;
const P8_CONTENT = /\b(content|preview|body|text)\b/;

const p8: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TSX)) {
    const openRe = /<EvidenceSlot\b[^>]*?(\/?)>/g;
    let m: RegExpExecArray | null;
    while ((m = openRe.exec(f.code)) !== null) {
      if (m[1] === '/') continue; // self-closing
      const start = m.index + m[0].length;
      const endIdx = f.code.indexOf('</EvidenceSlot>', start);
      if (endIdx === -1) continue;
      const children = f.code.slice(start, endIdx);
      const exprs = jsxExpressions(children);
      if (exprs.length === 0) continue;

      const allMetric = exprs.every((e) => P8_METRIC.test(e.text));
      const anyContent = P8_CONTENT.test(children) || P8_CONTENT.test(m[0]);
      if (allMetric && !anyContent) {
        out.push({
          ruleId: 'P8',
          kind: 'metric_replaces_content',
          name: exprs.map((e) => `{${e.text.trim()}}`).join(' '),
          file: f.path,
          line: lineOf(f.code, m.index),
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P9 — the content-form switch falls through to verbatim
// ---------------------------------------------------------------------------

const P9_BLANK_DEFAULT = /return\s*(?:null|undefined|<>\s*<\/>|<\s*(?:React\.)?Fragment\s*\/>)\s*;?/;
const P9_VERBATIM = /verbatim/i;

const p9: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TS_TSX)) {
    for (const region of findRegions(f.code, /\bswitch\s*\(/)) {
      const discriminant = region.body;
      // The content-form switch, not every switch in the file.
      if (!/\b\w*(?:[Ff]orm|[Ss]hape)\w*\b/.test(discriminant)) continue;

      const braceIdx = f.code.indexOf('{', region.close);
      if (braceIdx === -1) continue;
      const braceClose = findMatching(f.code, braceIdx);
      if (braceClose === -1) continue;
      const switchBody = f.code.slice(braceIdx + 1, braceClose);

      const defaultIdx = switchBody.search(/\bdefault\s*:/);
      if (defaultIdx === -1) {
        out.push({
          ruleId: 'P9',
          kind: 'missing_form_default',
          name: `switch (${discriminant.trim().slice(0, 40)}) has no default:`,
          file: f.path,
          line: region.line,
        });
        continue;
      }

      // Strengthening: a `default: return null` IS the silent blank that P9
      // exists to prevent. Without this the rule is decoration.
      let defaultBody = switchBody.slice(defaultIdx);
      const nextCase = defaultBody.search(/\bcase\s+/);
      if (nextCase !== -1) defaultBody = defaultBody.slice(0, nextCase);

      const line = lineOf(f.code, braceIdx + 1 + defaultIdx);
      if (P9_BLANK_DEFAULT.test(defaultBody)) {
        out.push({
          ruleId: 'P9',
          kind: 'blank_form_default',
          name: 'default: renders nothing',
          file: f.path,
          line,
          hint:
            `An unknown content form must fall through to a VERBATIM renderer — 'default: return null' ` +
            `is the silent blank this rule exists to prevent. Render the raw payload, or add ` +
            `'// @interaction:exempt P9 — <reason>' on the preceding line.`,
        });
      } else if (!P9_VERBATIM.test(defaultBody)) {
        out.push({
          ruleId: 'P9',
          kind: 'non_verbatim_form_default',
          name: 'default: does not reference a verbatim renderer',
          file: f.path,
          line,
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P10 — acceptance distinct from completion; silence rendered as stalled
// ---------------------------------------------------------------------------

const p10: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TS_TSX)) {
    const re = /export\s+type\s+(\w+)\s*=\s*([^;]+);/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.code)) !== null) {
      const [, name, rhs] = m;
      if (!/state|status/i.test(name)) continue;
      const literals = [...rhs.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
      if (literals.length < 2) continue;
      const missing = ['accepted', 'stalled'].filter((l) => !literals.includes(l));
      if (missing.length > 0) {
        out.push({
          ruleId: 'P10',
          kind: 'incomplete_run_state_union',
          name: `${name} is missing ${missing.map((s) => `'${s}'`).join(' and ')}`,
          file: f.path,
          line: lineOf(f.code, m.index),
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P11 — no colour literal outside the token package
// ---------------------------------------------------------------------------

const P11_FUNC = /\b(rgba?|hsla?|oklch|lab|color-mix)\s*\(/g;
const P11_TW_ARBITRARY = /-\[#?[0-9a-fA-F]{3,8}\]/g;

const p11: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources) {
    if (!['.ts', '.tsx', '.css'].includes(f.ext)) continue;

    // Hex — ANCHORED ON '#'. A bare trace id like '994b5e' has no '#' and must
    // never trip; the anchor is what saves us.
    const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
    let m: RegExpExecArray | null;
    while ((m = hexRe.exec(f.code)) !== null) {
      // URL fragments: `/docs#abc`, `page.html#ref`. A colour literal is never
      // preceded by a path character.
      const prev = m.index > 0 ? f.code[m.index - 1] : '';
      if (/[/A-Za-z0-9._-]/.test(prev)) continue;
      const len = m[0].length - 1;
      if (![3, 4, 6, 8].includes(len)) continue;
      out.push({
        ruleId: 'P11',
        kind: 'hex_color_literal',
        name: m[0],
        file: f.path,
        line: lineOf(f.code, m.index),
      });
    }

    for (const re of [P11_FUNC, P11_TW_ARBITRARY]) {
      const rx = new RegExp(re.source, re.flags);
      while ((m = rx.exec(f.code)) !== null) {
        out.push({
          ruleId: 'P11',
          kind: re === P11_FUNC ? 'color_function_literal' : 'arbitrary_color_class',
          name: m[0],
          file: f.path,
          line: lineOf(f.code, m.index),
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P12 — no external host in the built bundle
// ---------------------------------------------------------------------------

const P12_ALLOW = [
  /^https?:\/\/(www\.)?w3\.org\//i,
  /^http:\/\/www\.w3\.org\//i,
];

function p12Allowed(url: string): boolean {
  return P12_ALLOW.some((re) => re.test(url));
}

const p12: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.distFiles) {
    // `f.code` has comments blanked, which removes sourcemap pragmas
    // (`//# sourceMappingURL=`) and license banners for free.
    const absRe = /https?:\/\/[^"'\s)]+/g;
    let m: RegExpExecArray | null;
    while ((m = absRe.exec(f.code)) !== null) {
      if (p12Allowed(m[0])) continue;
      out.push({
        ruleId: 'P12',
        kind: 'external_host',
        name: m[0].slice(0, 80),
        file: f.path,
        line: lineOf(f.code, m.index),
      });
    }

    const relRe = /(^|[^:A-Za-z0-9])\/\/([A-Za-z0-9-]+\.[A-Za-z]{2,}[^"'\s)]*)/g;
    while ((m = relRe.exec(f.code)) !== null) {
      out.push({
        ruleId: 'P12',
        kind: 'protocol_relative_host',
        name: `//${m[2]}`.slice(0, 80),
        file: f.path,
        line: lineOf(f.code, m.index + m[1].length),
      });
    }

    for (const face of findRegions(f.code, /@font-face\s*\{/)) {
      const urlRe = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
      while ((m = urlRe.exec(face.body)) !== null) {
        const u = m[1];
        if (!/^(https?:)?\/\//.test(u)) continue;
        if (p12Allowed(u)) continue;
        out.push({
          ruleId: 'P12',
          kind: 'remote_font_face',
          name: u.slice(0, 80),
          file: f.path,
          line: lineOf(f.code, face.open + 1 + m.index),
        });
      }
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// P13 — no confidence percentage anywhere
// ---------------------------------------------------------------------------

const P13_BINDING = /\b\w*(?:confidence|certainty|probability)\w*\b/i;

const p13: Rule['matcher'] = (ctx) => {
  const out: RawFinding[] = [];
  for (const f of ctx.sources.filter(TS_TSX)) {
    const codeLines = f.code.split('\n');
    for (let i = 0; i < codeLines.length; i++) {
      const line = codeLines[i];
      const binding = P13_BINDING.exec(line);
      if (!binding) continue;
      const pct = /%/.test(line);
      const toFixed = /\btoFixed\s*\(/.test(line);
      if (!pct && !toFixed) continue;
      out.push({
        ruleId: 'P13',
        kind: pct ? 'confidence_percentage' : 'confidence_numeric_format',
        name: `${binding[0]} rendered as ${pct ? 'a percentage' : 'a fixed-point number'}`,
        file: f.path,
        line: i + 1,
      });
    }
  }
  return out;
};

// ---------------------------------------------------------------------------
// The table
// ---------------------------------------------------------------------------

export const RULES: Rule[] = [
  {
    id: 'P1',
    slug: 'verdict-beside-status',
    statement:
      'A verdict and a status are never rendered at equal prominence, and status is never rendered alone.',
    tier: 'static-hard',
    checks:
      'A .tsx that reads `.status` in a JSX expression must also reference `reached` somewhere in the same file.',
    notCovered:
      'Relative prominence. Both symbols can be present and the verdict still rendered as 10px grey text beside a status pill. That is the probe’s verdict-legibility assertion.',
    hint:
      'Render the honest `reached` verdict alongside the template exit `status` (status alone is not evidence), or add `// @interaction:exempt P1 — <reason>` on the preceding line.',
    matcher: p1,
  },
  {
    id: 'P2',
    slug: 'suggestion-inserts-never-dispatches',
    statement: 'A suggestion inserts into an input; it never dispatches.',
    tier: 'static-hard',
    checks:
      'Inside a declaration whose name contains `starter` or `suggestion`, reject `dispatch*(` / `submit*(` / `mutate*(`, `use*Dispatch(Mutation)?`, and `requestSubmit()`.',
    notCovered:
      'Indirection. A starter that calls a locally-aliased helper, or dispatches through a context object under any other name, escapes this check entirely.',
    hint:
      'A starter must only set input state (e.g. `setInput(text)`) and leave the send to the reader, or add `// @interaction:exempt P2 — <reason>` on the preceding line.',
    matcher: p2,
  },
  {
    id: 'P3',
    slug: 'arrivals-buffered-not-spliced',
    statement: 'Arrivals above the viewport are buffered, not spliced.',
    tier: 'static-hard',
    checks:
      'A file with a liveness source (`refetchInterval` / `EventSource` / `setInterval`) that renders a `.map(` list must render it through a `<LiveList>` primitive carrying an explicit `buffer=` prop.',
    notCovered:
      'Whether the buffer does anything. `buffer={() => {}}` or `buffer={0}` passes. Only the probe’s layout-stability run under a simulated arrival stream can decide this.',
    hint:
      'Render live rows through `<LiveList buffer={…}>` so arrivals queue behind a “N new” affordance instead of splicing under the reader, or add `// @interaction:exempt P3 — <reason>` on the preceding line.',
    matcher: p3,
  },
  {
    id: 'P4',
    slug: 'stable-domain-key',
    statement: 'Lists render with a stable domain id, never an index key.',
    tier: 'static-easy',
    checks:
      'Captures the SECOND callback parameter of `.map`/`.flatMap` by name — whatever it is called — and rejects `key={IDX}`, `key={`…${IDX}…`}`, and `key={IDX + 1}` inside that callback.',
    hint:
      'Key on a stable domain id (`key={item.id}`, `key={run.dispatchId}`) rather than the callback index, or add `// @interaction:exempt P4 — <reason>` on the preceding line.',
    matcher: p4,
  },
  {
    id: 'P5',
    slug: 'stable-comparator',
    statement:
      'Every sort comparator ends in a unique tiebreaker, and no comparator reads a value that changes during a run.',
    tier: 'static-hard',
    checks:
      'Inside a `.sort(`/`.toSorted(` callback: reject volatile fields (`status`, `updatedAt`, `progress`, `elapsed`, `lastSeen`, `iteration`, `poolSize`); otherwise require ≥2 compared fields or a comparison on `id`/`dispatchId`/`traceId`.',
    notCovered:
      'Heuristic on both arms. The field list is a denylist, not a proof of stability, and a comparator can be tie-broken correctly and still be fed a changing value at the call site.',
    hint:
      'Compare a value fixed at creation and finish on a unique id (`a.id.localeCompare(b.id)`), or add `// @interaction:exempt P5 — <reason>` on the preceding line.',
    matcher: p5,
  },
  {
    id: 'P6',
    slug: 'pausable-live-region',
    statement: 'Every auto-updating region exposes pause and interval controls.',
    tier: 'static-hard',
    checks:
      'A file with a liveness source must also bind both a `paused`/`isPaused` and an `interval`/`refreshInterval` identifier. (Word-bounded, so `refetchInterval` and `setInterval` cannot satisfy it themselves.)',
    notCovered:
      'Whether the controls are wired or reachable. Two unused `useState` bindings satisfy this check. Freeze-on-interaction is the probe’s job.',
    hint:
      'Expose reader-controlled `paused` and `interval` state for the live region, or add `// @interaction:exempt P6 — <reason>` on the preceding line.',
    matcher: p6,
  },
  {
    id: 'P7',
    slug: 'declared-mece-options-no-agree',
    statement:
      'Feedback options are mutually exclusive and collectively exhaustive, and no agree-affordance is offered.',
    tier: 'static-hard',
    checks:
      '`options=` must bind an imported identifier rather than an inline array/object literal; separately, agree-shaped labels (`agree`, 👍, `thumbs up`, `looks good`, `lgtm`) are rejected anywhere in a .tsx.',
    notCovered:
      'MECE-ness itself. Whether the declared set actually partitions the outcome space is semantic and undecidable here — declaration only makes the set reviewable in one place.',
    hint:
      'Import the verdict option set from a single declared module and drop any agree-affordance (assent is not information), or add `// @interaction:exempt P7 — <reason>` on the preceding line.',
    matcher: p7,
  },
  {
    id: 'P8',
    slug: 'content-before-its-metrics',
    statement: 'Content is rendered before, and never replaced by, its length or identifier.',
    tier: 'static-hard',
    checks:
      'Inside an `<EvidenceSlot>`, violation when every expression child matches `chars|length|traceId|trace_id|dispatchId|sizeBytes` and no `content|preview|body|text` reference appears in the slot.',
    notCovered:
      'Semantics. A slot rendering `{summary}` passes while showing a model-authored gloss instead of the payload; the check cannot tell content from a description of content.',
    hint:
      'Render the payload itself first and let the length or id sit beside it as provenance, or add `// @interaction:exempt P8 — <reason>` on the preceding line.',
    matcher: p8,
  },
  {
    id: 'P9',
    slug: 'form-switch-falls-through-verbatim',
    statement:
      'Rendering dispatches on content form, and an unknown form falls through to verbatim.',
    tier: 'static-easy',
    checks:
      'The switch over the content-form discriminant must have a `default:`, and that default must reference a verbatim renderer and must NOT `return null` / `return <></>`.',
    hint:
      'Fall through to a verbatim renderer that prints the raw payload — `default: return null` is exactly the silent blank this rule exists to prevent — or add `// @interaction:exempt P9 — <reason>` on the preceding line.',
    matcher: p9,
  },
  {
    id: 'P10',
    slug: 'acceptance-and-stall-are-states',
    statement:
      'Acceptance is rendered distinctly from completion, and silence is rendered as stalled.',
    tier: 'static-hard',
    checks:
      'An exported run-state union (type name matching `state`/`status`) must contain the literals `accepted` AND `stalled`.',
    notCovered:
      'Rendering. The union can carry both literals while the component renders `accepted` identically to `completed` and never derives `stalled` from silence at all.',
    hint:
      'Add `\'accepted\'` and `\'stalled\'` to the exported run-state union and render each distinctly, or add `// @interaction:exempt P10 — <reason>` on the preceding line.',
    matcher: p10,
  },
  {
    id: 'P11',
    slug: 'no-color-literal',
    statement: 'No colour literal outside the token package.',
    tier: 'static-easy',
    checks:
      'Over `**/*.{ts,tsx,css}`: `#`-anchored hex, `rgb()/rgba()/hsl()/hsla()/oklch()/lab()/color-mix()`, and Tailwind arbitrary `-[#rrggbb]`. Bare hex-shaped ids (`\'994b5e\'`) and URL fragments (`#section`) do not trip it.',
    hint:
      'Use a semantic state token from `@avigopal/design-tokens` (`var(--state-reached)`, …) — `reached` and `not-reached` are defined at equal weight there and a hand-written hex breaks that pairing — or add `// @interaction:exempt P11 — <reason>` on the preceding line.',
    matcher: p11,
  },
  {
    id: 'P12',
    slug: 'no-external-host-in-bundle',
    statement: 'No external host in the built bundle.',
    tier: 'static-easy',
    checks:
      'Scans BUILD OUTPUT `dist/**/*.{js,css,html}` for absolute URLs, protocol-relative hosts, and remote `@font-face` `url()`. `http://www.w3.org/*` (SVG xmlns), sourcemap pragmas, and license banners are allowlisted. A missing `dist/` is a HARD ERROR, never a skip.',
    hint:
      'Inline or vendor the asset into the bundle, or add `// @interaction:exempt P12 — <reason>` on the preceding line in the source that emits it.',
    matcher: p12,
  },
  {
    id: 'P13',
    slug: 'no-confidence-percentage',
    statement: 'No confidence percentage is rendered anywhere.',
    tier: 'static-easy',
    checks:
      'Rejects a `%` on any line binding `confidence`/`certainty`/`probability`, and `toFixed(` on such a binding.',
    hint:
      'Planner confidence is uncalibrated in this system — conf 0.0 has outperformed conf 0.9 — so a percentage launders a known-bad signal into a precise-looking number. Render the evidence (the trace, the prior outcomes) instead, or add `// @interaction:exempt P13 — <reason>` on the preceding line.',
    matcher: p13,
  },
];

export const RULES_BY_ID: Map<string, Rule> = new Map(RULES.map((r) => [r.id, r]));

/** `P0` is not a contract rule — it is the meta-rule that the exemption channel itself is honest. */
export const P0 = {
  id: 'P0',
  slug: 'exemption-integrity',
  statement:
    'An exemption names a real rule and carries a reason. A bare or misdirected exemption is itself a violation.',
  tier: 'static-easy' as Tier,
  checks:
    'Every `@interaction:exempt` / `@interaction:exempt-file` annotation must name a rule id present in this table and carry a reason of at least 12 non-whitespace characters.',
  hint:
    'Write `// @interaction:exempt <ruleId> — <reason ≥12 chars>` naming a real rule, or delete the annotation and fix the code.',
};
