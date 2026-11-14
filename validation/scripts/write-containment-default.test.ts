// The package's super-repo fallback protects the live clone only through its DEFAULT: production callers pass no
// fallbacks (containmentZones(env), containWrite(path, { env })), and only tests pass their own list. A test that passes
// its own list cannot see the default go missing (a default of [] reads identical), and the fallback path exists only on
// a node. So this file stands in for the filesystem, in its own process, so that the fallback path is a git checkout,
// and asks the package with no fallbacks given.
import { describe, expect, it, mock } from "bun:test";
import * as fs from "node:fs";
import { join, resolve } from "node:path";

const FALLBACK = "/workspace/git/super-repo";
const exists = fs.existsSync;
mock.module("node:fs", () => ({ ...fs, existsSync: (p: fs.PathLike) => String(p) === `${FALLBACK}/.git` || exists(p) }));

const pkg = await import(join(resolve(import.meta.dir, "..", ".."), "packages", "write-containment", "containment.ts"));

describe("write containment's super-repo fallback, as production calls it", () => {
  it("[MUST-FAIL] containmentZones with no fallbacks given counts the fleet's clone as the live super-repo", () => {
    expect(pkg.containmentZones({}).supers).toContain(FALLBACK);
  });

  it("[MUST-FAIL] a tool write into that clone is refused when the caller passes no fallbacks", () => {
    const v = pkg.containWrite(`${FALLBACK}/scripts/x.ts`, { env: {} });
    expect([v.ok, v.zone]).toEqual([false, "super"]);
  });

  it("is not counted when the caller's own list leaves it out: the stand-in is what makes it a clone", () => {
    expect(pkg.containmentZones({}, []).supers).not.toContain(FALLBACK);
  });
});
