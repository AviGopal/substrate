/**
 * cite-check.ts — verify code citations in investigation markdown files
 *
 * Usage:
 *   bun run validation/scripts/cite-check.ts [investigation-file-or-glob]
 *   bun run validation/scripts/cite-check.ts validation/investigations/*.md
 *
 * Extracts path:line and path:line-line citations, checks:
 *   1. File exists at the cited path
 *   2. Line range is within file bounds
 *   3. If a code snippet is quoted nearby, it textually overlaps the actual line(s)
 *
 * Exit 0 = all cites verified. Exit 1 = one or more fails.
 *
 * Background (inv-072): 10 retractions across 50 iterations, all traceable
 * to citations filed WITHOUT inline grep evidence. This script catches the
 * syntactic class (~30%): line-rot, missing files, wrong line numbers.
 * The semantic class (layer-confusion) still requires subagent verification.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { globSync } from "bun";

const REPO_ROOT = resolve(import.meta.dir, "../../");

// Match patterns like:
//   repos/foo/src/bar.ts:42
//   repos/foo/src/bar.ts:42-67
//   `repos/foo/src/bar.ts:42-67`
//   (repos/foo/src/bar.ts:42)
const CITE_RE = /(?:^|[\s(`])(`?)(repos\/[^\s:`)]+\.(?:ts|js|json|py|go|sh|md)):(\d+)(?:-(\d+))?(`?)/gm;

type CiteResult = {
  file: string;
  citation: string;
  line: number;
  endLine?: number;
  pass: boolean;
  reason: string;
  snippet?: string;
};

function checkCite(
  filePath: string,
  startLine: number,
  endLine: number | undefined,
  nearbyText: string,
): { pass: boolean; reason: string } {
  const absPath = join(REPO_ROOT, filePath);
  if (!existsSync(absPath)) {
    return { pass: false, reason: `file not found: ${filePath}` };
  }

  const lines = readFileSync(absPath, "utf-8").split("\n");
  const totalLines = lines.length;

  if (startLine < 1 || startLine > totalLines) {
    return { pass: false, reason: `line ${startLine} out of bounds (file has ${totalLines} lines)` };
  }

  if (endLine !== undefined && endLine > totalLines) {
    return { pass: false, reason: `end line ${endLine} out of bounds (file has ${totalLines} lines)` };
  }

  const end = endLine ?? startLine;
  const citedLines = lines.slice(startLine - 1, end).join("\n");

  // Check for inline code snippets in the nearby text (```...``` or `...`)
  const snippetRe = /```[\s\S]*?```|`[^`\n]+`/g;
  const snippets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = snippetRe.exec(nearbyText)) !== null) {
    snippets.push(m[0].replace(/^```\w*\n?/, "").replace(/\n?```$/, "").replace(/^`/, "").replace(/`$/, "").trim());
  }

  // Snippet content matching: only check if a fenced code block appears within 80 chars
  // AFTER the citation (direct inline evidence pattern). Don't check blocks that appear
  // before the cite (those are context, not evidence for this specific cite).
  // This catches cases where the cited line doesn't match the quoted snippet directly
  // following it — the most reliable signal of cite-rot.
  const afterCite = nearbyText.slice(nearbyText.indexOf(filePath) + filePath.length);
  const fencedAfter = afterCite.match(/^[^`]*```[\w]*\n([\s\S]*?)```/);
  if (fencedAfter && fencedAfter[1]) {
    const fencedContent = fencedAfter[1].trim();
    // Only validate if the fenced block is short enough to be a direct quote (≤10 lines)
    const fencedLines = fencedContent.split("\n").filter(l => l.trim());
    if (fencedLines.length <= 10) {
      const tokens = fencedContent.split(/[\s,.()\[\]{};:=+]+/).filter(t => t.length > 5);
      const anyMatch = tokens.slice(0, 5).some(tok => citedLines.includes(tok));
      if (!anyMatch && tokens.length > 0) {
        return {
          pass: false,
          reason: `inline snippet mismatch — token "${tokens[0]}" not found at ${filePath}:${startLine}${endLine ? `-${endLine}` : ""}`,
        };
      }
    }
  }

  return { pass: true, reason: `ok (${totalLines} lines, line ${startLine} in bounds)` };
}

function extractCites(markdownPath: string): CiteResult[] {
  const content = readFileSync(markdownPath, "utf-8");
  const results: CiteResult[] = [];

  let m: RegExpExecArray | null;
  const re = new RegExp(CITE_RE.source, CITE_RE.flags);

  while ((m = re.exec(content)) !== null) {
    const filePath = m[2]!;
    const startLine = parseInt(m[3]!, 10);
    const endLine = m[4] ? parseInt(m[4], 10) : undefined;

    // Extract ~200 chars of context around the cite for snippet comparison
    const ctxStart = Math.max(0, m.index - 150);
    const ctxEnd = Math.min(content.length, m.index + m[0].length + 150);
    const nearby = content.slice(ctxStart, ctxEnd);

    const { pass, reason } = checkCite(filePath, startLine, endLine, nearby);
    const citation = `${filePath}:${startLine}${endLine ? `-${endLine}` : ""}`;

    results.push({ file: markdownPath, citation, line: startLine, endLine, pass, reason });
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    // Default: check recent investigations
    const files = globSync("validation/investigations/*.md", { cwd: REPO_ROOT });
    args.push(...files.slice(-10).map(f => join(REPO_ROOT, f)));
  }

  const targets: string[] = [];
  for (const arg of args) {
    if (arg.includes("*")) {
      targets.push(...globSync(arg, { cwd: REPO_ROOT }).map(f => join(REPO_ROOT, f)));
    } else {
      targets.push(arg.startsWith("/") ? arg : join(REPO_ROOT, arg));
    }
  }

  let totalCites = 0;
  let fails = 0;
  const byFile: Map<string, CiteResult[]> = new Map();

  for (const f of targets) {
    if (!existsSync(f)) continue;
    const results = extractCites(f);
    if (results.length > 0) {
      byFile.set(f, results);
      totalCites += results.length;
      fails += results.filter(r => !r.pass).length;
    }
  }

  for (const [file, results] of byFile) {
    const fileName = file.replace(REPO_ROOT + "/", "");
    const fileFails = results.filter(r => !r.pass);
    if (fileFails.length > 0) {
      console.log(`\n✗ ${fileName} (${fileFails.length}/${results.length} cites failed)`);
      for (const r of results) {
        const icon = r.pass ? "  ✓" : "  ✗";
        console.log(`${icon} ${r.citation} — ${r.reason}`);
      }
    } else if (results.length > 0) {
      console.log(`✓ ${fileName} (${results.length} cites verified)`);
    }
  }

  console.log(`\n${totalCites - fails}/${totalCites} citations verified across ${byFile.size} files`);
  if (fails > 0) {
    console.log(`${fails} citation(s) failed — file/line rotted or snippet mismatch`);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
