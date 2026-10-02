import type { User, UserID, CreateUserInput, UpdateUserInput } from "./types";

let nextId = 1;

const store = new Map<UserID, User>();

export function createUser(input: CreateUserInput): User {
  const user: User = {
    id: String(nextId++),
    ...input,
    createdAt: new Date(),
  };
  store.set(user.id, user);
  return user;
}

export function getUser(id: UserID): User | undefined {
  return store.get(id);
}

export function updateUser(id: UserID, input: UpdateUserInput): User | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...input };
  store.set(id, updated);
  return updated;
}

export function deleteUser(id: UserID): boolean {
  return store.delete(id);
}

export function listUsers(): User[] {
  return Array.from(store.values());
}

export function clearStore(): void {
  store.clear();
  nextId = 1;
}
