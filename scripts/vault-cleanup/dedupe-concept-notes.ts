#!/usr/bin/env bun
/**
 * dedupe-concept-notes.ts — one-shot cleanup for the obsidian-vessel
 * writeback echo loop (concept_kxeA7gRK7NEW). Scans every `*.md` under
 * `vault/concept-db/` (recursive). For files with frontmatter
 * `concept-db: true` that show the echo signature (more than one
 * occurrence of `> [!abstract] Summary` OR more than one occurrence of
 * the same `# <title>` heading), keeps the FIRST heading + abstract +
 * info + quote callout block and drops every subsequent duplicate.
 *
 * Default mode is dry-run; pass `--apply` to actually rewrite files.
 *
 * Usage:
 *   bun scripts/vault-cleanup/dedupe-concept-notes.ts                       # dry-run
 *   bun scripts/vault-cleanup/dedupe-concept-notes.ts --apply               # mutate
 *   bun scripts/vault-cleanup/dedupe-concept-notes.ts --vault <path>        # override vault root
 */

import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface CleanupReport {
  filesScanned: number;
  filesAffected: number;
  linesBefore: number;
  linesAfter: number;
  totalDuplicateBlocksRemoved: number;
  affected: Array<{
    path: string;
    linesBefore: number;
    linesAfter: number;
    duplicatesRemoved: number;
  }>;
}

function parseArgs(argv: string[]): { apply: boolean; vaultDir: string } {
  let apply = false;
  let vaultDir = resolve(
    new URL('../../vault/concept-db', import.meta.url).pathname,
  );
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') apply = true;
    else if (a === '--vault' && argv[i + 1]) {
      vaultDir = resolve(argv[i + 1]);
      i++;
    }
  }
  return { apply, vaultDir };
}

function walkMarkdown(root: string): string[] {
  const out: string[] = [];
  function recurse(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const p = join(dir, name);
      let st;
      try {
        st = statSync(p);
      } catch {
        continue;
      }
      if (st.isDirectory()) recurse(p);
      else if (st.isFile() && p.endsWith('.md')) out.push(p);
    }
  }
  recurse(root);
  return out;
}

/**
 * Quick frontmatter probe: returns true iff `concept-db: true` is in
 * the leading `---\n…\n---` block. Avoids pulling in a YAML parser.
 */
function isConceptDbNote(content: string): boolean {
  if (!content.startsWith('---')) return false;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return false;
  const fm = content.slice(3, end);
  return /^concept-db:\s*true\s*$/m.test(fm);
}

/**
 * Detect echo signature: more than one `> [!abstract] Summary` OR
 * more than one occurrence of the same `# ` heading. Returns true if
 * the body looks corrupted.
 */
function hasEchoSignature(body: string): boolean {
  const abstractMatches = body.match(/^> \[!abstract\] Summary$/gm);
  if (abstractMatches && abstractMatches.length > 1) return true;

  // Count occurrences of each unique top-level heading.
  const headings = new Map<string, number>();
  for (const line of body.split('\n')) {
    if (/^#\s+\S/.test(line)) {
      headings.set(line, (headings.get(line) || 0) + 1);
    }
  }
  for (const count of headings.values()) {
    if (count > 1) return true;
  }
  return false;
}

/**
 * Identify the leading rendered-wrap block ranges in the body.
 *
 * Returns array of {start, end} index pairs into `lines`, each
 * spanning one rendered wrap unit: optional `# <title>` + run of
 * `[!abstract]`/`[!info]`/`[!quote]` callouts. The FIRST is kept; all
 * subsequent units (and any blank lines between them) are stripped.
 */
function findWrapBlocks(lines: string[]): Array<{ start: number; end: number }> {
  const blocks: Array<{ start: number; end: number }> = [];
  const renderedCallout = /^>\s*\[!(abstract|info|quote)\]/;
  let i = 0;

  while (i < lines.length) {
    // Skip blank lines.
    while (i < lines.length && lines[i].trim() === '') i++;
    if (i >= lines.length) break;

    const start = i;
    let isWrap = false;

    // Optional `# Title` line.
    if (/^#\s+\S/.test(lines[i])) {
      isWrap = true;
      i++;
      while (i < lines.length && lines[i].trim() === '') i++;
    }

    // Run of rendered callouts.
    let sawCallout = false;
    while (i < lines.length && renderedCallout.test(lines[i])) {
      isWrap = true;
      sawCallout = true;
      while (i < lines.length && /^>/.test(lines[i])) i++;
      while (i < lines.length && lines[i].trim() === '') i++;
    }

    if (isWrap && (sawCallout || /^#\s+\S/.test(lines[start]))) {
      blocks.push({ start, end: i });
    } else {
      // Not a wrap; bail — leave the rest as body.
      break;
    }
  }

  return blocks;
}

function dedupeBody(body: string): { body: string; duplicatesRemoved: number } {
  const lines = body.split('\n');
  const blocks = findWrapBlocks(lines);

  if (blocks.length <= 1) {
    return { body, duplicatesRemoved: 0 };
  }

  // Keep block[0]; drop blocks[1..N-1]. The tail (after the last
  // wrap block) is preserved verbatim.
  const keep = blocks[0];
  const tail = blocks[blocks.length - 1].end;

  const head = lines.slice(0, keep.end);
  const rest = lines.slice(tail);

  // Glue with a single blank line if needed.
  let merged = [...head];
  if (
    rest.length > 0 &&
    rest[0].trim() !== '' &&
    merged.length > 0 &&
    merged[merged.length - 1].trim() !== ''
  ) {
    merged.push('');
  }
  merged.push(...rest);

  return {
    body: merged.join('\n'),
    duplicatesRemoved: blocks.length - 1,
  };
}

function processFile(
  path: string,
  apply: boolean,
): { affected: boolean; linesBefore: number; linesAfter: number; duplicates: number } {
  const content = readFileSync(path, 'utf-8');
  const linesBefore = content.split('\n').length;

  if (!isConceptDbNote(content)) {
    return { affected: false, linesBefore, linesAfter: linesBefore, duplicates: 0 };
  }

  const fmEnd = content.indexOf('\n---', 3);
  const fm = content.slice(0, fmEnd + 4); // include `\n---`
  const body = content.slice(fmEnd + 4).replace(/^\n/, '');

  if (!hasEchoSignature(body)) {
    return { affected: false, linesBefore, linesAfter: linesBefore, duplicates: 0 };
  }

  const { body: cleaned, duplicatesRemoved } = dedupeBody(body);
  if (duplicatesRemoved === 0) {
    return { affected: false, linesBefore, linesAfter: linesBefore, duplicates: 0 };
  }

  const next = fm + '\n' + cleaned;
  const linesAfter = next.split('\n').length;

  if (apply) {
    writeFileSync(path, next);
  }

  return {
    affected: true,
    linesBefore,
    linesAfter,
    duplicates: duplicatesRemoved,
  };
}

function main() {
  const { apply, vaultDir } = parseArgs(process.argv.slice(2));
  const mode = apply ? 'APPLY' : 'DRY-RUN';
  console.error(`[dedupe-concept-notes] mode=${mode} vault=${vaultDir}`);

  const files = walkMarkdown(vaultDir);
  const report: CleanupReport = {
    filesScanned: files.length,
    filesAffected: 0,
    linesBefore: 0,
    linesAfter: 0,
    totalDuplicateBlocksRemoved: 0,
    affected: [],
  };

  for (const path of files) {
    let result;
    try {
      result = processFile(path, apply);
    } catch (err) {
      console.error(`[dedupe-concept-notes] error processing ${path}: ${err}`);
      continue;
    }
    report.linesBefore += result.linesBefore;
    report.linesAfter += result.linesAfter;
    if (result.affected) {
      report.filesAffected++;
      report.totalDuplicateBlocksRemoved += result.duplicates;
      report.affected.push({
        path,
        linesBefore: result.linesBefore,
        linesAfter: result.linesAfter,
        duplicatesRemoved: result.duplicates,
      });
    }
  }

  // Human summary
  console.log('\n=== dedupe-concept-notes report ===');
  console.log(`mode:                          ${mode}`);
  console.log(`vault:                         ${vaultDir}`);
  console.log(`files scanned:                 ${report.filesScanned}`);
  console.log(`files affected:                ${report.filesAffected}`);
  console.log(`total duplicate blocks removed: ${report.totalDuplicateBlocksRemoved}`);
  console.log(`lines before (affected only):  ${report.affected.reduce((s, a) => s + a.linesBefore, 0)}`);
  console.log(`lines after  (affected only):  ${report.affected.reduce((s, a) => s + a.linesAfter, 0)}`);
  if (report.affected.length) {
    const sample = report.affected.slice(0, 10);
    console.log('\nfirst 10 affected files:');
    for (const a of sample) {
      console.log(
        `  ${a.path}: ${a.linesBefore} -> ${a.linesAfter} lines (${a.duplicatesRemoved} dup blocks)`,
      );
    }
    if (report.affected.length > 10) {
      console.log(`  …and ${report.affected.length - 10} more`);
    }
  }

  if (!apply && report.filesAffected > 0) {
    console.log('\nRerun with --apply to rewrite files.');
  }
}

main();
