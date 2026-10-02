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

import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';

interface Finding {
  kind: 'unhandled_advertised' | 'orphan_handler';
  shape: string;
  file: string;
  line: number;
  hint: string;
}

interface Config {
  mappings?: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/**
 * Extract string literals from a `shapes: [...]` array in a source file.
 * Returns a map of shape → line number (1-based).
 *
 * Tolerates multi-line arrays and inline comments. Stops at the first
 * unbalanced `]` that terminates the array block.
 */
function extractAdvertisedShapes(
  source: string,
  filePath: string,
): Map<string, number> {
  const shapes = new Map<string, number>();
  const lines = source.split('\n');

  // Find the start of a shapes array. Patterns:
  //   shapes: [
  //   advertised_shapes: [
  //   ADVERTISED_SHAPES = [
  const startPattern = /(?:shapes|advertised_shapes|ADVERTISED_SHAPES)\s*[:=]\s*\[/;
  let inArray = false;
  let depth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    if (!inArray) {
      const match = startPattern.exec(line);
      if (match) {
        inArray = true;
        // Count brackets on this same line
        for (const ch of line.slice(match.index + match[0].length - 1)) {
          if (ch === '[') depth++;
          else if (ch === ']') depth--;
        }
        if (depth <= 0) inArray = false; // array opened and closed on one line
        // Extract any literals on this first line too
        for (const m of line.matchAll(/['"]([^'"]+)['"]/g)) {
          shapes.set(m[1], lineNum);
        }
      }
      continue;
    }

    // Inside the shapes array
    // Track bracket depth to know when the array ends
    let newDepth = depth;
    for (const ch of line) {
      if (ch === '[') newDepth++;
      else if (ch === ']') newDepth--;
    }

    if (newDepth <= 0) {
      // Last line of the array — extract literals before closing bracket
      const closingIdx = line.lastIndexOf(']');
      const segment = closingIdx >= 0 ? line.slice(0, closingIdx) : line;
      for (const m of segment.matchAll(/['"]([^'"]+)['"]/g)) {
        shapes.set(m[1], lineNum);
      }
      inArray = false;
      depth = 0;
      continue;
    }

    depth = newDepth;

    // Extract string literals on this line (skip comment-only lines)
    const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    for (const m of stripped.matchAll(/['"]([^'"]+)['"]/g)) {
      shapes.set(m[1], lineNum);
    }
  }

  return shapes;
}

/**
 * Extract switch case literals from a routes/impulses.ts dispatch handler.
 * Returns a map of case-literal → { line, private: boolean }.
 *
 * A case is marked private when the immediately preceding non-blank line
 * contains `// @shape-dispatch:private`.
 */
function extractDispatchCases(source: string): Map<string, { line: number; private: boolean }> {
  const cases = new Map<string, { line: number; private: boolean }>();
  const lines = source.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match:  case 'foo':  or  case "foo":
    const match = /^\s*case\s+(['"])([^'"]+)\1\s*:/.exec(line);
    if (!match) continue;

    const literal = match[2];
    const lineNum = i + 1;

    // A case is private if:
    // (a) the immediately preceding non-blank line contains @shape-dispatch:private, OR
    // (b) this case is part of a fall-through group where a preceding case in the
    //     same group has the annotation (walk back through consecutive case statements).
    let isPrivate = false;
    for (let j = i - 1; j >= 0; j--) {
      const prev = lines[j].trim();
      if (prev === '') continue;
      if (prev.includes('@shape-dispatch:private')) { isPrivate = true; break; }
      // If previous non-blank line is another case statement, continue walking back
      if (/^case\s+['"]/.test(prev)) continue;
      // Anything else (block opener, statement, etc.) stops the walk
      break;
    }

    cases.set(literal, { line: lineNum, private: isPrivate });
  }

  return cases;
}

// ---------------------------------------------------------------------------
// Diff computation
// ---------------------------------------------------------------------------

function computeDiff(
  advertised: Map<string, number>,
  dispatched: Map<string, { line: number; private: boolean }>,
  configMappings: Record<string, string[]>,
  configFile: string,
  dispatchFile: string,
): Finding[] {
  const findings: Finding[] = [];

  // Build a set of advertised shapes that are "covered" after applying mappings
  // mapping: advertisedShape → [caseLabel, ...]
  const advertisedResolved = new Map<string, string[]>();
  for (const [shape] of advertised) {
    if (configMappings[shape]) {
      advertisedResolved.set(shape, configMappings[shape]);
    } else {
      advertisedResolved.set(shape, [shape]);
    }
  }

  // Build a set of all case labels that are "claimed" by an advertised shape
  const claimedLabels = new Set<string>();
  for (const [, labels] of advertisedResolved) {
    for (const l of labels) claimedLabels.add(l);
  }

  // Unhandled advertised: advertised shape has no matching case for any of its labels
  for (const [shape, labels] of advertisedResolved) {
    const hasCase = labels.some((l) => dispatched.has(l));
    if (!hasCase) {
      const line = advertised.get(shape) ?? 0;
      findings.push({
        kind: 'unhandled_advertised',
        shape,
        file: configFile,
        line,
        hint: `Add a dispatch case for '${shape}' in src/routes/impulses.ts, or remove it from the shapes array in src/config.ts.`,
      });
    }
  }

  // Orphan handlers: case label has no advertised shape (and is not private)
  for (const [label, { line, private: isPrivate }] of dispatched) {
    if (isPrivate) continue;
    if (!claimedLabels.has(label)) {
      findings.push({
        kind: 'orphan_handler',
        shape: label,
        file: dispatchFile,
        line,
        hint: `Add '${label}' to the shapes array in src/config.ts, or annotate with '// @shape-dispatch:private' above the case if it is intentionally internal.`,
      });
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const vesselRoot = resolve(args[0] ?? process.cwd());

  const configPath = join(vesselRoot, 'src', 'config.ts');
  const dispatchPath = join(vesselRoot, 'src', 'routes', 'impulses.ts');
  const overridePath = join(vesselRoot, 'shape-dispatch.config.json');

  // Validate input files exist
  const missing: string[] = [];
  if (!existsSync(configPath)) missing.push(configPath);
  if (!existsSync(dispatchPath)) missing.push(dispatchPath);

  if (missing.length > 0) {
    console.error('shape-dispatch-check: required files not found:');
    for (const f of missing) console.error(`  ${f}`);
    console.error(
      '\nThis check expects a vessel with src/config.ts (shapes array) and src/routes/impulses.ts (switch dispatch).',
    );
    process.exit(1);
  }

  // Load optional config override
  let configOverride: Config = {};
  if (existsSync(overridePath)) {
    try {
      configOverride = JSON.parse(readFileSync(overridePath, 'utf8'));
    } catch (e) {
      console.error(`shape-dispatch-check: failed to parse ${overridePath}:`, e);
      process.exit(1);
    }
  }
  const mappings: Record<string, string[]> = configOverride.mappings ?? {};

  // Parse source files
  const configSource = readFileSync(configPath, 'utf8');
  const dispatchSource = readFileSync(dispatchPath, 'utf8');

  const advertised = extractAdvertisedShapes(configSource, configPath);
  const dispatched = extractDispatchCases(dispatchSource);

  if (advertised.size === 0) {
    console.warn(
      `shape-dispatch-check: no advertised shapes found in ${configPath}.\n` +
        `  Expected a 'shapes: [...]' or 'advertised_shapes: [...]' array.`,
    );
    // Not a hard error — vessel may not have discovery shapes yet.
    process.exit(0);
  }

  // Compute diff
  const findings = computeDiff(
    advertised,
    dispatched,
    mappings,
    configPath,
    dispatchPath,
  );

  // Report
  if (findings.length === 0) {
    console.log(`shape-dispatch-check: OK — ${advertised.size} advertised shapes, ${dispatched.size} dispatch cases, all agree.`);
    process.exit(0);
  }

  const unhandled = findings.filter((f) => f.kind === 'unhandled_advertised');
  const orphans = findings.filter((f) => f.kind === 'orphan_handler');

  console.error(
    `shape-dispatch-check: ${findings.length} violation(s) found in ${vesselRoot}\n`,
  );

  if (unhandled.length > 0) {
    console.error(`UNHANDLED ADVERTISED SHAPES (${unhandled.length}):`);
    console.error('  Shape is advertised in config.ts but has no dispatch case in routes/impulses.ts.\n');
    for (const f of unhandled) {
      console.error(`  [unhandled] ${f.shape}`);
      console.error(`    at ${f.file}:${f.line}`);
      console.error(`    → ${f.hint}\n`);
    }
  }

  if (orphans.length > 0) {
    console.error(`ORPHAN DISPATCH HANDLERS (${orphans.length}):`);
    console.error('  Case exists in routes/impulses.ts but shape is not advertised in config.ts.\n');
    for (const f of orphans) {
      console.error(`  [orphan] ${f.shape}`);
      console.error(`    at ${f.file}:${f.line}`);
      console.error(`    → ${f.hint}\n`);
    }
  }

  console.error(
    `\nTo suppress an intentionally internal case, add '// @shape-dispatch:private' on the line immediately before it.`,
  );
  console.error(
    `To map an advertised shape to different case label(s), create shape-dispatch.config.json with a "mappings" block.`,
  );

  process.exit(1);
}

main();
