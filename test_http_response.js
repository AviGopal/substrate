"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_response_ts_1 = require("/workspace/git/super-repo/repos/development-vessel/src/resolvers/http-response.ts");
async function runTest() {
    const testPointer = {
        type: 'httpResponse',
        url: 'https://example.com',
    };
    const result = await (0, http_response_ts_1.resolveHttpResponse)(testPointer);
    console.log(JSON.stringify(result, null, 2));
}
runTest();
//# sourceMappingURL=test_http_response.js.map