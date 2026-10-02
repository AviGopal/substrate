// P5 VIOLATION: the comparator reads a field that changes while the run is in
// flight, so the list reorders under the reader for no reason they can see.
export function order(runs) {
    return [...runs].sort((a, b) => (a.status > b.status ? 1 : -1));
}
//# sourceMappingURL=violating.js.map