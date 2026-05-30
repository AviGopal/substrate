/**
 * Concept-DB Sync Service
 *
 * Mirrors concept-db into the vault. Paginates `/concepts/search`,
 * fetches neighbors per concept, materializes notes via the
 * concept-formatter, and refreshes them on a configurable interval.
 *
 * Materialization is delegated to a `NoteWriter` callback so that this
 * module works both inside Obsidian (where `app.vault.create/modify`
 * is the right call) and outside Obsidian (where Node `fs` is used
 * for offline pulls / test scripts).
 */

import type { App, TFile } from 'obsidian';
import type { MetabobVesselSettings } from '../settings';
import type { ConceptDbClient, ConceptRecord, ConceptNeighbor } from '../concept-db-client';
import { shortConceptId } from '../concept-db-client';
import {
  conceptNotePath,
  renderConceptNote,
  buildCollisionMap,
} from '../formatters/concept-formatter';

/**
 * Default source_types excluded when no explicit list is configured.
 * `impulse_signature` concepts are produced per analysis-vessel
 * resolution and would dominate the vault.
 */
const DEFAULT_EXCLUDED_SOURCE_TYPES = new Set<string>(['impulse_signature']);

/**
 * NoteWriter abstracts vault writes so the sync service can run either
 * inside Obsidian (preferred) or against a plain Node filesystem (for
 * offline tests). The two implementations are provided as
 * `makeObsidianNoteWriter(app)` and `makeFsNoteWriter(rootDir)`.
 */
export interface NoteWriter {
  /**
   * Return true if a note already exists at the given vault-relative
   * path.
   */
  exists(path: string): Promise<boolean>;
  /**
   * Read the contents of an existing note (null if missing).
   */
  read(path: string): Promise<string | null>;
  /**
   * Write a note, creating parent folders as needed. Overwrites if it
   * already exists.
   */
  write(path: string, content: string): Promise<void>;
}

export interface ConceptSyncStatus {
  syncedCount: number;
  lastPullAt: string | null;
  lastError: string | null;
  running: boolean;
}

export interface ConceptSyncOptions {
  /** Page size for /concepts/search pagination (default 50). */
  pageSize?: number;
  /** Hard cap on concepts pulled per tick (default 5000). */
  maxConceptsPerTick?: number;
  /** Logger; default uses console with prefix. */
  logger?: (level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) => void;
}

const defaultLogger = (
  level: 'info' | 'warn' | 'error',
  msg: string,
  data?: Record<string, unknown>,
) => {
  const prefix = '[ConceptSync]';
  const tail = data ? ` ${JSON.stringify(data)}` : '';
  if (level === 'info') console.log(`${prefix} ${msg}${tail}`);
  else if (level === 'warn') console.warn(`${prefix} ${msg}${tail}`);
  else console.error(`${prefix} ${msg}${tail}`);
};

/**
 * Returns true if a concept's source_type should be included given the
 * settings filter. Empty `allow` array means "all except defaults".
 */
function shouldInclude(
  concept: ConceptRecord,
  allow: string[],
): boolean {
  const st = concept.source_type;
  if (allow.length > 0) {
    return !!st && allow.includes(st);
  }
  if (!st) return true;
  return !DEFAULT_EXCLUDED_SOURCE_TYPES.has(st);
}

/**
 * Decide whether to (re)write the note for a concept. We skip when the
 * remote `updated_at` is not newer than the on-disk
 * `last_substrate_pull_at`, and we never clobber a note flagged
 * `pending_sync: true` (that note has local edits queued for
 * writeback).
 */
function shouldRefresh(
  existing: string | null,
  concept: ConceptRecord,
): boolean {
  if (!existing) return true;
  const pendingMatch = /^pending_sync:\s*true\s*$/m.exec(existing);
  if (pendingMatch) return false;
  const remoteUpdated = concept.updated_at;
  if (!remoteUpdated) return false;
  const localMatch = /^last_substrate_pull_at:\s*(\S+)\s*$/m.exec(existing);
  if (!localMatch) return true;
  return new Date(remoteUpdated).getTime() > new Date(localMatch[1]).getTime();
}

export class ConceptSyncService {
  private timer: ReturnType<typeof setInterval> | null = null;
  private status: ConceptSyncStatus = {
    syncedCount: 0,
    lastPullAt: null,
    lastError: null,
    running: false,
  };
  private logger: NonNullable<ConceptSyncOptions['logger']>;
  private pageSize: number;
  private maxConceptsPerTick: number;

  constructor(
    private settings: MetabobVesselSettings,
    private client: ConceptDbClient,
    private writer: NoteWriter,
    options: ConceptSyncOptions = {},
  ) {
    this.logger = options.logger ?? defaultLogger;
    this.pageSize = options.pageSize ?? 50;
    this.maxConceptsPerTick = options.maxConceptsPerTick ?? 5000;
  }

  getStatus(): ConceptSyncStatus {
    return { ...this.status };
  }

  /**
   * Start the periodic pull loop. Runs `pullAll()` once immediately,
   * then again every `conceptDbSyncIntervalSec` seconds.
   */
  async start(): Promise<void> {
    if (this.timer) return;
    this.logger('info', 'starting concept-sync', {
      endpoint: this.settings.conceptDbEndpoint,
      intervalSec: this.settings.conceptDbSyncIntervalSec,
    });
    // first run; swallow errors so the interval still installs
    this.pullAll().catch((err) =>
      this.logger('error', 'initial pull failed', { error: String(err) }),
    );
    const ms = Math.max(30_000, this.settings.conceptDbSyncIntervalSec * 1000);
    this.timer = setInterval(() => {
      this.pullAll().catch((err) =>
        this.logger('error', 'periodic pull failed', { error: String(err) }),
      );
    }, ms);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Single pass through concept-db: paginate /concepts/search, for each
   * concept fetch neighbors, render the note, and write if the on-disk
   * copy is stale.
   */
  async pullAll(): Promise<number> {
    if (this.status.running) {
      this.logger('warn', 'pull already running, skipping');
      return 0;
    }
    this.status.running = true;
    this.status.lastError = null;
    let pulled = 0;
    try {
      const allow = this.settings.conceptDbSyncSourceTypes ?? [];
      const sourceTypeFilter =
        allow.length === 1 ? allow[0] : undefined; // single-value optimization: server-side filter

      // Pre-scan: collect every concept that will be materialized
      // BEFORE we start writing files, so we can build the collision
      // map (multiple concepts sharing source_type + Title Case
      // basename → disambiguator suffix needed). Without this pre-scan
      // the first concept of a colliding set would write a bare-title
      // file and the second would silently overwrite it.
      const collected: ConceptRecord[] = [];
      let offset = 0;
      while (collected.length < this.maxConceptsPerTick) {
        const page = await this.client.searchConcepts({
          sourceType: sourceTypeFilter,
          limit: this.pageSize,
          offset,
        });
        if (!page.concepts.length) break;
        for (const concept of page.concepts) {
          if (collected.length >= this.maxConceptsPerTick) break;
          if (!shouldInclude(concept, allow)) continue;
          collected.push(concept);
        }
        if (page.concepts.length < this.pageSize) break;
        offset += this.pageSize;
      }
      const collisions = buildCollisionMap(collected);

      // Write phase: materialize each collected concept with the
      // collision-aware path resolver.
      for (const concept of collected) {
        try {
          const wrote = await this.materializeConcept(concept, collisions);
          if (wrote) pulled += 1;
        } catch (err) {
          this.logger('warn', 'materialize failed', {
            id: concept.id,
            error: String(err),
          });
        }
      }
      this.status.syncedCount += pulled;
      this.status.lastPullAt = new Date().toISOString();
      this.logger('info', 'pull complete', { pulled, syncedTotal: this.status.syncedCount });
    } catch (err) {
      this.status.lastError = err instanceof Error ? err.message : String(err);
      this.logger('error', 'pull failed', { error: this.status.lastError });
    } finally {
      this.status.running = false;
    }
    return pulled;
  }

  /**
   * Fetch neighbors, render, and write the note for one concept.
   * Returns true if a write actually happened. The optional
   * `collisions` map (built by pullAll's pre-scan) disambiguates
   * filenames when two concepts share source_type + Title Case.
   */
  async materializeConcept(
    concept: ConceptRecord,
    collisions?: Map<string, string[]>,
  ): Promise<boolean> {
    const path = conceptNotePath(concept, this.settings.conceptDbSyncRoot, collisions);
    const existing = await this.writer.read(path);
    if (!shouldRefresh(existing, concept)) return false;
    let neighbors: ConceptNeighbor[] = [];
    try {
      neighbors = await this.client.getNeighbors(concept.id);
    } catch (err) {
      this.logger('warn', 'neighbors fetch failed', {
        id: concept.id,
        error: String(err),
      });
    }
    const content = renderConceptNote(concept, neighbors, {
      pulledAt: new Date().toISOString(),
    });
    await this.writer.write(path, content);
    return true;
  }
}

// =============================================================================
// NoteWriter implementations
// =============================================================================

/**
 * NoteWriter backed by Obsidian's vault API. Use when running inside
 * the plugin.
 */
export function makeObsidianNoteWriter(app: App): NoteWriter {
  const ensureFolder = async (folderPath: string): Promise<void> => {
    if (!folderPath) return;
    const parts = folderPath.split('/').filter(Boolean);
    let cur = '';
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part;
      const existing = app.vault.getAbstractFileByPath(cur);
      if (!existing) {
        try {
          await app.vault.createFolder(cur);
        } catch (err) {
          if (!app.vault.getAbstractFileByPath(cur)) throw err;
        }
      }
    }
  };
  return {
    async exists(path: string): Promise<boolean> {
      return app.vault.getAbstractFileByPath(path) != null;
    },
    async read(path: string): Promise<string | null> {
      const file = app.vault.getAbstractFileByPath(path);
      if (!file || !('extension' in file)) return null;
      return app.vault.read(file as TFile);
    },
    async write(path: string, content: string): Promise<void> {
      const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      await ensureFolder(folder);
      const existing = app.vault.getAbstractFileByPath(path);
      if (existing && 'extension' in existing) {
        await app.vault.modify(existing as TFile, content);
      } else {
        await app.vault.create(path, content);
      }
    },
  };
}

/**
 * NoteWriter backed by Node `fs`. Use for offline pulls (e.g. test
 * harnesses, CLI scripts). `rootDir` is the absolute path to the vault
 * root; vault-relative paths are joined under it.
 */
export function makeFsNoteWriter(rootDir: string): NoteWriter {
  // Lazy-load Node fs so this module can still be imported in the
  // Obsidian bundler without complaining.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('fs') as typeof import('fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const path = require('path') as typeof import('path');
  const resolve = (p: string) => path.join(rootDir, p);
  return {
    async exists(p: string): Promise<boolean> {
      return fs.existsSync(resolve(p));
    },
    async read(p: string): Promise<string | null> {
      const abs = resolve(p);
      if (!fs.existsSync(abs)) return null;
      return fs.promises.readFile(abs, 'utf8');
    },
    async write(p: string, content: string): Promise<void> {
      const abs = resolve(p);
      await fs.promises.mkdir(path.dirname(abs), { recursive: true });
      await fs.promises.writeFile(abs, content, 'utf8');
    },
  };
}
