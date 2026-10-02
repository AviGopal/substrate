/**
 * exempt.ts — the `@interaction:exempt` annotation channel.
 *
 * Syntax (line-level):
 *   // @interaction:exempt P4 — this list is fixed at build time and never reorders
 *   <the line the rule flags>
 *
 * Syntax (file-level, within the first 5 lines):
 *   // @interaction:exempt-file P11 — this file IS the token package emitter
 *
 * Separators `—`, `--`, and `-` are all accepted.
 *
 * Two things make this channel honest rather than a hole:
 *   1. A BARE exemption (no reason, or a reason under 12 non-whitespace chars)
 *      is itself a violation, reported as P0/`bare_exemption`.
 *   2. An exemption naming an unknown rule id is reported as P0/`unknown_rule`,
 *      so a typo fails loudly instead of silently exempting nothing.
 *
 * An INVALID exemption never suppresses. That is the point: if it suppressed,
 * the cheapest way past the gate would be to misspell a rule id.
 */

import type { RawFinding } from './rules.ts';
import type { ScannedFile } from './scan.ts';

export const MIN_REASON_CHARS = 12;

const LINE_RE =
  /@interaction:exempt\s+([A-Za-z][\w-]*)?\s*(?:(—|--|-)\s*(.*))?$/;
const FILE_RE =
  /@interaction:exempt-file\s+([A-Za-z][\w-]*)?\s*(?:(—|--|-)\s*(.*))?$/;

export interface ParsedAnnotation {
  ruleId: string | null;
  reason: string;
  line: number; // 1-based
  scope: 'line' | 'file';
}

export interface ExemptionIndex {
  /** `${file}:${line}` → set of rule ids validly exempted for that line. */
  lineExempt: Map<string, Set<string>>;
  /** file path → set of rule ids validly exempted for the whole file. */
  fileExempt: Map<string, Set<string>>;
  /** P0 findings raised by malformed annotations. */
  findings: RawFinding[];
}

function parseLine(text: string): ParsedAnnotation | null {
  if (!text.includes('@interaction:exempt')) return null;

  const fileMatch = FILE_RE.exec(text);
  if (fileMatch) {
    return {
      ruleId: fileMatch[1] ?? null,
      reason: (fileMatch[3] ?? '').trim(),
      line: 0,
      scope: 'file',
    };
  }

  const lineMatch = LINE_RE.exec(text);
  if (lineMatch) {
    return {
      ruleId: lineMatch[1] ?? null,
      reason: (lineMatch[3] ?? '').trim(),
      line: 0,
      scope: 'line',
    };
  }

  // `@interaction:exempt` present but shaped wrong — treat as bare.
  return { ruleId: null, reason: '', line: 0, scope: 'line' };
}

function reasonLength(reason: string): number {
  return reason.replace(/\s+/g, '').length;
}

/**
 * Walk backwards from a flagged line to the nearest preceding non-blank line,
 * matching `shape-dispatch-check`'s `@shape-dispatch:private` walk exactly.
 * Returns the 1-based line number of the annotation, or null.
 */
export function precedingAnnotationLine(
  rawLines: string[],
  flaggedLine: number,
): number | null {
  for (let i = flaggedLine - 2; i >= 0; i--) {
    const t = rawLines[i].trim();
    if (t === '') continue;
    if (t.includes('@interaction:exempt')) return i + 1;
    return null;
  }
  return null;
}

export function buildExemptionIndex(
  files: ScannedFile[],
  knownRuleIds: Set<string>,
): ExemptionIndex {
  const lineExempt = new Map<string, Set<string>>();
  const fileExempt = new Map<string, Set<string>>();
  const findings: RawFinding[] = [];

  const add = (map: Map<string, Set<string>>, key: string, ruleId: string) => {
    let s = map.get(key);
    if (!s) map.set(key, (s = new Set()));
    s.add(ruleId);
  };

  for (const f of files) {
    for (let i = 0; i < f.rawLines.length; i++) {
      const raw = f.rawLines[i];
      if (!raw.includes('@interaction:exempt')) continue;
      const ann = parseLine(raw);
      if (!ann) continue;
      const lineNo = i + 1;

      if (ann.scope === 'file' && lineNo > 5) {
        findings.push({
          ruleId: 'P0',
          kind: 'misplaced_file_exemption',
          name: `@interaction:exempt-file ${ann.ruleId ?? '<none>'}`,
          file: f.path,
          line: lineNo,
          hint:
            'A file-level exemption must appear within the first 5 lines of the file, where a reader will see it. Move it to the header, or use a line-level `// @interaction:exempt <rule> — <reason>` instead.',
        });
        continue;
      }

      if (!ann.ruleId) {
        findings.push({
          ruleId: 'P0',
          kind: 'bare_exemption',
          name: raw.trim().slice(0, 70),
          file: f.path,
          line: lineNo,
          hint:
            'An exemption must name a rule id: `// @interaction:exempt P4 — <reason>`. An unnamed exemption suppresses nothing and is itself a violation.',
        });
        continue;
      }

      if (!knownRuleIds.has(ann.ruleId)) {
        findings.push({
          ruleId: 'P0',
          kind: 'unknown_rule',
          name: `${ann.ruleId} is not a rule in this table`,
          file: f.path,
          line: lineNo,
          hint:
            `'${ann.ruleId}' matches no rule id — a typo here would silently exempt nothing, so it fails loudly instead. ` +
            `Run with --list to see the rule table, or delete the annotation and fix the code.`,
        });
        continue;
      }

      if (reasonLength(ann.reason) < MIN_REASON_CHARS) {
        findings.push({
          ruleId: 'P0',
          kind: 'bare_exemption',
          name: `@interaction:exempt ${ann.ruleId} (reason: ${reasonLength(ann.reason)} chars, need ${MIN_REASON_CHARS})`,
          file: f.path,
          line: lineNo,
          hint:
            `Give the exemption a reason of at least ${MIN_REASON_CHARS} non-whitespace characters explaining why this divergence is deliberate, or delete the annotation and fix the code.`,
        });
        continue;
      }

      // Valid.
      if (ann.scope === 'file') {
        add(fileExempt, f.path, ann.ruleId);
      } else {
        // Suppresses the NEXT non-blank line.
        let target = -1;
        for (let j = i + 1; j < f.rawLines.length; j++) {
          if (f.rawLines[j].trim() === '') continue;
          target = j + 1;
          break;
        }
        if (target !== -1) add(lineExempt, `${f.path}:${target}`, ann.ruleId);
        // Also honour the annotation's own line, for rules that report on the
        // construct opener rather than the flagged expression.
        add(lineExempt, `${f.path}:${lineNo}`, ann.ruleId);
      }
    }
  }

  return { lineExempt, fileExempt, findings };
}

export function isExempt(
  index: ExemptionIndex,
  finding: RawFinding,
  rawLinesByFile: Map<string, string[]>,
): boolean {
  if (index.fileExempt.get(finding.file)?.has(finding.ruleId)) return true;
  if (index.lineExempt.get(`${finding.file}:${finding.line}`)?.has(finding.ruleId)) {
    return true;
  }
  // Backward walk from the flagged line, mirroring shape-dispatch.
  const rawLines = rawLinesByFile.get(finding.file);
  if (!rawLines) return false;
  const annLine = precedingAnnotationLine(rawLines, finding.line);
  if (annLine === null) return false;
  return index.lineExempt.get(`${finding.file}:${annLine}`)?.has(finding.ruleId) ?? false;
}
