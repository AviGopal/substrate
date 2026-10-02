import type { Session, UserID } from "./types";

const sessions = new Map<string, Session>();

export function createSession(userId: UserID, scopes: string[], ttlMs = 3600_000): Session {
  const session: Session = {
    sessionId: `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    expiresAt: new Date(Date.now() + ttlMs),
    scopes,
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function getSession(sessionId: string): Session | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return undefined;
  }
  return session;
}

export function revokeSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function revokeAllSessions(userId: UserID): number {
  let count = 0;
  for (const [id, session] of sessions) {
    if (session.userId === userId) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

export function clearSessions(): void {
  sessions.clear();
}
