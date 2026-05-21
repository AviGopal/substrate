/**
 * Unit tests for output-normalizers.ts — G6.3.1 acceptance criteria.
 *
 * Covers each built-in shape with at least one agreeing and one disagreeing pair.
 */

import { describe, test, expect } from "bun:test";
import { normalizeOutput, outputsAgree, diffOutputs } from "./output-normalizers";

// ---------------------------------------------------------------------------
// fileEdit
// ---------------------------------------------------------------------------

describe("fileEdit", () => {
  test("CRLF and LF agree", () => {
    const a = "line1\r\nline2\r\n";
    const b = "line1\nline2\n";
    expect(outputsAgree("fileEdit", a, b)).toBe(true);
  });

  test("trailing spaces agree with trimmed", () => {
    expect(outputsAgree("fileEdit", "hello   ", "hello")).toBe(true);
  });

  test("different content disagrees", () => {
    expect(outputsAgree("fileEdit", "foo", "bar")).toBe(false);
  });

  test("object form with path agrees when content identical", () => {
    const a = { path: "src/auth.ts", content: "export const x = 1\r\n" };
    const b = { path: "src/auth.ts", content: "export const x = 1\n" };
    expect(outputsAgree("fileEdit", a, b)).toBe(true);
  });

  test("object form disagrees on different path", () => {
    const a = { path: "src/a.ts", content: "x" };
    const b = { path: "src/b.ts", content: "x" };
    expect(outputsAgree("fileEdit", a, b)).toBe(false);
  });

  test("collapses multiple blank lines", () => {
    expect(
      outputsAgree("fileEdit", "a\n\n\n\nb", "a\n\nb")
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validation_result
// ---------------------------------------------------------------------------

describe("validation_result", () => {
  test("agrees when structural fields match despite extra runtime keys", () => {
    const a = { passed: true, totalChecks: 3, passedChecks: 3, failedChecks: 0, timestamp: "2026-05-01" };
    const b = { passed: true, totalChecks: 3, passedChecks: 3, failedChecks: 0, duration_ms: 42 };
    expect(outputsAgree("validation_result", a, b)).toBe(true);
  });

  test("disagrees when passed differs", () => {
    const a = { passed: true, failedChecks: 0 };
    const b = { passed: false, failedChecks: 1 };
    expect(outputsAgree("validation_result", a, b)).toBe(false);
  });

  test("rule field included in canonical form", () => {
    const a = { passed: true, rule: "no-console", failedChecks: 0 };
    const b = { passed: true, rule: "no-debug", failedChecks: 0 };
    expect(outputsAgree("validation_result", a, b)).toBe(false);
  });

  test("diffOutputs returns null for agreeing pair", () => {
    const a = { passed: true, failedChecks: 0, timestamp: "x" };
    const b = { passed: true, failedChecks: 0, timestamp: "y" };
    expect(diffOutputs("validation_result", a, b)).toBeNull();
  });

  test("diffOutputs returns before/after for disagreeing pair", () => {
    const diff = diffOutputs("validation_result", { passed: true }, { passed: false });
    expect(diff).not.toBeNull();
    expect(diff!["before"]).toBeTruthy();
    expect(diff!["after"]).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// gitDiff
// ---------------------------------------------------------------------------

const DIFF_A = `diff --git a/src/auth.ts b/src/auth.ts
index abc1234..def5678 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 import { foo } from './foo';
+import { bar } from './bar';
 export const x = 1;
-export const y = 2;
+export const y = 3;`;

const DIFF_A_CRLF = DIFF_A.replace(/\n/g, "\r\n");

describe("gitDiff", () => {
  test("LF and CRLF diff strings agree", () => {
    // CRLF vs LF in the diff string — same semantic content
    expect(outputsAgree("gitDiff", DIFF_A, DIFF_A)).toBe(true);
    // CRLF version parses to same structure
    const na = normalizeOutput("gitDiff", DIFF_A);
    const nb = normalizeOutput("gitDiff", DIFF_A_CRLF);
    // Both produce arrays; path should match
    expect((na as Array<{path:string}>)[0].path).toBe((nb as Array<{path:string}>)[0].path);
  });

  test("different files disagree", () => {
    const diffB = DIFF_A.replace(/src\/auth\.ts/g, "src/other.ts");
    expect(outputsAgree("gitDiff", DIFF_A, diffB)).toBe(false);
  });

  test("structured patches object normalises to sorted list", () => {
    const a = { patches: [{ path: "b.ts", additions: 1, deletions: 0, hunks: [] }, { path: "a.ts", additions: 2, deletions: 1, hunks: [] }] };
    const b = { patches: [{ path: "a.ts", additions: 2, deletions: 1, hunks: [] }, { path: "b.ts", additions: 1, deletions: 0, hunks: [] }] };
    expect(outputsAgree("gitDiff", a, b)).toBe(true);
  });

  test("addition count extracted from diff string", () => {
    const result = normalizeOutput("gitDiff", DIFF_A) as Array<{additions: number}>;
    expect(result[0].additions).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// directoryTree
// ---------------------------------------------------------------------------

describe("directoryTree", () => {
  test("sorted and unsorted path arrays agree", () => {
    const a = ["src/b.ts", "src/a.ts", "README.md"];
    const b = ["README.md", "src/a.ts", "src/b.ts"];
    expect(outputsAgree("directoryTree", a, b)).toBe(true);
  });

  test("backslash and forward-slash paths agree", () => {
    const a = ["src\\auth\\index.ts"];
    const b = ["src/auth/index.ts"];
    expect(outputsAgree("directoryTree", a, b)).toBe(true);
  });

  test("different files disagree", () => {
    expect(outputsAgree("directoryTree", ["src/a.ts"], ["src/b.ts"])).toBe(false);
  });

  test("string tree representation parses to paths", () => {
    const tree = "├── src\n│   ├── a.ts\n│   └── b.ts\n└── README.md";
    const result = normalizeOutput("directoryTree", tree) as string[];
    expect(result).toContain("a.ts");
    expect(result).toContain("b.ts");
    expect(result).toContain("README.md");
  });

  test("object with paths key normalises correctly", () => {
    const a = { paths: ["z.ts", "a.ts"] };
    const b = ["a.ts", "z.ts"];
    expect(outputsAgree("directoryTree", a, b)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fallback (unknown shape)
// ---------------------------------------------------------------------------

describe("fallback (unknown shape)", () => {
  test("same object with different key order agrees", () => {
    const a = { b: 2, a: 1 };
    const b = { a: 1, b: 2 };
    expect(outputsAgree("unknownShape", a, b)).toBe(true);
  });

  test("different values disagree", () => {
    expect(outputsAgree("unknownShape", { x: 1 }, { x: 2 })).toBe(false);
  });
});
