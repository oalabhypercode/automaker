/**
 * 📊 Sync State Manager
 *
 * Verwaltet den Sync-Zustand pro Projekt.
 * Speichert lastPulledAt, lastPushedAt, etc. für inkrementellen Sync.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type { LocalSyncState, ProjectSyncState, SyncStateUpdate } from './pull-types.js';

// =============================================================================
// 📐 CONFIGURATION
// =============================================================================

/**
 * Sync State Manager Konfiguration
 */
export interface SyncStateManagerConfig {
  /**
   * Pfad zur State-Datei
   * @default '.automaker/sync-state.json'
   */
  storagePath: string;

  /**
   * Eindeutige Client-ID (pro Installation)
   */
  clientId: string;

  /**
   * Callback zum Laden der Datei
   */
  readFile: (path: string) => Promise<string | null>;

  /**
   * Callback zum Speichern der Datei
   */
  writeFile: (path: string, content: string) => Promise<void>;
}

// =============================================================================
// 📊 SYNC STATE MANAGER CLASS
// =============================================================================

/**
 * Sync State Manager für Tracking des Sync-Zustands
 *
 * @example
 * ```ts
 * const manager = createSyncStateManager({
 *   storagePath: '.automaker/sync-state.json',
 *   clientId: 'client-abc-123',
 *   readFile: async (p) => fs.readFile(p, 'utf-8'),
 *   writeFile: async (p, c) => fs.writeFile(p, c),
 * });
 *
 * await manager.load();
 * const state = manager.getProjectState('proj-456');
 * await manager.updateProjectState('proj-456', {
 *   lastPulledAt: new Date().toISOString(),
 * });
 * ```
 */
export class SyncStateManager {
  private state: LocalSyncState;
  private isDirty = false;

  constructor(private readonly config: SyncStateManagerConfig) {
    this.state = this.createEmptyState();
  }

  // ---------------------------------------------------------------------------
  // 📂 PERSISTENCE
  // ---------------------------------------------------------------------------

  /**
   * Lädt State aus der Datei
   */
  async load(): Promise<void> {
    try {
      const content = await this.config.readFile(this.config.storagePath);

      if (content) {
        const parsed = JSON.parse(content) as LocalSyncState;
        this.validateState(parsed);

        // Client-ID prüfen - bei Mismatch neuen State erstellen
        if (parsed.clientId !== this.config.clientId) {
          this.state = this.createEmptyState();
        } else {
          this.state = parsed;
        }
      }
    } catch {
      // Datei existiert nicht oder ungültig - leeren State verwenden
      this.state = this.createEmptyState();
    }
  }

  /**
   * Speichert State in die Datei
   */
  async save(): Promise<void> {
    if (!this.isDirty) return;

    this.state.updatedAt = new Date().toISOString();
    const content = JSON.stringify(this.state, null, 2);
    await this.config.writeFile(this.config.storagePath, content);
    this.isDirty = false;
  }

  // ---------------------------------------------------------------------------
  // 🔍 GETTER METHODS
  // ---------------------------------------------------------------------------

  /**
   * Gibt die Client-ID zurück
   */
  get clientId(): string {
    return this.state.clientId;
  }

  /**
   * Gibt alle Projekt-IDs mit State zurück
   */
  get projectIds(): string[] {
    return Object.keys(this.state.projects);
  }

  /**
   * Gibt den State für ein Projekt zurück
   */
  getProjectState(projectId: string): ProjectSyncState | null {
    return this.state.projects[projectId] ?? null;
  }

  /**
   * Gibt lastPulledAt für ein Projekt zurück
   */
  getLastPulledAt(projectId: string): Date | null {
    const state = this.state.projects[projectId];
    return state?.lastPulledAt ? new Date(state.lastPulledAt) : null;
  }

  /**
   * Gibt lastPushedAt für ein Projekt zurück
   */
  getLastPushedAt(projectId: string): Date | null {
    const state = this.state.projects[projectId];
    return state?.lastPushedAt ? new Date(state.lastPushedAt) : null;
  }

  /**
   * Gibt lastEventId für ein Projekt zurück
   */
  getLastEventId(projectId: string): string | null {
    return this.state.projects[projectId]?.lastEventId ?? null;
  }

  /**
   * Gibt den "since" Timestamp für Pull zurück
   * Falls nie gepullt: Epoch-Zeit (1970)
   */
  getSinceTimestamp(projectId: string): string {
    const lastPulled = this.state.projects[projectId]?.lastPulledAt;
    return lastPulled ?? new Date(0).toISOString();
  }

  // ---------------------------------------------------------------------------
  // ✏️ UPDATE METHODS
  // ---------------------------------------------------------------------------

  /**
   * Aktualisiert den State für ein Projekt
   */
  updateProjectState(projectId: string, update: SyncStateUpdate): void {
    // Projekt-State initialisieren falls nicht vorhanden
    if (!this.state.projects[projectId]) {
      this.state.projects[projectId] = this.createEmptyProjectState();
    }

    const projectState = this.state.projects[projectId];

    if (update.lastPulledAt !== undefined) {
      projectState.lastPulledAt = update.lastPulledAt;
    }

    if (update.lastPushedAt !== undefined) {
      projectState.lastPushedAt = update.lastPushedAt;
    }

    if (update.lastEventId !== undefined) {
      projectState.lastEventId = update.lastEventId;
    }

    if (update.incrementPull) {
      projectState.pullCount++;
    }

    if (update.incrementPush) {
      projectState.pushCount++;
    }

    this.isDirty = true;
  }

  /**
   * Setzt lastPulledAt für ein Projekt
   */
  setLastPulledAt(projectId: string, timestamp: Date): void {
    this.updateProjectState(projectId, {
      lastPulledAt: timestamp.toISOString(),
      incrementPull: true,
    });
  }

  /**
   * Setzt lastPushedAt für ein Projekt
   */
  setLastPushedAt(projectId: string, timestamp: Date): void {
    this.updateProjectState(projectId, {
      lastPushedAt: timestamp.toISOString(),
      incrementPush: true,
    });
  }

  /**
   * Setzt lastEventId für ein Projekt
   */
  setLastEventId(projectId: string, eventId: string): void {
    this.updateProjectState(projectId, { lastEventId: eventId });
  }

  /**
   * Resetzt den State für ein Projekt
   */
  resetProjectState(projectId: string): void {
    this.state.projects[projectId] = this.createEmptyProjectState();
    this.isDirty = true;
  }

  /**
   * Entfernt den State für ein Projekt
   */
  removeProjectState(projectId: string): boolean {
    if (!(projectId in this.state.projects)) {
      return false;
    }

    delete this.state.projects[projectId];
    this.isDirty = true;
    return true;
  }

  /**
   * Resetzt den gesamten State
   */
  resetAll(): void {
    this.state = this.createEmptyState();
    this.isDirty = true;
  }

  // ---------------------------------------------------------------------------
  // 📊 STATISTICS
  // ---------------------------------------------------------------------------

  /**
   * Gibt Sync-Statistiken zurück
   */
  getStatistics(): SyncStatistics {
    const projects = Object.entries(this.state.projects);

    return {
      totalProjects: projects.length,
      totalPulls: projects.reduce((sum, [, p]) => sum + p.pullCount, 0),
      totalPushes: projects.reduce((sum, [, p]) => sum + p.pushCount, 0),
      lastSyncAt: this.getLastSyncTime(),
      createdAt: new Date(this.state.createdAt),
    };
  }

  /**
   * Gibt den Zeitpunkt des letzten Syncs zurück (Pull oder Push)
   */
  getLastSyncTime(): Date | null {
    let latest: Date | null = null;

    for (const projectState of Object.values(this.state.projects)) {
      if (projectState.lastPulledAt) {
        const pulledAt = new Date(projectState.lastPulledAt);
        if (!latest || pulledAt > latest) latest = pulledAt;
      }
      if (projectState.lastPushedAt) {
        const pushedAt = new Date(projectState.lastPushedAt);
        if (!latest || pushedAt > latest) latest = pushedAt;
      }
    }

    return latest;
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private createEmptyState(): LocalSyncState {
    const now = new Date().toISOString();
    return {
      clientId: this.config.clientId,
      projects: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  private createEmptyProjectState(): ProjectSyncState {
    return {
      lastPulledAt: null,
      lastPushedAt: null,
      lastEventId: null,
      pullCount: 0,
      pushCount: 0,
    };
  }

  private validateState(data: unknown): asserts data is LocalSyncState {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid LocalSyncState: not an object');
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.clientId !== 'string') {
      throw new Error('Invalid LocalSyncState: missing clientId');
    }

    if (typeof obj.projects !== 'object' || obj.projects === null) {
      throw new Error('Invalid LocalSyncState: missing projects');
    }
  }
}

// =============================================================================
// 📊 STATISTICS TYPE
// =============================================================================

/**
 * Sync-Statistiken
 */
export interface SyncStatistics {
  totalProjects: number;
  totalPulls: number;
  totalPushes: number;
  lastSyncAt: Date | null;
  createdAt: Date;
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen Sync State Manager
 */
export function createSyncStateManager(config: SyncStateManagerConfig): SyncStateManager {
  return new SyncStateManager(config);
}

/**
 * Default Speicherpfad
 */
export const DEFAULT_SYNC_STATE_PATH = '.automaker/sync-state.json';

/**
 * Generiert eine eindeutige Client-ID
 */
export function generateClientId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `client-${timestamp}-${random}`;
}
