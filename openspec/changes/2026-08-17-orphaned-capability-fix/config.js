"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeEdit9077062cHttpResponseResolver = exports.resolveOrphanedCapability = exports.resolveHttpResponse = void 0;
const core_1 = require("@substrate/core");
const problem_decomposition_1 = require("./resolvers/problem_decomposition");
const simple_http_response_1 = require("./resolvers/simple-http-response");
const fetch_http_response_1 = require("./resolvers/fetch-http-response");
const http_response_1 = require("./resolvers/http-response");
Object.defineProperty(exports, "resolveHttpResponse", { enumerable: true, get: function () { return http_response_1.resolveHttpResponse; } });
const orphaned_capability_1 = require("./repos/development-vessel/src/resolvers/orphaned-capability");
Object.defineProperty(exports, "resolveOrphanedCapability", { enumerable: true, get: function () { return orphaned_capability_1.resolveOrphanedCapability; } });
const route_edit_9077062c_http_response_resolver_1 = __importDefault(require("./resolvers/route-edit-9077062c-http-response-resolver")); // Import the new resolver
exports.routeEdit9077062cHttpResponseResolver = route_edit_9077062c_http_response_resolver_1.default;
const module_1 = require();
"./resolvers/types\";\nexport type AllShapes = \"httpResponse\" | \"orphaned_capability\";;
//# sourceMappingURL=config.js.map