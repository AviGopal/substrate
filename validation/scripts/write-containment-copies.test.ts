// packages/write-containment/containment.ts is vendored byte-identical into the two
// vessels that serve file-writing shapes (vessels cannot import packages/ at
// runtime). A copy that drifts is a second rule, and a shape routes to either
// producer — so drift is a containment hole, not a style issue.
import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const SUPER = resolve(import.meta.dir, "..", "..");
const CANON = join(SUPER, "packages", "write-containment", "containment.ts");
const COPIES = [
  join(SUPER, "repos", "local-tools-vessel", "src", "write-containment.ts"),
  join(SUPER, "repos", "development-vessel", "src", "resolvers", "write-containment.ts"),
];

describe("write-containment copies", () => {
  for (const copy of COPIES) {
    it(`${copy.slice(SUPER.length + 1)} is byte-identical to the package`, () => {
      // A submodule that is not checked out is reported, not skipped silently.
      expect(`${copy}: ${existsSync(copy) ? "present" : "MISSING (submodule not checked out?)"}`).toBe(`${copy}: present`);
      expect(readFileSync(copy, "utf8")).toBe(readFileSync(CANON, "utf8"));
    });
  }
});
