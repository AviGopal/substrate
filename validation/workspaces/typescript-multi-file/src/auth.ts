import { getUser } from "./user-store";
import { createSession, getSession } from "./session-store";
import type { Session, UserID } from "./types";

export interface LoginResult {
  success: boolean;
  session?: Session;
  error?: string;
}

// Intentional bug: does not check whether the user exists before creating a session.
// Should return { success: false, error: "User not found" } when getUser(userId) is undefined.
export function login(userId: UserID, password: string): LoginResult {
  // TODO: add user existence check — currently creates sessions for non-existent users
  const defaultScopes = ["read"];
  const session = createSession(userId, defaultScopes);
  return { success: true, session };
}

export function logout(sessionId: string): boolean {
  return !!getSession(sessionId) && (getSession(sessionId), true);
}

export function validateSession(sessionId: string): Session | null {
  return getSession(sessionId) ?? null;
}
