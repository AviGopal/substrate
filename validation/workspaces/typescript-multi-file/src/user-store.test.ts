import { describe, it, expect, beforeEach } from "bun:test";
import { createUser, getUser, updateUser, deleteUser, listUsers, clearStore } from "./user-store";

beforeEach(() => clearStore());

describe("createUser", () => {
  it("creates a user with auto-assigned id", () => {
    const user = createUser({ name: "Alice", email: "alice@example.com", role: "member" });
    expect(user.id).toBeDefined();
    expect(user.name).toBe("Alice");
    expect(user.createdAt).toBeInstanceOf(Date);
  });
});

describe("getUser", () => {
  it("returns undefined for missing user", () => {
    expect(getUser("nonexistent")).toBeUndefined();
  });

  it("returns user after creation", () => {
    const user = createUser({ name: "Bob", email: "bob@example.com", role: "admin" });
    expect(getUser(user.id)).toEqual(user);
  });
});

describe("updateUser", () => {
  it("updates fields", () => {
    const user = createUser({ name: "Charlie", email: "c@example.com", role: "guest" });
    const updated = updateUser(user.id, { role: "member" });
    expect(updated?.role).toBe("member");
    expect(updated?.name).toBe("Charlie");
  });

  it("returns undefined for missing user", () => {
    expect(updateUser("nonexistent", { name: "X" })).toBeUndefined();
  });
});

describe("deleteUser", () => {
  it("returns true for existing user", () => {
    const user = createUser({ name: "Dave", email: "d@example.com", role: "guest" });
    expect(deleteUser(user.id)).toBe(true);
    expect(getUser(user.id)).toBeUndefined();
  });

  it("returns false for missing user", () => {
    expect(deleteUser("nonexistent")).toBe(false);
  });
});

describe("listUsers", () => {
  it("returns all users", () => {
    createUser({ name: "Eve", email: "e@example.com", role: "member" });
    createUser({ name: "Frank", email: "f@example.com", role: "admin" });
    expect(listUsers()).toHaveLength(2);
  });
});
