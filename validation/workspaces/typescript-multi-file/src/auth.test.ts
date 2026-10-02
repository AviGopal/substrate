import { describe, it, expect, beforeEach } from "bun:test";
import { createUser, clearStore } from "./user-store";
import { clearSessions } from "./session-store";
import { login, logout, validateSession } from "./auth";

beforeEach(() => { clearStore(); clearSessions(); });

describe("login", () => {
  it("returns success with valid user", () => {
    const user = createUser({ name: "Alice", email: "alice@example.com", role: "member" });
    const result = login(user.id, "any-password");
    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
  });

  it("fails when user does not exist", () => {
    const result = login("nonexistent-user", "any-password");
    // This test currently fails because auth.ts has a bug: it creates a session
    // even for non-existent users. Fix auth.ts so this returns { success: false }.
    expect(result.success).toBe(false);
    expect(result.error).toContain("not found");
    expect(result.session).toBeUndefined();
  });
});

describe("validateSession", () => {
  it("returns null for unknown session", () => {
    expect(validateSession("nonexistent")).toBeNull();
  });

  it("returns session after login", () => {
    const user = createUser({ name: "Bob", email: "bob@example.com", role: "admin" });
    const result = login(user.id, "pw");
    expect(validateSession(result.session!.sessionId)).not.toBeNull();
  });
});
