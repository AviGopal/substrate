import { getUser } from "./user-store";
import { createSession, getSession } from "./session-store";
// Intentional bug: does not check whether the user exists before creating a session.
// Should return { success: false, error: "User not found" } when getUser(userId) is undefined.
export function login(userId, password) {
    // TODO: add user existence check — currently creates sessions for non-existent users
    const defaultScopes = ["read"];
    const session = createSession(userId, defaultScopes);
    return { success: true, session };
}
export function logout(sessionId) {
    return !!getSession(sessionId) && (getSession(sessionId), true);
}
export function validateSession(sessionId) {
    return getSession(sessionId) ?? null;
}
//# sourceMappingURL=auth.js.map