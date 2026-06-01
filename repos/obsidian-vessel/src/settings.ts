/**
 * Plugin Settings for Metabob Vessel
 *
 * Settings interface and defaults for the Obsidian vessel plugin.
 * These control connection, sync behavior, note formatting, and canvas generation.
 */

export interface MetabobVesselSettings {
  // ==========================================================================
  // Connection Settings
  // ==========================================================================

  /** URL of the activity API endpoint */
  activityApiUrl: string;

  /** API key for authentication */
  apiKey: string;

  /** Organization ID for multi-tenant isolation */
  orgId: string;

  // ==========================================================================
  // Sync Preferences
  // ==========================================================================

  /** Folder for execution trace notes */
  executionNotesFolder: string;

  /** Folder for activity template notes */
  activityTemplatesFolder: string;

  /** Folder for generated canvases */
  canvasFolder: string;

  /** Whether to sync on plugin load */
  syncOnStart: boolean;

  /** Maximum number of historical executions to sync */
  historicalSyncLimit: number;

  /** Interval between automatic syncs (in minutes) */
  syncIntervalMinutes: number;

  /** Batch size for sync operations */
  syncBatchSize: number;

  /** Preserve user-added content when updating notes */
  preserveUserContent: boolean;

  // ==========================================================================
  // Vessel Registration Settings
  // ==========================================================================

  /** Unique identifier for this vessel instance */
  vesselId: string;

  /** Human-readable name for this vessel */
  vesselName: string;

  /** Heartbeat interval in milliseconds */
  heartbeatInterval: number;

  /** Registration TTL in seconds (how long the registration is valid) */
  registrationTtl: number;

  /** Impulse shapes this vessel can resolve */
  shapes: string[];

  // ==========================================================================
  // HTTP Server Settings
  // ==========================================================================

  /** Whether the HTTP server is enabled for impulse resolution */
  serverEnabled: boolean;

  /** Port for the HTTP server */
  serverPort: number;

  /** Allowed CORS origins (supports wildcards) */
  allowedOrigins: string[];

  // ==========================================================================
  // Note Formatting Settings
  // ==========================================================================

  /** Note template style */
  noteTemplate: 'detailed' | 'compact' | 'custom';

  /** Custom template string (used when noteTemplate is 'custom') */
  customTemplate: string;

  /** Include tool call details in execution notes */
  includeToolCalls: boolean;

  /** Include file diffs in execution notes */
  includeDiffs: boolean;

  /** Show tool calls in formatted notes (alias for includeToolCalls) */
  showToolCalls: boolean;

  /** Show cost estimates in formatted notes */
  showCostEstimates: boolean;

  /** Show token usage in formatted notes */
  showTokenUsage: boolean;

  // ==========================================================================
  // Canvas Settings
  // ==========================================================================

  /** Automatically update canvases when new executions arrive */
  canvasAutoUpdate: boolean;

  /** Layout algorithm for activity canvases */
  canvasLayout: 'hierarchical' | 'force-directed' | 'timeline' | 'radial';

  /** Maximum nodes per canvas */
  maxNodesPerCanvas: number;

  // ==========================================================================
  // WebSocket Settings
  // ==========================================================================

  /** WebSocket URL for real-time updates */
  websocketUrl: string;

  /** Enable automatic sync */
  autoSync: boolean;

  /** Sync interval in milliseconds (alias for syncIntervalMinutes * 60000) */
  syncInterval: number;

  // ==========================================================================
  // Concept-DB Frontend Settings
  // ==========================================================================

  /** Enable mirroring concept-db into the vault (opt-in). */
  enableConceptDbSync: boolean;

  /** Concept-db HTTP endpoint (default: local substrate host port). */
  conceptDbEndpoint: string;

  /** API key for concept-db; falls back to `apiKey` if empty. */
  conceptDbApiKey: string;

  /** Vault sub-folder where concept notes live. */
  conceptDbSyncRoot: string;

  /** Pull interval in seconds. */
  conceptDbSyncIntervalSec: number;

  /** Enable vault → concept-db writeback (opt-in, requires sync also on). */
  enableConceptDbWriteback: boolean;

  /**
   * If non-empty, restrict sync to these source_type values. Empty array
   * means "all source_types EXCEPT impulse_signature" (which would
   * dominate the vault).
   */
  conceptDbSyncSourceTypes: string[];
}

/**
 * Generate a unique vessel ID for registration.
 */
export function generateVesselId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `obsidian-vessel-${timestamp}-${random}`;
}

/**
 * Default settings for the Metabob Vessel plugin.
 */
export const DEFAULT_SETTINGS: MetabobVesselSettings = {
  // Connection
  activityApiUrl: 'http://activity.metabob.local',
  apiKey: '',
  orgId: '',

  // Vessel registration
  vesselId: '',  // Will be generated on first load if empty
  vesselName: 'Obsidian Vessel',
  heartbeatInterval: 30000,  // 30 seconds
  registrationTtl: 300,      // 5 minutes
  shapes: ['obsidian:note', 'obsidian:search', 'obsidian:canvas', 'obsidian:backlinks', 'obsidian:frontmatter', 'obsidian:daily_note', 'obsidian:graph_query', 'obsidian:concept_view', 'obsidian:concept_writeback', 'obsidian:event_observed', 'obsidian:interaction_episode', 'obsidian:action_effect_model'],

  // Sync preferences
  executionNotesFolder: 'Metabob/Executions',
  activityTemplatesFolder: 'Metabob/Templates',
  canvasFolder: 'Metabob/Canvases',
  syncOnStart: true,
  historicalSyncLimit: 100,
  syncIntervalMinutes: 5,
  syncBatchSize: 50,
  preserveUserContent: true,

  // HTTP Server
  serverEnabled: true,
  serverPort: 27182,
  allowedOrigins: ['http://localhost:*', 'http://127.0.0.1:*'],

  // Note formatting
  noteTemplate: 'detailed',
  customTemplate: '',
  includeToolCalls: true,
  includeDiffs: true,
  showToolCalls: true,
  showCostEstimates: true,
  showTokenUsage: true,

  // Canvas
  canvasAutoUpdate: true,
  canvasLayout: 'hierarchical',
  maxNodesPerCanvas: 100,

  // WebSocket
  websocketUrl: '',  // Will be derived from activityApiUrl if empty
  autoSync: true,
  syncInterval: 300000,  // 5 minutes in ms

  // Concept-DB Frontend
  enableConceptDbSync: false,
  conceptDbEndpoint: 'http://127.0.0.1:18260',
  conceptDbApiKey: '',
  conceptDbSyncRoot: 'concept-db',
  conceptDbSyncIntervalSec: 300,
  enableConceptDbWriteback: false,
  conceptDbSyncSourceTypes: [],
};

/**
 * Validate settings and return any errors.
 */
export function validateSettings(settings: MetabobVesselSettings): string[] {
  const errors: string[] = [];

  // Validate URL format
  try {
    new URL(settings.activityApiUrl);
  } catch {
    errors.push('Activity API URL is not a valid URL');
  }

  // Validate port range
  if (settings.serverPort < 1024 || settings.serverPort > 65535) {
    errors.push('Server port must be between 1024 and 65535');
  }

  // Validate sync interval
  if (settings.syncIntervalMinutes < 1 || settings.syncIntervalMinutes > 1440) {
    errors.push('Sync interval must be between 1 and 1440 minutes');
  }

  // Validate historical sync limit
  if (settings.historicalSyncLimit < 1 || settings.historicalSyncLimit > 10000) {
    errors.push('Historical sync limit must be between 1 and 10000');
  }

  // Validate folder paths (must not start with / or contain ..)
  const folderPaths = [
    settings.executionNotesFolder,
    settings.activityTemplatesFolder,
    settings.canvasFolder,
  ];

  for (const folder of folderPaths) {
    if (folder.startsWith('/')) {
      errors.push(`Folder path "${folder}" should not start with /`);
    }
    if (folder.includes('..')) {
      errors.push(`Folder path "${folder}" should not contain ..`);
    }
  }

  return errors;
}

/**
 * Merge partial settings with defaults.
 */
export function mergeSettings(
  partial: Partial<MetabobVesselSettings>
): MetabobVesselSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...partial,
    // Ensure arrays are properly merged
    allowedOrigins:
      partial.allowedOrigins ?? DEFAULT_SETTINGS.allowedOrigins,
  };
}
