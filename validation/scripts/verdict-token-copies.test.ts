// packages/verdict-token/verdict-token.ts is vendored byte-identical into the vessel that
// STAMPS a failure class (activity-api) and the vessel that FILES one gap per class
// (development-vessel); vessels cannot import packages/ at runtime. A copy that drifts is
// a second token rule: a class one side stamps that the other refuses forever.
//
// THREE PINS. Each vessel carries a pin test (activity-api src/lib/verdict-token.pin.test.ts,
// development-vessel test/lib/verdict-token.pin.test.ts) asserting the sha256 of its own copy
// equals VERDICT_TOKEN_SHA256 below, so drift in one copy fails that vessel's own suite at
// every node's pull-sync test gate. scripts/git-hooks/pre-commit reads VERDICT_TOKEN_SHA256
// from this file as staged and checks the staged package and each copy at its staged
// gitlink against it (object store, no working tree), on any super-repo commit touching the
// package, this test, or either vessel's gitlink. Keep the constant on one line.
import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// Update all three copies and all three pins together.
const VERDICT_TOKEN_SHA256 = "abef6e3868676b61da93678728080c2cfde94f9c9d5cd29d981f1702f3b9a8ef"; // gitleaks:allow (a sha256 content pin, not a secret)

const SUPER = resolve(import.meta.dir, "..", "..");
const CANON = join(SUPER, "packages", "verdict-token", "verdict-token.ts");
const COPIES = [
  join(SUPER, "repos", "activity-api", "src", "lib", "verdict-token.ts"),
  join(SUPER, "repos", "development-vessel", "src", "lib", "verdict-token.ts"),
];
const sha256 = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

describe("verdict-token copies", () => {
  it("packages/verdict-token/verdict-token.ts matches the pinned sha256", () => {
    expect(
      sha256(CANON),
      "verdict-token drift: update all three copies and all three pins together",
    ).toBe(VERDICT_TOKEN_SHA256);
  });
  for (const copy of COPIES) {
    it(`${copy.slice(SUPER.length + 1)} is byte-identical to the package`, () => {
      // A submodule that is not checked out is reported, not skipped silently.
      expect(`${copy}: ${existsSync(copy) ? "present" : "MISSING (submodule not checked out?)"}`).toBe(`${copy}: present`);
      expect(
        readFileSync(copy, "utf8"),
        "verdict-token drift: update all three copies and all three pins together",
      ).toBe(readFileSync(CANON, "utf8"));
    });
  }
});
