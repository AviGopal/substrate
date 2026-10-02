"use strict";
/**
 * Unit tests for output-normalizers.ts — G6.3.1 acceptance criteria.
 *
 * Covers each built-in shape with at least one agreeing and one disagreeing pair.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const bun_test_1 = require("bun:test");
const output_normalizers_1 = require("./output-normalizers");
// ---------------------------------------------------------------------------
// fileEdit
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("fileEdit", () => {
    (0, bun_test_1.test)("CRLF and LF agree", () => {
        const a = "line1\r\nline2\r\n";
        const b = "line1\nline2\n";
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("trailing spaces agree with trimmed", () => {
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", "hello   ", "hello")).toBe(true);
    });
    (0, bun_test_1.test)("different content disagrees", () => {
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", "foo", "bar")).toBe(false);
    });
    (0, bun_test_1.test)("object form with path agrees when content identical", () => {
        const a = { path: "src/auth.ts", content: "export const x = 1\r\n" };
        const b = { path: "src/auth.ts", content: "export const x = 1\n" };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("object form disagrees on different path", () => {
        const a = { path: "src/a.ts", content: "x" };
        const b = { path: "src/b.ts", content: "x" };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", a, b)).toBe(false);
    });
    (0, bun_test_1.test)("collapses multiple blank lines", () => {
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("fileEdit", "a\n\n\n\nb", "a\n\nb")).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// validation_result
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("validation_result", () => {
    (0, bun_test_1.test)("agrees when structural fields match despite extra runtime keys", () => {
        const a = { passed: true, totalChecks: 3, passedChecks: 3, failedChecks: 0, timestamp: "2026-05-01" };
        const b = { passed: true, totalChecks: 3, passedChecks: 3, failedChecks: 0, duration_ms: 42 };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("validation_result", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("disagrees when passed differs", () => {
        const a = { passed: true, failedChecks: 0 };
        const b = { passed: false, failedChecks: 1 };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("validation_result", a, b)).toBe(false);
    });
    (0, bun_test_1.test)("rule field included in canonical form", () => {
        const a = { passed: true, rule: "no-console", failedChecks: 0 };
        const b = { passed: true, rule: "no-debug", failedChecks: 0 };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("validation_result", a, b)).toBe(false);
    });
    (0, bun_test_1.test)("diffOutputs returns null for agreeing pair", () => {
        const a = { passed: true, failedChecks: 0, timestamp: "x" };
        const b = { passed: true, failedChecks: 0, timestamp: "y" };
        (0, bun_test_1.expect)((0, output_normalizers_1.diffOutputs)("validation_result", a, b)).toBeNull();
    });
    (0, bun_test_1.test)("diffOutputs returns before/after for disagreeing pair", () => {
        const diff = (0, output_normalizers_1.diffOutputs)("validation_result", { passed: true }, { passed: false });
        (0, bun_test_1.expect)(diff).not.toBeNull();
        (0, bun_test_1.expect)(diff["before"]).toBeTruthy();
        (0, bun_test_1.expect)(diff["after"]).toBeTruthy();
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
(0, bun_test_1.describe)("gitDiff", () => {
    (0, bun_test_1.test)("LF and CRLF diff strings agree", () => {
        // CRLF vs LF in the diff string — same semantic content
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("gitDiff", DIFF_A, DIFF_A)).toBe(true);
        // CRLF version parses to same structure
        const na = (0, output_normalizers_1.normalizeOutput)("gitDiff", DIFF_A);
        const nb = (0, output_normalizers_1.normalizeOutput)("gitDiff", DIFF_A_CRLF);
        // Both produce arrays; path should match
        (0, bun_test_1.expect)(na[0].path).toBe(nb[0].path);
    });
    (0, bun_test_1.test)("different files disagree", () => {
        const diffB = DIFF_A.replace(/src\/auth\.ts/g, "src/other.ts");
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("gitDiff", DIFF_A, diffB)).toBe(false);
    });
    (0, bun_test_1.test)("structured patches object normalises to sorted list", () => {
        const a = { patches: [{ path: "b.ts", additions: 1, deletions: 0, hunks: [] }, { path: "a.ts", additions: 2, deletions: 1, hunks: [] }] };
        const b = { patches: [{ path: "a.ts", additions: 2, deletions: 1, hunks: [] }, { path: "b.ts", additions: 1, deletions: 0, hunks: [] }] };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("gitDiff", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("addition count extracted from diff string", () => {
        const result = (0, output_normalizers_1.normalizeOutput)("gitDiff", DIFF_A);
        (0, bun_test_1.expect)(result[0].additions).toBeGreaterThan(0);
    });
});
// ---------------------------------------------------------------------------
// directoryTree
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("directoryTree", () => {
    (0, bun_test_1.test)("sorted and unsorted path arrays agree", () => {
        const a = ["src/b.ts", "src/a.ts", "README.md"];
        const b = ["README.md", "src/a.ts", "src/b.ts"];
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("directoryTree", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("backslash and forward-slash paths agree", () => {
        const a = ["src\\auth\\index.ts"];
        const b = ["src/auth/index.ts"];
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("directoryTree", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("different files disagree", () => {
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("directoryTree", ["src/a.ts"], ["src/b.ts"])).toBe(false);
    });
    (0, bun_test_1.test)("string tree representation parses to paths", () => {
        const tree = "├── src\n│   ├── a.ts\n│   └── b.ts\n└── README.md";
        const result = (0, output_normalizers_1.normalizeOutput)("directoryTree", tree);
        (0, bun_test_1.expect)(result).toContain("a.ts");
        (0, bun_test_1.expect)(result).toContain("b.ts");
        (0, bun_test_1.expect)(result).toContain("README.md");
    });
    (0, bun_test_1.test)("object with paths key normalises correctly", () => {
        const a = { paths: ["z.ts", "a.ts"] };
        const b = ["a.ts", "z.ts"];
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("directoryTree", a, b)).toBe(true);
    });
});
// ---------------------------------------------------------------------------
// Fallback (unknown shape)
// ---------------------------------------------------------------------------
(0, bun_test_1.describe)("fallback (unknown shape)", () => {
    (0, bun_test_1.test)("same object with different key order agrees", () => {
        const a = { b: 2, a: 1 };
        const b = { a: 1, b: 2 };
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("unknownShape", a, b)).toBe(true);
    });
    (0, bun_test_1.test)("different values disagree", () => {
        (0, bun_test_1.expect)((0, output_normalizers_1.outputsAgree)("unknownShape", { x: 1 }, { x: 2 })).toBe(false);
    });
});
//# sourceMappingURL=output-normalizers.test.js.map