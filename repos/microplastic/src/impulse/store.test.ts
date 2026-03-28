/**
 * ImpulseStore Tests
 *
 * Tests for subscription predicates and query functionality.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { ImpulseStore } from "./store.ts";
import type { ExtendedImpulse, ImpulseShape } from "./types.ts";

describe("ImpulseStore", () => {
  let store: ImpulseStore;

  beforeEach(() => {
    store = new ImpulseStore();
  });

  describe("create", () => {
    test("creates impulse with shape", () => {
      const impulse = store.create({
        id: "test-1",
        pointer: { type: "file", path: "test.ts" },
        budget: 1000,
        priority: "high",
        shape: "source_code",
      });

      expect(impulse.id).toBe("test-1");
      expect(impulse.shape).toBe("source_code");
      expect(impulse.loaded).toBe(false);
    });

    test("auto-generates id if not provided", () => {
      const impulse = store.create({
        pointer: { type: "memo", content: "test" },
        budget: 100,
        priority: "low",
      });

      expect(impulse.id).toMatch(/^impulse-\d+-\d+$/);
    });
  });

  describe("subscribe with predicates", () => {
    test("receives all events without predicate", () => {
      const events: string[] = [];
      store.subscribe((event) => {
        events.push(`${event.type}:${event.impulse.id}`);
      });

      store.create({ id: "a", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low" });
      store.create({ id: "b", pointer: { type: "memo", content: "b" }, budget: 100, priority: "high", shape: "error" });

      expect(events).toEqual(["create:a", "create:b"]);
    });

    test("filters by pointer type", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { type: "file" }
      );

      store.create({ id: "file1", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low" });
      store.create({ id: "memo1", pointer: { type: "memo", content: "b" }, budget: 100, priority: "low" });
      store.create({ id: "file2", pointer: { type: "file", path: "c.ts" }, budget: 100, priority: "low" });

      expect(events).toEqual(["file1", "file2"]);
    });

    test("filters by shape", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { shape: "error" }
      );

      store.create({ id: "code1", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low", shape: "source_code" });
      store.create({ id: "err1", pointer: { type: "memo", content: "fail" }, budget: 100, priority: "high", shape: "error" });
      store.create({ id: "err2", pointer: { type: "file", path: "err.log" }, budget: 100, priority: "low", shape: "error" });

      expect(events).toEqual(["err1", "err2"]);
    });

    test("filters by multiple shapes", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { shape: ["error", "trace"] }
      );

      store.create({ id: "code1", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low", shape: "source_code" });
      store.create({ id: "err1", pointer: { type: "memo", content: "fail" }, budget: 100, priority: "high", shape: "error" });
      store.create({ id: "trace1", pointer: { type: "file", path: "trace.json" }, budget: 100, priority: "low", shape: "trace" });

      expect(events).toEqual(["err1", "trace1"]);
    });

    test("filters by minPriority", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { minPriority: 750 }  // high and critical only
      );

      store.create({ id: "low", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low" });
      store.create({ id: "med", pointer: { type: "file", path: "b.ts" }, budget: 100, priority: "medium" });
      store.create({ id: "high", pointer: { type: "file", path: "c.ts" }, budget: 100, priority: "high" });
      store.create({ id: "crit", pointer: { type: "file", path: "d.ts" }, budget: 100, priority: "critical" });

      expect(events).toEqual(["high", "crit"]);
    });

    test("filters by custom predicate", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { custom: (impulse) => impulse.budget > 500 }
      );

      store.create({ id: "small", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low" });
      store.create({ id: "large", pointer: { type: "file", path: "b.ts" }, budget: 1000, priority: "low" });

      expect(events).toEqual(["large"]);
    });

    test("combines type and shape filters (AND)", () => {
      const events: string[] = [];
      store.subscribe(
        (event) => events.push(event.impulse.id),
        { type: "file", shape: "source_code" }
      );

      store.create({ id: "file-code", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low", shape: "source_code" });
      store.create({ id: "file-error", pointer: { type: "file", path: "err.log" }, budget: 100, priority: "low", shape: "error" });
      store.create({ id: "memo-code", pointer: { type: "memo", content: "code" }, budget: 100, priority: "low", shape: "source_code" });

      expect(events).toEqual(["file-code"]);
    });

    test("unsubscribe stops events", () => {
      const events: string[] = [];
      const unsub = store.subscribe((event) => events.push(event.impulse.id));

      store.create({ id: "before", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low" });
      unsub();
      store.create({ id: "after", pointer: { type: "file", path: "b.ts" }, budget: 100, priority: "low" });

      expect(events).toEqual(["before"]);
    });
  });

  describe("query", () => {
    beforeEach(() => {
      store.create({ id: "file1", pointer: { type: "file", path: "a.ts" }, budget: 100, priority: "low", shape: "source_code" });
      store.create({ id: "file2", pointer: { type: "file", path: "b.ts" }, budget: 100, priority: "high", shape: "source_code" });
      store.create({ id: "memo1", pointer: { type: "memo", content: "error" }, budget: 100, priority: "high", shape: "error" });
      store.create({ id: "trace1", pointer: { type: "file", path: "trace.json" }, budget: 500, priority: "medium", shape: "trace" });
    });

    test("queries by type", () => {
      const results = store.query({ type: "file" });
      expect(results.map((r) => r.id).sort()).toEqual(["file1", "file2", "trace1"]);
    });

    test("queries by shape", () => {
      const results = store.query({ shape: "source_code" });
      expect(results.map((r) => r.id).sort()).toEqual(["file1", "file2"]);
    });

    test("queries by minPriority", () => {
      const results = store.query({ minPriority: 750 });
      expect(results.map((r) => r.id).sort()).toEqual(["file2", "memo1"]);
    });

    test("queries with combined filters", () => {
      const results = store.query({ type: "file", shape: "source_code", minPriority: 750 });
      expect(results.map((r) => r.id)).toEqual(["file2"]);
    });

    test("queries with custom predicate", () => {
      const results = store.query({ custom: (i) => i.budget >= 500 });
      expect(results.map((r) => r.id)).toEqual(["trace1"]);
    });

    test("returns empty array when no matches", () => {
      const results = store.query({ shape: "nonexistent" });
      expect(results).toEqual([]);
    });
  });
});
