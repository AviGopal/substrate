// seed-identity-fleet-key.test.ts: seed-identity's writeFleetKey, the one writer both of its key-minting paths use
// (openspec retire-metabob-names, phase 1). Run against temp files: the rendered env gets the retiring name AND its
// alias with the new key, the persisted store keeps ONE copy under the retiring name, and a re-mint leaves no trace
// of the old key under either name.
import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFleetKey } from "../../scripts/substrate/seed-identity.ts";

const dir = mkdtempSync(join(tmpdir(), "fleet-key-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
const files = (rendered: string, store: string) => {
  const p = { rendered: join(dir, `env.${Math.random()}`), store: join(dir, `store.${Math.random()}`) };
  writeFileSync(p.rendered, rendered); writeFileSync(p.store, store);
  return p;
};
const lines = (f: string, name: string) => readFileSync(f, "utf-8").split("\n").filter((l) => l.startsWith(`${name}=`));

describe("writeFleetKey", () => {
  test("rendered env: BOTH names carry the new key; other lines untouched", () => {
    const p = files("JWT_SECRET=j\nMETABOB_API_KEY=old\nSUBSTRATE_API_KEY=old\nOTHER=x\n", "METABOB_API_KEY=old\n");
    expect(writeFleetKey("mb-new", p)).toBe(true);
    expect(lines(p.rendered, "METABOB_API_KEY")).toEqual(["METABOB_API_KEY=mb-new"]);
    expect(lines(p.rendered, "SUBSTRATE_API_KEY")).toEqual(["SUBSTRATE_API_KEY=mb-new"]);
    expect(lines(p.rendered, "JWT_SECRET")).toEqual(["JWT_SECRET=j"]);
    expect(lines(p.rendered, "OTHER")).toEqual(["OTHER=x"]);
  });
  test("persisted store: ONE copy, under the retiring name", () => {
    const p = files("METABOB_API_KEY=old\n", "JWT_SECRET=j\nMETABOB_API_KEY=old\n");
    writeFleetKey("mb-new", p);
    expect(lines(p.store, "METABOB_API_KEY")).toEqual(["METABOB_API_KEY=mb-new"]);
    expect(lines(p.store, "SUBSTRATE_API_KEY")).toEqual([]);
  });
  test("re-mint over a render that holds the alias on the OLD key: no trace of the old key remains", () => {
    const p = files("METABOB_API_KEY=mb-old\nSUBSTRATE_API_KEY=mb-old\n", "METABOB_API_KEY=mb-old\n");
    writeFleetKey("mb-reminted", p);
    expect(readFileSync(p.rendered, "utf-8")).not.toContain("mb-old");
    expect(readFileSync(p.store, "utf-8")).not.toContain("mb-old");
  });
  test("a pre-phase-1 render without the alias gets it appended", () => {
    const p = files("METABOB_API_KEY=old\n", "METABOB_API_KEY=old\n");
    expect(writeFleetKey("mb-new", p)).toBe(true);
    expect(lines(p.rendered, "SUBSTRATE_API_KEY")).toEqual(["SUBSTRATE_API_KEY=mb-new"]);
  });
  test("a key containing replacement patterns ($&, $1, $$) is written literally", () => {
    const p = files("METABOB_API_KEY=old\nSUBSTRATE_API_KEY=old\n", "METABOB_API_KEY=old\n");
    writeFleetKey("mb-a$&b$1c$$d", p);
    expect(lines(p.rendered, "METABOB_API_KEY")).toEqual(["METABOB_API_KEY=mb-a$&b$1c$$d"]);
    expect(lines(p.rendered, "SUBSTRATE_API_KEY")).toEqual(["SUBSTRATE_API_KEY=mb-a$&b$1c$$d"]);
  });
  test("an unwritable rendered env reports failure (the seeder then warns 'persisted nowhere')", () => {
    expect(writeFleetKey("mb-new", { rendered: join(dir, "absent", "env"), store: join(dir, "absent", "store") })).toBe(false);
  });
});
