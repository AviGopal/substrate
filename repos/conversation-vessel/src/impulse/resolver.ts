import { ImpulseRef, ResolvedImpulse } from '../types/impulse.js';

/**
 * Resolves an impulse reference to its actual data
 * Uses Bun APIs for file system operations
 * @param impulse The impulse reference to resolve
 * @returns Promise resolving to the impulse data
 */
export async function resolveImpulse(impulse: ImpulseRef): Promise<ResolvedImpulse> {
  let data: string;
  let metadata = impulse.metadata;

  switch (impulse.type) {
    case 'memo':
      // For memo type, content is the actual memo data
      data = impulse.content;
      break;

    case 'file':
      // For file type, content is the file path - use Bun.file()
      try {
        const file = Bun.file(impulse.content);
        if (!await file.exists()) {
          throw new Error(`File not found: ${impulse.content}`);
        }
        data = await file.text();
        // Add basic file metadata if not provided
        if (!metadata) {
          const lines = data.split('\n').length;
          metadata = {
            shape: 'text',
            rowCount: lines,
            summary: `File with ${lines} lines`
          };
        }
      } catch (error) {
        throw new Error(`Failed to read file ${impulse.content}: ${error instanceof Error ? error.message : String(error)}`);
      }
      break;

    case 'activityOutput':
    case 'custom':
      // For other types, content is used as-is for now
      // These can be extended later for specific resolution logic
      data = impulse.content;
      break;

    default:
      throw new Error(`Unsupported impulse type: ${impulse.type}`);
  }

  return {
    id: impulse.id,
    type: impulse.type,
    data,
    metadata
  };
}