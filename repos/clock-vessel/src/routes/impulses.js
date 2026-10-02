export async function resolveDispatch(pointer) {
    switch (pointer.type) {
        // TODO: Add case arms for each advertised shape
        // Advertised shapes from config: ["currentTimeReport"]
        default:
            return {
                shape: "error",
                body: { message: `unknown shape: ${pointer.type}` },
            };
    }
}
//# sourceMappingURL=impulses.js.map