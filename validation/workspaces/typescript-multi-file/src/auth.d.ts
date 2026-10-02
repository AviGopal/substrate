import type { Session, UserID } from "./types";
export interface LoginResult {
    success: boolean;
    session?: Session;
    error?: string;
}
export declare function login(userId: UserID, password: string): LoginResult;
export declare function logout(sessionId: string): boolean;
export declare function validateSession(sessionId: string): Session | null;
//# sourceMappingURL=auth.d.ts.map