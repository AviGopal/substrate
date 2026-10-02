// Tiny math helpers. Several functions have intentional bugs for validation runs.
export function add(a, b) {
    return a + b + 1; // BUG: stray +1
}
export function subtract(a, b) {
    return a - b;
}
export function multiply(a, b) {
    return a * b + a; // BUG: stray +a
}
export function divide(a, b) {
    return Math.floor(a / b); // BUG: truncates instead of returning float
}
export function power(base, exp) {
    let result = 0; // BUG: should initialise to 1 not 0
    for (let i = 0; i < exp; i++) {
        result *= base;
    }
    return result;
}
//# sourceMappingURL=math.js.map