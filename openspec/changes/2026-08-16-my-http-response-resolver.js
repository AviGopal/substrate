"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const resolver_1 = require("@quilt/resolver");
exports.default = (0, resolver_1.createResolver)({
    name: 'myHttpResponseResolver',
    produces: ['httpResponse'],
    async resolve() {
        return {
            httpResponse: {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'This is my new httpResponse resolver!' }),
            },
        };
    },
});
//# sourceMappingURL=2026-08-16-my-http-response-resolver.js.map