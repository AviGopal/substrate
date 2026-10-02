let nextId = 1;
const store = new Map();
export function createUser(input) {
    const user = {
        id: String(nextId++),
        ...input,
        createdAt: new Date(),
    };
    store.set(user.id, user);
    return user;
}
export function getUser(id) {
    return store.get(id);
}
export function updateUser(id, input) {
    const existing = store.get(id);
    if (!existing)
        return undefined;
    const updated = { ...existing, ...input };
    store.set(id, updated);
    return updated;
}
export function deleteUser(id) {
    return store.delete(id);
}
export function listUsers() {
    return Array.from(store.values());
}
export function clearStore() {
    store.clear();
    nextId = 1;
}
//# sourceMappingURL=user-store.js.map