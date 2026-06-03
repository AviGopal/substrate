import { App, Plugin, PluginManifest, TFile, Notice } from 'obsidian';
import { GoalDispatchView, VIEW_TYPE_GOAL_DISPATCH } from './views/goal-dispatch-view';
import { GoalInputModal } from './views/goal-input-modal';
import { MetabobVesselSettings, DEFAULT_SETTINGS } from './settings';
import { MetabobVesselSettingTab } from './settings-tab';
import { HTTPServer } from './server/index';
import { VesselClient } from './vessel-client';
import { ActivityAPIClient } from './api-client';
import { SyncService } from './sync/index';
import { ConceptSyncService, makeObsidianNoteWriter } from './sync/concept-sync';
import { ConceptWritebackService } from './sync/concept-writeback';
import { ConceptBusListener } from './sync/concept-bus-listener';
import { ConceptDbClient } from './concept-db-client';
import { ExecutionCanvasBuilder } from './canvas/index';
import { ConceptCanvasBuilder } from './canvas/concept-canvas';
import { ExecutionFormatter, TemplateFormatter } from './formatters/index';
import { StatusBarManager } from './status-bar';
import { registerCommands } from './commands';
import { resolve, listResolverTypes } from './resolvers/index';
import { ExecutionTrace, ActivityTemplate } from './types';
import type { ImpulsePointer, ResolverResult } from './resolvers/types';

// Augment Obsidian's App type to include commands API
declare module 'obsidian' {
  interface App {
    commands: {
      commands: Record<string, { id: string; name: string }>;
      executeCommandById(id: string): boolean;
    };
    setting: {
      open(): void;
      openTabById(id: string): void;
    };
  }
}

// Import all resolvers to register them
// These modules self-register with the resolver registry on import
import './resolvers/note-resolver';
import './resolvers/search-resolver';
import './resolvers/canvas-resolver';
import './resolvers/backlinks-resolver';
import './resolvers/frontmatter-resolver';
import './resolvers/daily-note-resolver';
import './resolvers/graph-resolver';
import './resolvers/concept-view-resolver';
import './resolvers/concept-writeback-resolver';
import './resolvers/observe-obsidian-events';
import './resolvers/group-interaction-episodes';
import './resolvers/probe-obsidian-action-effects';
import { setConceptDbResolverContext } from './resolvers/concept-view-resolver';
import { setConceptWritebackResolverContext } from './resolvers/concept-writeback-resolver';
import {
  setObserveObsidianEventsContext,
  startObserveObsidianEvents,
  stopObserveObsidianEvents,
} from './resolvers/observe-obsidian-events';
import { setGroupInteractionEpisodesContext } from './resolvers/group-interaction-episodes';
import { ObsidianEventLog } from './resolvers/observation-types';

/**
 * Current status of the vessel plugin
 */
export interface VesselStatus {
  /** Whether connected to the activity API */
  apiConnected: boolean;
  /** Whether realtime sync is connected */
  realtimeConnected: boolean;
  /** Whether the HTTP server is running */
  serverRunning: boolean;
  /** ISO timestamp of last successful sync */
  lastSyncedAt: string | null;
  /** Number of executions synced */
  syncedCount: number;
  /** Number of impulse resolutions performed */
  resolutionCount: number;
  /** Whether a sync is currently in progress */
  syncing: boolean;
}

/**
 * Metabob Vessel Plugin for Obsidian
 *
 * This plugin transforms Obsidian into a vessel for the Metabob activity system,
 * enabling:
 * - Impulse resolution from vault content (notes, search, canvas, backlinks, etc.)
 * - Execution trace syncing and visualization
 * - Activity template management
 * - Real-time activity monitoring
 *
 * Architecture:
 * - HTTPServer: Exposes impulse resolution endpoints to external systems
 * - VesselClient: Registers with activity-api and maintains heartbeat
 * - SyncService: Syncs execution traces bidirectionally
 * - Resolvers: Type-specific impulse resolution (note, search, canvas, etc.)
 */
export default class MetabobVesselPlugin extends Plugin {
  settings: MetabobVesselSettings;

  // Services
  httpServer: HTTPServer | null = null;
  vesselClient: VesselClient | null = null;
  apiClient: ActivityAPIClient | null = null;
  syncService: SyncService | null = null;
  canvasBuilder: ExecutionCanvasBuilder | null = null;
  conceptCanvasBuilder: ConceptCanvasBuilder | null = null;
  statusBarManager: StatusBarManager | null = null;

  // Concept-DB frontend services
  conceptDbClient: ConceptDbClient | null = null;
  conceptSync: ConceptSyncService | null = null;
  conceptWriteback: ConceptWritebackService | null = null;
  conceptBusListener: ConceptBusListener | null = null;

  // Phase 1 observation layer — shared event log + workspace observer.
  // The log is bounded (cap = 10_000) and survives plugin lifetime so
  // both the windowing and probe resolvers see the same events.
  obsidianEventLog: ObsidianEventLog | null = null;
  private stopObservation: (() => void) | null = null;

  // Formatters
  executionFormatter: ExecutionFormatter | null = null;
  templateFormatter: TemplateFormatter | null = null;

  // State
  private startTime: number = Date.now();
  private resolutionCount: number = 0;
  private syncing: boolean = false;

  /**
   * Plugin load lifecycle
   *
   * Initialization phases are ordered by dependency:
   * 1. Settings must load first (everything depends on config)
   * 2. Formatters are stateless, can initialize early
   * 3. API client needed for vessel client and sync
   * 4. Vessel client registers us with the backend
   * 5. HTTP server exposes resolution endpoints
   * 6. Sync service needs API client
   * 7. Canvas builder needs app and settings
   * 8. UI components (settings tab, commands, status bar)
   * 9. Initial sync (delayed to let Obsidian finish loading)
   */
  async onload() {
    console.log('[Metabob Vessel] Loading plugin...');

    // Phase 1: Load settings
    // Settings must be loaded first as all other components depend on configuration
    await this.loadSettings();

    // Phase 2: Initialize formatters
    // Formatters are stateless utilities, safe to initialize early
    this.executionFormatter = new ExecutionFormatter(this.settings);
    this.templateFormatter = new TemplateFormatter();

    // Phase 3: Initialize API client
    // API client is needed for vessel registration and sync
    this.apiClient = new ActivityAPIClient(
      this.settings.activityApiUrl,
      this.settings.apiKey
    );

    // Phase 4: Initialize vessel client
    // Manages our registration with the activity-api backend
    this.vesselClient = new VesselClient(this.settings);

    // Phase 5: Start HTTP server (if enabled)
    // Server must start before registration so we can receive resolution requests
    if (this.settings.serverEnabled) {
      await this.startHTTPServer();
    }

    // Phase 6: Register with activity-api
    // This makes us discoverable to other vessels and the backend
    await this.registerVessel();

    // Phase 7: Initialize sync service
    // Sync service handles bidirectional execution trace synchronization
    this.syncService = new SyncService(
      this.app,
      this.settings,
      this.apiClient,
      this,
      this.executionFormatter!
    );
    await this.syncService.initialize();

    // Phase 8: Initialize canvas builder
    // Canvas builder creates visual execution graphs
    this.canvasBuilder = new ExecutionCanvasBuilder(this.app, this.settings);
    this.conceptCanvasBuilder = new ConceptCanvasBuilder(this.app, this.settings);

    // Phase 8b: Initialize concept-db frontend (opt-in)
    if (this.settings.enableConceptDbSync) {
      await this.initializeConceptDbFrontend();
    }

    // Phase 8c: Phase 1 observation layer.
    // Always on — the resolvers are inert until queried, and the
    // workspace subscriptions feed the shared event log so downstream
    // activities (`group-interaction-episodes`,
    // `probe-obsidian-action-effects`) have data to consume.
    this.initializeObservationLayer();

    // Phase 9: Register UI components
    // Settings tab for configuration
    this.addSettingTab(new MetabobVesselSettingTab(this.app, this));

    // Register Goal Dispatch sidebar view
    this.registerView(
      VIEW_TYPE_GOAL_DISPATCH,
      (leaf) => new GoalDispatchView(leaf, this),
    );

    // Register all commands (sync, status, create note, etc.)
    registerCommands(this);

    // Register goal dispatch command
    if (this.settings.enableGoalDispatch) {
      this.addCommand({
        id: 'dispatch-goal',
        name: 'Dispatch goal to substrate',
        callback: () => {
          new GoalInputModal(this.app, async (goal) => {
            await this.activateGoalDispatchView();
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_GOAL_DISPATCH);
            const leaf = leaves[0];
            if (leaf && leaf.view instanceof GoalDispatchView) {
              await (leaf.view as GoalDispatchView).dispatchGoal(goal);
            }
          }).open();
        },
      });
    }

    // Phase 10: Setup status bar
    // Status bar shows connection state and sync status
    const statusBarEl = this.addStatusBarItem();
    this.statusBarManager = new StatusBarManager(this, statusBarEl);
    this.statusBarManager.start();

    // Phase 11: Add ribbon icons
    // Existing: quick access to status command
    this.addRibbonIcon('activity', 'Metabob Vessel', () => {
      // Execute the status command when clicked
      const command = this.app.commands.commands['metabob-vessel:status'];
      if (command) {
        this.app.commands.executeCommandById('metabob-vessel:status');
      }
    });

    // Goal dispatch ribbon icon
    if (this.settings.enableGoalDispatch) {
      this.addRibbonIcon('bot', 'Goal Dispatch', () => {
        this.activateGoalDispatchView();
      });
    }

    // Phase 12: Initial sync (if configured)
    // Delay to let Obsidian fully initialize its workspace
    if (this.settings.syncOnStart) {
      setTimeout(() => {
        this.syncService?.syncHistorical().catch(error => {
          console.error('[Metabob Vessel] Initial sync failed:', error);
        });
      }, 2000);
    }

    console.log('[Metabob Vessel] Plugin loaded successfully');
    console.log(`[Metabob Vessel] Registered resolver types: ${listResolverTypes().join(', ')}`);
  }

  /**
   * Plugin unload lifecycle
   *
   * Graceful shutdown sequence:
   * 1. Stop status bar updates
   * 2. Deregister from backend (removes heartbeat)
   * 3. Cleanup sync service (close WebSocket, etc.)
   * 4. Stop HTTP server
   */
  async onunload() {
    console.log('[Metabob Vessel] Unloading plugin...');

    // Stop status bar updates first (UI cleanup)
    this.statusBarManager?.stop();

    // Deregister from backend (graceful disconnect)
    try {
      await this.vesselClient?.deregister();
    } catch (error) {
      console.error('[Metabob Vessel] Error during deregistration:', error);
    }

    // Cleanup sync service (close connections)
    this.syncService?.cleanup();

    // Stop concept-db frontend services
    this.conceptBusListener?.stop();
    this.conceptWriteback?.stop();
    this.conceptSync?.stop();

    // Stop the Phase 1 observation layer (unsubscribes workspace + vault
    // handlers and clears the resolver context).
    try {
      this.stopObservation?.();
      stopObserveObsidianEvents();
      setObserveObsidianEventsContext(null, null);
      setGroupInteractionEpisodesContext(null);
    } catch (error) {
      console.error('[Metabob Vessel] Error stopping observation layer:', error);
    }
    this.obsidianEventLog = null;
    this.stopObservation = null;

    // Stop HTTP server last (may have pending requests)
    try {
      await this.httpServer?.stop();
    } catch (error) {
      console.error('[Metabob Vessel] Error stopping HTTP server:', error);
    }

    // Clear references
    this.httpServer = null;
    this.vesselClient = null;
    this.apiClient = null;
    this.syncService = null;
    this.canvasBuilder = null;
    this.statusBarManager = null;
    this.executionFormatter = null;
    this.templateFormatter = null;

    console.log('[Metabob Vessel] Plugin unloaded');
  }

  /**
   * Load settings from Obsidian data store
   */
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  /**
   * Save settings to Obsidian data store
   */
  async saveSettings() {
    await this.saveData(this.settings);

    // Notify services of settings change
    if (this.executionFormatter) {
      this.executionFormatter = new ExecutionFormatter(this.settings);
    }
  }

  /**
   * Start the HTTP server for impulse resolution
   */
  private async startHTTPServer() {
    try {
      // Create resolvers map that wraps our registry
      const resolvers = new Map<string, (pointer: any) => Promise<{ success: boolean; content?: string; metadata?: any; error?: string }>>();

      for (const shape of this.settings.shapes) {
        resolvers.set(shape, async (pointer) => {
          try {
            this.resolutionCount++;
            this.vesselClient?.incrementResolutions();
            // Add the type to the pointer so the resolver knows which shape to use
            const pointerWithType = { ...pointer, type: shape };
            const result = await resolve(pointerWithType, this.app);
            const content = typeof result === 'string' ? result : result.content;
            const metadata = typeof result === 'object' ? result.metadata : undefined;
            return { success: true, content, metadata };
          } catch (error: any) {
            return { success: false, error: error.message };
          }
        });
      }

      this.httpServer = new HTTPServer({
        port: this.settings.serverPort,
        cors: {
          allowedOrigins: this.settings.allowedOrigins,
        },
        manifest: {
          vesselId: this.settings.vesselId || 'obsidian-vessel',
          vesselName: this.settings.vesselName,
          version: '0.1.0',
          shapes: this.settings.shapes,
        },
        resolvers,
      });

      await this.httpServer.start();
      console.log(`[Metabob Vessel] HTTP server started on port ${this.settings.serverPort}`);
    } catch (error) {
      console.error('[Metabob Vessel] Failed to start HTTP server:', error);

      // Show user-friendly error
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Metabob: Failed to start HTTP server - ${errorMessage}`);

      // Server failure is not fatal - we can still work in offline mode
      this.httpServer = null;
    }
  }

  /**
   * Register this vessel with the activity-api backend
   */
  private async registerVessel() {
    if (!this.vesselClient) return;

    try {
      // Get vault path for identification
      const adapter = this.app.vault.adapter as { basePath?: string };
      const vaultPath = adapter.basePath || '';

      const success = await this.vesselClient.register(
        vaultPath,
        this.settings.serverPort
      );

      if (success) {
        // Start heartbeat to maintain registration
        this.vesselClient.startHeartbeat();
        console.log('[Metabob Vessel] Registered with activity-api');
      } else {
        console.warn('[Metabob Vessel] Registration returned false');
      }
    } catch (error) {
      // Registration failure is not fatal - we work in offline mode
      console.error('[Metabob Vessel] Failed to register:', error);
      // Don't show notice - this is expected when API is unavailable
    }
  }

  /**
   * Reconnect to the backend
   * Used when settings change or connection is lost
   */
  async reconnect() {
    console.log('[Metabob Vessel] Reconnecting...');

    // Deregister first
    try {
      await this.vesselClient?.deregister();
    } catch (error) {
      console.error('[Metabob Vessel] Error during deregistration:', error);
    }

    // Re-initialize vessel client with new settings
    this.vesselClient = new VesselClient(this.settings);

    // Re-initialize API client with new settings
    this.apiClient = new ActivityAPIClient(
      this.settings.activityApiUrl,
      this.settings.apiKey
    );

    // Re-register
    await this.registerVessel();

    // Re-initialize sync service
    this.syncService?.cleanup();
    this.syncService = new SyncService(
      this.app,
      this.settings,
      this.apiClient,
      this,
      this.executionFormatter!
    );
    await this.syncService.initialize();

    console.log('[Metabob Vessel] Reconnection complete');
  }

  /**
   * Restart the HTTP server
   * Used when server settings change
   */
  async restartServer() {
    console.log('[Metabob Vessel] Restarting HTTP server...');

    // Stop existing server
    try {
      await this.httpServer?.stop();
    } catch (error) {
      console.error('[Metabob Vessel] Error stopping HTTP server:', error);
    }

    this.httpServer = null;

    // Start new server if enabled
    if (this.settings.serverEnabled) {
      await this.startHTTPServer();
    }

    console.log('[Metabob Vessel] HTTP server restart complete');
  }

  /**
   * Initialize the concept-db frontend services (Phase 1+3+4 wiring).
   *
   * Idempotent: stops any existing instances before constructing new
   * ones so this can be called again after settings changes.
   */
  async initializeConceptDbFrontend(): Promise<void> {
    // Stop existing instances if any
    this.conceptBusListener?.stop();
    this.conceptWriteback?.stop();
    this.conceptSync?.stop();

    const apiKey = this.settings.conceptDbApiKey || this.settings.apiKey;
    this.conceptDbClient = new ConceptDbClient(
      this.settings.conceptDbEndpoint,
      apiKey,
    );

    const writer = makeObsidianNoteWriter(this.app);
    this.conceptSync = new ConceptSyncService(
      this.settings,
      this.conceptDbClient,
      writer,
    );
    await this.conceptSync.start();

    if (this.settings.enableConceptDbWriteback) {
      this.conceptWriteback = new ConceptWritebackService(
        this.app,
        this.settings,
        this.conceptDbClient,
      );
      this.conceptWriteback.start();
    }

    // Phase 4: subscribe to the activity-api WS bus for live updates
    this.conceptBusListener = new ConceptBusListener(
      this.settings,
      this.conceptSync,
      this.conceptDbClient,
    );
    this.conceptBusListener.start();

    // Make the client/sync available to the impulse resolvers
    setConceptDbResolverContext(this.conceptDbClient, this.settings);
    setConceptWritebackResolverContext(this.conceptDbClient, this.conceptSync);
  }

  /**
   * Initialize the Phase 1 Obsidian observation layer.
   *
   * Creates the shared `ObsidianEventLog`, injects it into the three
   * observation resolvers, and starts the workspace + vault event
   * subscriptions. Idempotent: re-invocation tears down existing
   * subscriptions first.
   */
  initializeObservationLayer(): void {
    try {
      this.stopObservation?.();
    } catch (error) {
      console.error('[Metabob Vessel] Error tearing down prior observation layer:', error);
    }

    const log = new ObsidianEventLog(10_000);
    this.obsidianEventLog = log;
    setObserveObsidianEventsContext(this.app, log);
    setGroupInteractionEpisodesContext(log);
    this.stopObservation = startObserveObsidianEvents();
    console.log('[Metabob Vessel] Observation layer started (event log cap=10000)');
  }

  /**
   * Get current vessel status
   */
  getStatus(): VesselStatus {
    const syncStatus = this.syncService?.getStatus();

    return {
      apiConnected: this.vesselClient?.isRegistered() || false,
      realtimeConnected: syncStatus?.realtimeConnected || false,
      serverRunning: this.httpServer !== null,
      lastSyncedAt: syncStatus?.lastSyncedAt || null,
      syncedCount: syncStatus?.syncedCount || 0,
      resolutionCount: this.resolutionCount,
      syncing: this.syncing
    };
  }

  /**
   * Get uptime in milliseconds
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Set syncing state
   */
  setSyncing(syncing: boolean) {
    this.syncing = syncing;
  }

  /**
   * Create a note from an execution trace
   *
   * @param executionId - The execution trace ID
   * @returns The created file, or null if failed
   */
  async createNoteFromExecution(executionId: string): Promise<TFile | null> {
    if (!this.apiClient || !this.executionFormatter) {
      new Notice('API client or formatter not initialized');
      return null;
    }

    try {
      // Fetch execution trace from API
      const execution = await this.apiClient.getExecutionTrace(executionId);
      if (!execution) {
        new Notice(`Execution not found: ${executionId}`);
        return null;
      }

      // Format as markdown
      const content = this.executionFormatter.format(execution);

      // Build file path with date organization
      const date = new Date(execution.executed_at).toISOString().split('T')[0];
      const path = `${this.settings.executionNotesFolder}/${date}/${executionId}.md`;

      // Ensure folder exists
      const folderPath = path.substring(0, path.lastIndexOf('/'));
      await this.ensureFolderExists(folderPath);

      // Create the file
      const file = await this.app.vault.create(path, content);

      // Open the new file
      await this.app.workspace.openLinkText(path, '', true);

      new Notice(`Created note: ${file.basename}`);
      return file;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Metabob Vessel] Failed to create note:', error);
      new Notice(`Failed to create note: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Create a note from an activity template
   *
   * @param template - The activity template
   * @returns The created/updated file, or null if failed
   */
  async createNoteFromTemplate(template: ActivityTemplate): Promise<TFile | null> {
    if (!this.templateFormatter) {
      new Notice('Template formatter not initialized');
      return null;
    }

    try {
      // Format as markdown
      const content = this.templateFormatter.format(template);

      // Build file path
      const path = `${this.settings.activityTemplatesFolder}/${template.activity_id}.md`;

      // Ensure folder exists
      const folderPath = path.substring(0, path.lastIndexOf('/'));
      await this.ensureFolderExists(folderPath);

      // Check if file already exists
      const existing = this.app.vault.getAbstractFileByPath(path);
      if (existing instanceof TFile) {
        // Update existing file
        await this.app.vault.modify(existing, content);
        await this.app.workspace.openLinkText(path, '', true);
        new Notice(`Updated template note: ${existing.basename}`);
        return existing;
      }

      // Create new file
      const file = await this.app.vault.create(path, content);
      await this.app.workspace.openLinkText(path, '', true);
      new Notice(`Created template note: ${file.basename}`);
      return file;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Metabob Vessel] Failed to create template note:', error);
      new Notice(`Failed to create template note: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Open the execution canvas view
   * Shows recent executions as a visual graph
   */
  async openExecutionCanvas(): Promise<void> {
    if (!this.canvasBuilder || !this.apiClient) {
      new Notice('Canvas builder or API client not initialized');
      return;
    }

    try {
      // Fetch recent executions
      const response = await this.apiClient.listExecutionTraces({ limit: 20 });

      if (!response?.executions || response.executions.length === 0) {
        new Notice('No execution traces found');
        return;
      }

      // Build canvas
      await this.canvasBuilder.buildExecutionCanvas(response.executions);

      // Open canvas file
      const path = `${this.settings.canvasFolder}/executions.canvas`;
      await this.app.workspace.openLinkText(path, '', true);

      new Notice(`Opened execution canvas with ${response.executions.length} traces`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Metabob Vessel] Failed to open canvas:', error);
      new Notice(`Failed to open canvas: ${errorMessage}`);
    }
  }

  /**
   * Open the composition canvas view
   * Shows activity relationships and impulse flows as a visual graph
   */
  async openCompositionCanvas(): Promise<void> {
    if (!this.canvasBuilder || !this.apiClient) {
      new Notice('Canvas builder or API client not initialized');
      return;
    }

    try {
      // Fetch composition graph
      const graph = await this.apiClient.getCompositionGraph({ limit: 50 });

      if (!graph?.nodes || graph.nodes.length === 0) {
        new Notice('No composition graph data found');
        return;
      }

      // Build canvas
      await this.canvasBuilder.buildCompositionCanvas(graph);

      // Open canvas file
      const path = `${this.settings.canvasFolder}/composition-graph.canvas`;
      await this.app.workspace.openLinkText(path, '', true);

      new Notice(`Opened composition canvas with ${graph.totalNodes} activities and ${graph.totalEdges} relationships`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Metabob Vessel] Failed to open composition canvas:', error);
      new Notice(`Failed to open composition canvas: ${errorMessage}`);
    }
  }

  /**
   * Ensure a folder path exists, creating intermediate folders as needed
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const parts = folderPath.split('/').filter(p => p.length > 0);
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const existing = this.app.vault.getAbstractFileByPath(currentPath);

      if (!existing) {
        try {
          await this.app.vault.createFolder(currentPath);
        } catch (error) {
          // Folder might have been created by another process
          if (!this.app.vault.getAbstractFileByPath(currentPath)) {
            throw error;
          }
        }
      }
    }
  }

  /**
   * Manually trigger a sync
   */
  async triggerSync(): Promise<void> {
    if (!this.syncService) {
      new Notice('Sync service not initialized');
      return;
    }

    this.syncing = true;
    try {
      await this.syncService.syncHistorical();
      new Notice('Sync completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Sync failed: ${errorMessage}`);
    } finally {
      this.syncing = false;
    }
  }

  /**
   * Open (or reveal) the Goal Dispatch sidebar panel.
   */
  async activateGoalDispatchView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_GOAL_DISPATCH);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: VIEW_TYPE_GOAL_DISPATCH, active: true });
      this.app.workspace.revealLeaf(leaf);
    }
  }

  /**
   * Get available resolver types
   */
  getResolverTypes(): string[] {
    return listResolverTypes();
  }
}
