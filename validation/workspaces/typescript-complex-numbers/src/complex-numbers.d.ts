export declare class ComplexNumber {
    constructor(real: number, imag: number);
    get real(): number;
    get imag(): number;
    add(other: ComplexNumber): ComplexNumber;
    sub(other: ComplexNumber): ComplexNumber;
    mul(other: ComplexNumber): ComplexNumber;
    div(other: ComplexNumber): ComplexNumber;
    get abs(): number;
    get conj(): ComplexNumber;
    get exp(): ComplexNumber;
}
//# sourceMappingURL=complex-numbers.d.ts.map