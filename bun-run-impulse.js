"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const impulseJson = process.argv[2];
if (impulseJson) {
    try {
        const impulse = JSON.parse(impulseJson);
        console.log(JSON.stringify(impulse));
    }
    catch (error) {
        console.error(`Error parsing impulse JSON: ${error.message}`);
        process.exit(1);
    }
}
else {
    console.error("No impulse JSON provided as argument.");
    process.exit(1);
}
//# sourceMappingURL=bun-run-impulse.js.map