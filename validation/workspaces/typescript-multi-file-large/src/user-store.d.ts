import type { User, UserID, CreateUserInput, UpdateUserInput } from "./types";
export declare function createUser(input: CreateUserInput): User;
export declare function getUser(id: UserID): User | undefined;
export declare function updateUser(id: UserID, input: UpdateUserInput): User | undefined;
export declare function deleteUser(id: UserID): boolean;
export declare function listUsers(): User[];
export declare function clearStore(): void;
//# sourceMappingURL=user-store.d.ts.map