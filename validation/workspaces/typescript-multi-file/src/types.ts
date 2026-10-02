// Core domain types for a simple user-management library.
// NOTE: The type `UserId` was recently renamed from `UserID` in the spec,
// but not all files have been updated yet.

export type UserID = string; // TODO: rename to UserId everywhere

export interface User {
  id: UserID;
  name: string;
  email: string;
  role: "admin" | "member" | "guest";
  createdAt: Date;
}

export interface Session {
  sessionId: string;
  userId: UserID; // TODO: rename to userId: UserId
  expiresAt: Date;
  scopes: string[];
}

export type CreateUserInput = Omit<User, "id" | "createdAt">;
export type UpdateUserInput = Partial<Omit<User, "id" | "createdAt">>;
