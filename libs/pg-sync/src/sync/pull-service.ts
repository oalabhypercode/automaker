/**
 * 🔄 Pull Service
 *
 * Hauptlogik für den Pull-Mechanismus.
 * Koordiniert API-Calls, Event-Processing und Feature-Erstellung.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type {
  PullConfig,
  PullStatus,
  PullProcessResult,
  PullProcessError,
  PullEvent,
  PullEventCallback,
  PullTrigger,
  SinglePullOptions,
  RemoteEvent,
  RemoteTicket,
  LocalFeatureData,
  EventProcessResult,
} from './pull-types.js';
import { DEFAULT_PULL_CONFIG } from './pull-types.js';
import type { PullApi } from './pull-api.js';
import type { EventProcessor } from './event-processor.js';
import type { SyncStateManager } from './sync-state-manager.js';
import type { IdMapper } from './id-mapper.js';

// =============================================================================
// 📐 CONFIGURATION
// =============================================================================

/**
 * Pull Service Konfiguration
 */
export interface PullServiceConfig extends Partial<PullConfig> {
  /**
   * Pull API Client
   */
  pullApi: PullApi;

  /**
   * Event Processor
   */
  eventProcessor: EventProcessor;

  /**
   * Sync State Manager
   */
  syncStateManager: SyncStateManager;

  /**
   * ID Mapper
   */
  idMapper: IdMapper;

  /**
   * Callback um zu prüfen ob Outbox leer ist
   */
  hasEmptyOutbox: () => Promise<boolean>;

  /**
   * Callback um Outbox zu verarbeiten (Push-before-Pull)
   */
  processOutbox?: () => Promise<void>;
}

// =============================================================================
// 🔄 PULL SERVICE CLASS
// =============================================================================

/**
 * Pull Service für Remote → Local Synchronisation
 *
 * @example
 * ```ts
 * const service = createPullService({
 *   pullApi,
 *   eventProcessor,
 *   syncStateManager,
 *   idMapper,
 *   hasEmptyOutbox: async () => outbox.isEmpty(),
 * });
 *
 * const result = await service.pullChanges('proj-123', 'manual');
 * ```
 */
export class PullService {
  private status: PullStatus;
  private listeners: PullEventCallback[] = [];
  private config: PullConfig;
  private isProcessing = false;

  constructor(private readonly serviceConfig: PullServiceConfig) {
    this.config = { ...DEFAULT_PULL_CONFIG, ...serviceConfig };
    this.status = this.createInitialStatus();
  }

  // ---------------------------------------------------------------------------
  // 🔄 MAIN PULL METHODS
  // ---------------------------------------------------------------------------

  /**
   * Führt einen vollständigen Pull für ein Projekt durch
   */
  async pullChanges(
    projectId: string,
    trigger: PullTrigger = 'manual'
  ): Promise<PullProcessResult> {
    // Nur ein Pull gleichzeitig
    if (this.isProcessing) {
      return this.createErrorResult('Pull already in progress');
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Status initialisieren
      this.updateStatus({
        isProcessing: true,
        currentPhase: 'fetching',
        startedAt: new Date(),
        lastError: null,
      });

      this.emitEvent('start', trigger, projectId);

      // 1. Push-before-Pull (wenn konfiguriert)
      await this.pushBeforePull();

      // 2. Since-Timestamp holen
      const since = this.serviceConfig.syncStateManager.getSinceTimestamp(projectId);

      // 3. Events abrufen
      this.updateStatus({ currentPhase: 'fetching' });

      const { events, tickets } = await this.fetchAllData(projectId, since);

      // 4. Events verarbeiten
      this.updateStatus({
        currentPhase: 'processing',
        eventsTotal: events.length,
      });

      const eventResults = await this.processEvents(events);

      // 5. Neue Tickets erstellen
      this.updateStatus({ currentPhase: 'creating' });

      const ticketResults = await this.processNewTickets(tickets);

      // 6. Sync-State aktualisieren
      await this.updateSyncState(projectId, events);

      // 7. ID-Mappings speichern
      await this.serviceConfig.idMapper.save();

      // 8. Ergebnis erstellen
      const result = this.createResult(eventResults, ticketResults, startTime);

      // Status finalisieren
      this.updateStatus({
        isProcessing: false,
        currentPhase: 'complete',
        progress: 100,
      });

      this.emitEvent('complete', trigger, projectId, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.updateStatus({
        isProcessing: false,
        currentPhase: 'error',
        lastError: errorMessage,
      });

      this.emitEvent('error', trigger, projectId);

      return this.createErrorResult(errorMessage);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Pull mit erweiterten Optionen
   */
  async pullWithOptions(options: SinglePullOptions): Promise<PullProcessResult> {
    if (options.skipPushFirst) {
      // Temporär Push-before-Pull deaktivieren
      const originalProcess = this.serviceConfig.processOutbox;
      this.serviceConfig.processOutbox = undefined;

      try {
        return await this.pullChanges(options.projectId, 'manual');
      } finally {
        this.serviceConfig.processOutbox = originalProcess;
      }
    }

    return this.pullChanges(options.projectId, 'manual');
  }

  // ---------------------------------------------------------------------------
  // 📊 STATUS METHODS
  // ---------------------------------------------------------------------------

  /**
   * Gibt den aktuellen Pull-Status zurück
   */
  getStatus(): PullStatus {
    return { ...this.status };
  }

  /**
   * Prüft ob ein Pull gerade läuft
   */
  get isPulling(): boolean {
    return this.isProcessing;
  }

  /**
   * Registriert einen Event-Listener
   */
  addListener(callback: PullEventCallback): () => void {
    this.listeners.push(callback);

    // Cleanup-Funktion zurückgeben
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Entfernt alle Listener
   */
  removeAllListeners(): void {
    this.listeners = [];
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS - FETCHING
  // ---------------------------------------------------------------------------

  private async pushBeforePull(): Promise<void> {
    // Prüfen ob Push nötig
    const hasEmptyOutbox = await this.serviceConfig.hasEmptyOutbox();

    if (hasEmptyOutbox) {
      return;
    }

    // Push durchführen falls Callback vorhanden
    if (this.serviceConfig.processOutbox) {
      await this.serviceConfig.processOutbox();
    }
  }

  private async fetchAllData(
    projectId: string,
    since: string
  ): Promise<{ events: RemoteEvent[]; tickets: RemoteTicket[] }> {
    return this.serviceConfig.pullApi.fetchAllEvents(projectId, since, (fetched, hasMore) => {
      this.updateStatus({
        eventsProcessed: fetched,
        progress: hasMore ? Math.min(90, (fetched / 100) * 10) : 10,
      });
    });
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS - PROCESSING
  // ---------------------------------------------------------------------------

  private async processEvents(events: RemoteEvent[]): Promise<EventProcessResult[]> {
    const results: EventProcessResult[] = [];
    const total = events.length;

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const result = await this.serviceConfig.eventProcessor.processEvent(event);
      results.push(result);

      // Progress aktualisieren
      const progress = 10 + ((i + 1) / total) * 60; // 10-70%
      this.updateStatus({
        eventsProcessed: i + 1,
        ticketsUpdated: results.filter((r) => r.action === 'updated').length,
        progress: Math.round(progress),
      });
    }

    return results;
  }

  private async processNewTickets(tickets: RemoteTicket[]): Promise<EventProcessResult[]> {
    const results: EventProcessResult[] = [];
    const total = tickets.length;

    // Parallel verarbeiten (max concurrency)
    const batchSize = this.config.concurrency;

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((ticket) => this.serviceConfig.eventProcessor.processNewTicket(ticket))
      );

      results.push(...batchResults);

      // Progress aktualisieren
      const processed = Math.min(i + batchSize, total);
      const progress = 70 + (processed / total) * 25; // 70-95%

      this.updateStatus({
        ticketsCreated: results.filter((r) => r.action === 'created').length,
        progress: Math.round(progress),
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS - STATE & RESULT
  // ---------------------------------------------------------------------------

  private async updateSyncState(projectId: string, events: RemoteEvent[]): Promise<void> {
    // Letztes Event-ID finden
    const lastEvent = events[events.length - 1];
    const lastEventId = lastEvent?.id ?? null;

    // Sync-State aktualisieren
    this.serviceConfig.syncStateManager.setLastPulledAt(projectId, new Date());

    if (lastEventId) {
      this.serviceConfig.syncStateManager.setLastEventId(projectId, lastEventId);
    }

    // Speichern
    await this.serviceConfig.syncStateManager.save();
  }

  private createResult(
    eventResults: EventProcessResult[],
    ticketResults: EventProcessResult[],
    startTime: number
  ): PullProcessResult {
    const allResults = [...eventResults, ...ticketResults];

    const errors: PullProcessError[] = allResults
      .filter((r) => !r.success)
      .map((r) => ({
        eventId: r.eventId,
        error: r.error ?? 'Unknown error',
        recoverable: r.action !== 'error',
      }));

    return {
      success: errors.length === 0,
      eventsProcessed: eventResults.length,
      ticketsCreated: allResults.filter((r) => r.action === 'created').length,
      ticketsUpdated: allResults.filter((r) => r.action === 'updated').length,
      ticketsSkipped: allResults.filter((r) => r.action === 'skipped').length,
      conflicts: allResults.filter((r) => r.action === 'conflict').length,
      duration: Date.now() - startTime,
      errors,
    };
  }

  private createErrorResult(error: string): PullProcessResult {
    return {
      success: false,
      eventsProcessed: 0,
      ticketsCreated: 0,
      ticketsUpdated: 0,
      ticketsSkipped: 0,
      conflicts: 0,
      duration: 0,
      errors: [
        {
          error,
          recoverable: true,
        },
      ],
    };
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS - STATUS
  // ---------------------------------------------------------------------------

  private createInitialStatus(): PullStatus {
    return {
      isProcessing: false,
      eventsTotal: 0,
      eventsProcessed: 0,
      ticketsCreated: 0,
      ticketsUpdated: 0,
      progress: 0,
      currentPhase: 'idle',
      lastError: null,
      startedAt: null,
    };
  }

  private updateStatus(update: Partial<PullStatus>): void {
    this.status = { ...this.status, ...update };
  }

  private emitEvent(
    type: PullEvent['type'],
    trigger: PullTrigger,
    projectId: string,
    result?: PullProcessResult
  ): void {
    const event: PullEvent = {
      type,
      trigger,
      projectId,
      status: this.getStatus(),
      result,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Listener-Fehler ignorieren
      }
    }
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTION
// =============================================================================

/**
 * Erstellt einen neuen Pull Service
 */
export function createPullService(config: PullServiceConfig): PullService {
  return new PullService(config);
}

// =============================================================================
// 🔧 HELPER TYPES
// =============================================================================

/**
 * Minimal-Config für schnellen Setup
 */
export interface SimplePullServiceConfig {
  pullApi: PullApi;
  eventProcessor: EventProcessor;
  syncStateManager: SyncStateManager;
  idMapper: IdMapper;
}

/**
 * Erstellt Pull Service mit minimaler Konfiguration
 */
export function createSimplePullService(config: SimplePullServiceConfig): PullService {
  return new PullService({
    ...config,
    hasEmptyOutbox: async () => true, // Kein Push-before-Pull
  });
}
