"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.impulses = impulses;
const http_response_producer_1 = require("../resolvers/http-response-producer");
const orphaned_capability_1 = require("../repos/development-vessel/src/resolvers/orphaned-capability");
async function impulses(impulse) {
    switch (impulse.shape) {
        case 'httpResponse':
            return resolveHttpResponse(impulse);
        case 'orphaned_capability':
            return (0, orphaned_capability_1.resolveOrphanedCapability)(impulse); // existing cases
    }
}
//# sourceMappingURL=impulses.js.map