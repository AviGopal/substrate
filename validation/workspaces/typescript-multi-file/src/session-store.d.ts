import type { Session, UserID } from "./types";
export declare function createSession(userId: UserID, scopes: string[], ttlMs?: number): Session;
export declare function getSession(sessionId: string): Session | undefined;
export declare function revokeSession(sessionId: string): boolean;
export declare function revokeAllSessions(userId: UserID): number;
export declare function clearSessions(): void;
//# sourceMappingURL=session-store.d.ts.map