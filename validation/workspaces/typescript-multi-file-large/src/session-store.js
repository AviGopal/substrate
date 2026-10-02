const sessions = new Map();
export function createSession(userId, scopes, ttlMs = 3600_000) {
    const session = {
        sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        expiresAt: new Date(Date.now() + ttlMs),
        scopes,
    };
    sessions.set(session.sessionId, session);
    return session;
}
export function getSession(sessionId) {
    const session = sessions.get(sessionId);
    if (!session)
        return undefined;
    if (session.expiresAt < new Date()) {
        sessions.delete(sessionId);
        return undefined;
    }
    return session;
}
export function revokeSession(sessionId) {
    return sessions.delete(sessionId);
}
export function revokeAllSessions(userId) {
    let count = 0;
    for (const [id, session] of sessions) {
        if (session.userId === userId) {
            sessions.delete(id);
            count++;
        }
    }
    return count;
}
export function clearSessions() {
    sessions.clear();
}
//# sourceMappingURL=session-store.js.map