export function order(runs) {
    return [...runs].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
//# sourceMappingURL=clean.js.map