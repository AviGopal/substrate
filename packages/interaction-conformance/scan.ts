/**
 * scan.ts — file walk, comment stripping, and brace-depth region scanning.
 *
 * Every rule matcher operates on a `ScannedFile`, which carries BOTH:
 *   - `raw`  : the untouched source. Exemption annotations are parsed from this,
 *              because an annotation IS a comment — strip first and it vanishes.
 *   - `code` : the same source with every comment replaced by spaces, preserving
 *              byte offsets and line numbers. Rule matchers use this, so a hex
 *              literal inside a comment cannot trip P11.
 *
 * The region scanner is the same technique `shape-dispatch-check` uses to find
 * the end of a `shapes: [ ... ]` array — bracket depth counting — generalised to
 * `(`/`[`/`{` and made string-aware so brackets inside literals do not confuse it.
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, extname } from 'path';

export interface ScannedFile {
  /** Absolute path. */
  path: string;
  /** Path relative to the scan root. */
  rel: string;
  /** File extension including the dot, e.g. `.tsx`. */
  ext: string;
  /** Untouched source. */
  raw: string;
  /** Source with comments blanked out, offsets preserved. */
  code: string;
  /** `raw` split on newlines. Index 0 is line 1. */
  rawLines: string[];
}

/** Directories never descended into during an ordinary source scan. */
export const DEFAULT_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  'coverage',
  '.turbo',
  '.cache',
]);

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

export function walkFiles(
  root: string,
  exts: string[],
  opts: { exclude?: Set<string> } = {},
): string[] {
  const exclude = opts.exclude ?? DEFAULT_EXCLUDED_DIRS;
  const out: string[] = [];

  const recurse = (dir: string) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (exclude.has(entry.name)) continue;
        recurse(p);
      } else if (entry.isFile()) {
        if (exts.includes(extname(entry.name))) out.push(p);
      }
    }
  };

  if (existsSync(root) && statSync(root).isDirectory()) recurse(root);
  return out.sort();
}

export function loadFiles(root: string, paths: string[]): ScannedFile[] {
  return paths.map((p) => {
    const raw = readFileSync(p, 'utf8');
    const ext = extname(p);
    return {
      path: p,
      rel: p.startsWith(root) ? p.slice(root.length).replace(/^[/\\]/, '') : p,
      ext,
      raw,
      code: stripComments(raw, commentModeFor(ext)),
      rawLines: raw.split('\n'),
    };
  });
}

export type CommentMode = 'js' | 'css' | 'html';

export function commentModeFor(ext: string): CommentMode {
  if (ext === '.css') return 'css';
  if (ext === '.html' || ext === '.htm') return 'html';
  return 'js';
}

// ---------------------------------------------------------------------------
// Comment stripping (length- and line-preserving)
// ---------------------------------------------------------------------------

/**
 * Replace comment bodies with spaces, keeping every newline and every byte
 * offset intact so that `lineOf(code, idx)` agrees with the raw source.
 *
 * String and template literals are preserved verbatim — colour literals and URLs
 * live inside them, and blanking them would make P11/P12 vacuous.
 */
export function stripComments(src: string, mode: CommentMode = 'js'): string {
  const out = src.split('');
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== '\n') out[k] = ' ';
    }
  };

  if (mode === 'html') {
    // Only `<!-- ... -->`.
    let i = 0;
    while (i < src.length) {
      if (src.startsWith('<!--', i)) {
        const end = src.indexOf('-->', i + 4);
        const stop = end === -1 ? src.length : end + 3;
        blank(i, stop);
        i = stop;
        continue;
      }
      i++;
    }
    return out.join('');
  }

  const allowLineComments = mode === 'js';
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    // String / template literal — copy through untouched.
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === quote) {
          i++;
          break;
        }
        // An unterminated single/double quoted string cannot span a newline.
        if (quote !== '`' && src[i] === '\n') break;
        i++;
      }
      continue;
    }

    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blank(i, stop);
      i = stop;
      continue;
    }

    if (allowLineComments && c === '/' && src[i + 1] === '/') {
      let end = src.indexOf('\n', i);
      if (end === -1) end = src.length;
      blank(i, end);
      i = end;
      continue;
    }

    i++;
  }

  return out.join('');
}

// ---------------------------------------------------------------------------
// Region scanning
// ---------------------------------------------------------------------------

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '{': '}' };

/**
 * Given the index of an opening bracket in comment-stripped code, return the
 * index of its match, or -1. String-aware: brackets inside literals are ignored.
 */
export function findMatching(code: string, openIdx: number): number {
  const open = code[openIdx];
  const close = PAIRS[open];
  if (!close) return -1;

  let depth = 0;
  let quote: string | null = null;

  for (let i = openIdx; i < code.length; i++) {
    const c = code[i];

    if (quote) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }

    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) return i;
    }
  }

  return -1;
}

export interface Region {
  /** Index where the triggering match began. */
  matchIndex: number;
  /** The full triggering match text. */
  matchText: string;
  /** Capture groups from the triggering regex. */
  groups: string[];
  /** Index of the opening bracket. */
  open: number;
  /** Index of the closing bracket. */
  close: number;
  /** Text between the brackets, exclusive. */
  body: string;
  /** 1-based line of `matchIndex`. */
  line: number;
}

/**
 * Find every region introduced by `re`, whose match MUST end on an opening
 * bracket (e.g. `/\.map\(/` or `/switch\s*\(/`).
 *
 * Regions are returned in source order and may nest; callers that care about
 * innermost-wins should compare `open`/`close` spans themselves.
 */
export function findRegions(code: string, re: RegExp): Region[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const rx = new RegExp(re.source, flags);
  const regions: Region[] = [];
  let m: RegExpExecArray | null;

  while ((m = rx.exec(code)) !== null) {
    const open = m.index + m[0].length - 1;
    if (!PAIRS[code[open]]) continue;
    const close = findMatching(code, open);
    if (close === -1) continue;
    regions.push({
      matchIndex: m.index,
      matchText: m[0],
      groups: m.slice(1),
      open,
      close,
      body: code.slice(open + 1, close),
      line: lineOf(code, m.index),
    });
    if (m.index === rx.lastIndex) rx.lastIndex++;
  }

  return regions;
}

/** 1-based line number of a character offset. */
export function lineOf(text: string, idx: number): number {
  let line = 1;
  for (let i = 0; i < idx && i < text.length; i++) {
    if (text[i] === '\n') line++;
  }
  return line;
}

/**
 * Identifiers that are actual CODE inside a JSX expression: string literal
 * bodies are dropped, and only `${...}` interiors of template literals are kept.
 *
 * This is what lets P4 distinguish `key={`row-${idx}`}` (identifiers: {idx} →
 * index key) from `key={`${item.id}-${idx}`}` (identifiers: {item, id, idx} →
 * composite, not an index key).
 */
export function codeIdentifiers(expr: string): Set<string> {
  let cleaned = '';
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < expr.length && expr[i] !== c) {
        if (expr[i] === '\\') i++;
        i++;
      }
      i++;
      continue;
    }
    if (c === '`') {
      i++;
      while (i < expr.length && expr[i] !== '`') {
        if (expr[i] === '\\') {
          i += 2;
          continue;
        }
        if (expr[i] === '$' && expr[i + 1] === '{') {
          const close = findMatching(expr, i + 1);
          const stop = close === -1 ? expr.length : close;
          cleaned += ' ' + expr.slice(i + 2, stop) + ' ';
          i = stop + 1;
          continue;
        }
        i++;
      }
      i++;
      continue;
    }
    cleaned += c;
    i++;
  }

  const ids = new Set<string>();
  for (const m of cleaned.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) ids.add(m[0]);
  return ids;
}

/**
 * Extract top-level `{ ... }` expression containers from a JSX children blob.
 */
export function jsxExpressions(body: string): { text: string; index: number }[] {
  const out: { text: string; index: number }[] = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === '{') {
      const close = findMatching(body, i);
      if (close === -1) break;
      out.push({ text: body.slice(i + 1, close), index: i });
      i = close + 1;
      continue;
    }
    i++;
  }
  return out;
}
