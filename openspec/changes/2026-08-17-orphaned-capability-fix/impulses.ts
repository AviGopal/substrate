import { httpResponseProducerResolver } from '../resolvers/http-response-producer';
import { resolveOrphanedCapability } from "../repos/development-vessel/src/resolvers/orphaned-capability";

export async function impulses(impulse: { shape: string; [key: string]: any }) {
	  switch (impulse.shape) {
	      case 'httpResponse':
	          return resolveHttpResponse(impulse as HttpResponsePointer);
      case 'orphaned_capability':
          return resolveOrphanedCapability(impulse as OrphanedCapabilityPointer);
	        ... // existing cases
	    }
}
