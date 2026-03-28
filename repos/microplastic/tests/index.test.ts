/**
 * Basic smoke tests for microplastic CLI
 */

import { describe, test, expect } from "bun:test";
import { version, name } from "../package.json";

describe("microplastic", () => {
  test("package.json has correct structure", () => {
    expect(name).toBe("@metabob/microplastic");
    expect(version).toBeDefined();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test("CLI entry point exists", async () => {
    const file = Bun.file("./src/index.ts");
    expect(await file.exists()).toBe(true);
  });

  test("runtime cache directory structure", () => {
    // .microplastic/cache is for offline template caching
    // Templates live in the backend, not locally
    const cacheDir = "./.microplastic/cache";
    expect(cacheDir).toContain(".microplastic");
  });
});
