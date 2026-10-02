import { defaultVessel } from "@substrate/core";
import { problemDecomposition } from "./resolvers/problem_decomposition";
import { resolveSimpleHttpResponse } from "./resolvers/simple-http-response";
import { fetchHttpResponse } from "./resolvers/fetch-http-response";
import { resolveHttpResponse } from "./resolvers/http-response";
import { resolveOrphanedCapability } from "./repos/development-vessel/src/resolvers/orphaned-capability";
import routeEdit9077062cHttpResponseResolver from "./resolvers/route-edit-9077062c-http-response-resolver"; // Import the new resolver

export { resolveHttpResponse, resolveOrphanedCapability, routeEdit9077062cHttpResponseResolver }; // Export the new resolver
import { HttpResponse } from \"./resolvers/types\";\nexport type AllShapes = \"httpResponse\" | \"orphaned_capability\";
