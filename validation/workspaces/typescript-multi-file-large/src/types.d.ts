export type UserID = string;
export interface User {
    id: UserID;
    name: string;
    email: string;
    role: "admin" | "member" | "guest";
    createdAt: Date;
}
export interface Session {
    sessionId: string;
    userId: UserID;
    expiresAt: Date;
    scopes: string[];
}
export type CreateUserInput = Omit<User, "id" | "createdAt">;
export type UpdateUserInput = Partial<Omit<User, "id" | "createdAt">>;
//# sourceMappingURL=types.d.ts.map