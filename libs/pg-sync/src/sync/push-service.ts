/**
 * ⬆️ Push Service
 *
 * Haupt-Service für das Pushen von Events zur Postgres-DB.
 * Verarbeitet Outbox-Einträge, handled Konflikte und Retries.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 */

import type { DbOutboxItem } from '../db/schema/index.js';
import type {
  PushConfig,
  PushStatus,
  PushProcessResult,
  PushProcessError,
  PushRequestPayload,
  PushResponsePayload,
  PushConflict,
  ConflictResolutionStrategy,
} from './types.js';
import { DEFAULT_PUSH_CONFIG } from './types.js';
import type { OutboxManager } from './outbox-manager.js';
import type { ConflictResolver, ConflictResolution } from './conflict-resolver.js';
import { createConflictResolver } from './conflict-resolver.js';
import type { PushApi } from './push-api.js';
import {
  createPushApi,
  outboxItemsToPushEvents,
  groupOutboxByProject,
  PushApiError,
} from './push-api.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Push-Service Konfiguration
 */
export interface PushServiceConfig {
  clientId: string;
  pushConfig?: Partial<PushConfig>;
  conflictStrategy?: ConflictResolutionStrategy;
  apiBaseUrl?: string;
  authToken?: string;
}

/**
 * Push-Service Events
 */
export type PushServiceEvent =
  | { type: 'push:started'; batchCount: number }
  | { type: 'push:progress'; current: number; total: number }
  | { type: 'push:item:success'; itemId: string }
  | { type: 'push:item:failed'; itemId: string; error: string }
  | { type: 'push:item:conflict'; itemId: string; conflict: PushConflict }
  | { type: 'push:complete'; result: PushProcessResult }
  | { type: 'push:error'; error: string };

/**
 * Event-Callback Typ
 */
export type PushEventCallback = (event: PushServiceEvent) => void;

// =============================================================================
// ⬆️ PUSH SERVICE CLASS
// =============================================================================

/**
 * PushService - Verarbeitet die Outbox und pusht Events zum Server
 */
export class PushService {
  private readonly clientId: string;
  private readonly config: PushConfig;
  private readonly outboxManager: OutboxManager;
  private readonly conflictResolver: ConflictResolver;
  private readonly api: PushApi;

  private isProcessing: boolean = false;
  private lastPushAt: Date | null = null;
  private lastError: string | null = null;
  private eventCallbacks: Set<PushEventCallback> = new Set();

  // Debounce Timer
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(outboxManager: OutboxManager, config: PushServiceConfig) {
    this.clientId = config.clientId;
    this.outboxManager = outboxManager;

    // Config mergen
    this.config = {
      ...DEFAULT_PUSH_CONFIG,
      ...config.pushConfig,
    };

    // API erstellen
    this.api = createPushApi({
      baseUrl: config.apiBaseUrl ?? this.config.apiBaseUrl,
      authToken: config.authToken,
    });

    // Conflict Resolver erstellen
    this.conflictResolver = createConflictResolver(
      config.conflictStrategy ?? this.config.conflictStrategy
    );
  }

  // ===========================================================================
  // 📊 STATUS
  // ===========================================================================

  /**
   * Holt den aktuellen Status des Push-Service
   */
  async getStatus(): Promise<PushStatus> {
    const stats = await this.outboxManager.getStats();

    return {
      isProcessing: this.isProcessing,
      pending: stats.pending,
      failed: stats.failed,
      lastPushAt: this.lastPushAt,
      lastError: this.lastError,
      currentBatch: 0,
      totalBatches: 0,
    };
  }

  /**
   * Prüft ob Items zum Pushen vorhanden sind
   */
  async hasPendingItems(): Promise<boolean> {
    return this.outboxManager.hasPending();
  }

  // ===========================================================================
  // 🔄 PROCESSING
  // ===========================================================================

  /**
   * Startet die Verarbeitung der Outbox
   *
   * @returns Ergebnis der Verarbeitung
   */
  async processOutbox(): Promise<PushProcessResult> {
    if (this.isProcessing) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        conflicts: 0,
        skipped: 0,
        errors: [],
      };
    }

    this.isProcessing = true;
    this.lastError = null;

    const result: PushProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Pending Items holen
      const pendingItems = await this.outboxManager.getPending(this.config.batchSize);

      if (pendingItems.length === 0) {
        this.isProcessing = false;
        return result;
      }

      // Nach Projekt gruppieren
      const grouped = groupOutboxByProject(pendingItems);
      const totalBatches = grouped.size;

      this.emit({ type: 'push:started', batchCount: totalBatches });

      let currentBatch = 0;

      // Pro Projekt verarbeiten
      for (const [projectId, items] of grouped) {
        currentBatch++;
        this.emit({ type: 'push:progress', current: currentBatch, total: totalBatches });

        const batchResult = await this.processBatch(projectId, items);

        // Ergebnisse aggregieren
        result.processed += batchResult.processed;
        result.succeeded += batchResult.succeeded;
        result.failed += batchResult.failed;
        result.conflicts += batchResult.conflicts;
        result.skipped += batchResult.skipped;
        result.errors.push(...batchResult.errors);
      }

      this.lastPushAt = new Date();
      this.emit({ type: 'push:complete', result });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.lastError = errorMessage;
      this.emit({ type: 'push:error', error: errorMessage });

      return result;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Verarbeitet einen Batch von Items für ein Projekt
   */
  private async processBatch(projectId: string, items: DbOutboxItem[]): Promise<PushProcessResult> {
    const result: PushProcessResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      conflicts: 0,
      skipped: 0,
      errors: [],
    };

    // Batch-Push Request erstellen
    const payload: PushRequestPayload = {
      clientId: this.clientId,
      projectId,
      events: outboxItemsToPushEvents(items),
    };

    try {
      // Items als "processing" markieren
      for (const item of items) {
        await this.outboxManager.claim(item.id);
      }

      // Batch pushen
      const response = await this.api.pushEvents(payload);

      // Ergebnisse verarbeiten
      await this.processResponse(items, response, result);
    } catch (error) {
      // Bei Netzwerkfehler: Items für Retry vorbereiten
      await this.handleBatchError(items, error, result);
    }

    result.processed = items.length;
    return result;
  }

  /**
   * Verarbeitet die Server-Response
   */
  private async processResponse(
    items: DbOutboxItem[],
    response: PushResponsePayload,
    result: PushProcessResult
  ): Promise<void> {
    // Item-Map für schnellen Zugriff
    const itemMap = new Map(items.map((item) => [item.id, item]));

    // Erfolgreiche Items verarbeiten
    for (const pushResult of response.results) {
      const item = itemMap.get(pushResult.eventId);

      if (!item) continue;

      switch (pushResult.status) {
        case 'created':
        case 'updated':
          await this.outboxManager.markCompleted(item.id);
          result.succeeded++;
          this.emit({ type: 'push:item:success', itemId: item.id });
          break;

        case 'skipped':
          await this.outboxManager.markCompleted(item.id);
          result.skipped++;
          break;

        case 'failed':
          await this.handleItemError(item, pushResult.error ?? 'Unknown error', result);
          break;
      }
    }

    // Konflikte verarbeiten
    for (const conflict of response.conflicts) {
      const item = itemMap.get(conflict.eventId);

      if (!item) continue;

      await this.handleConflict(item, conflict, result);
    }
  }

  /**
   * Behandelt einen Konflikt
   */
  private async handleConflict(
    item: DbOutboxItem,
    conflict: PushConflict,
    result: PushProcessResult
  ): Promise<void> {
    this.emit({ type: 'push:item:conflict', itemId: item.id, conflict });

    const resolution = this.conflictResolver.resolve(conflict);
    result.conflicts++;

    switch (resolution.action) {
      case 'use_local':
        // Force-Update versuchen (wird beim nächsten Push mit force=true gepusht)
        if (this.outboxManager.shouldRetry(item)) {
          await this.outboxManager.retry(item.id);
        } else {
          await this.outboxManager.markFailed(item.id, resolution.message);
        }
        break;

      case 'use_remote':
      case 'skip':
        // Lokale Änderung verwerfen
        await this.outboxManager.markCompleted(item.id);
        result.skipped++;
        break;

      case 'ask_user':
        // Für manuelle Auflösung vormerken
        this.conflictResolver.registerPendingConflict(
          conflict,
          item.payload,
          null // Remote-Daten müssten separat geholt werden
        );
        await this.outboxManager.markFailed(item.id, 'Awaiting manual resolution');
        break;
    }
  }

  /**
   * Behandelt einen Fehler bei einem einzelnen Item
   */
  private async handleItemError(
    item: DbOutboxItem,
    error: string,
    result: PushProcessResult
  ): Promise<void> {
    this.emit({ type: 'push:item:failed', itemId: item.id, error });

    if (this.outboxManager.shouldRetry(item)) {
      await this.outboxManager.retry(item.id);
    } else {
      await this.outboxManager.markFailed(item.id, error);
      result.failed++;
      const payload = item.payload as unknown as Record<string, unknown>;
      result.errors.push({
        eventId: item.id,
        localId: (payload?.localId as string) ?? item.entityId,
        error,
        retryable: false,
      });
    }
  }

  /**
   * Behandelt Fehler bei einem ganzen Batch
   */
  private async handleBatchError(
    items: DbOutboxItem[],
    error: unknown,
    result: PushProcessResult
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isRetryable = error instanceof PushApiError ? error.isRetryable() : true;

    for (const item of items) {
      if (isRetryable && this.outboxManager.shouldRetry(item)) {
        await this.outboxManager.retry(item.id);
      } else {
        await this.outboxManager.markFailed(item.id, errorMessage);
        result.failed++;
        const payload = item.payload as unknown as Record<string, unknown>;
        result.errors.push({
          eventId: item.id,
          localId: (payload?.localId as string) ?? item.entityId,
          error: errorMessage,
          retryable: isRetryable,
        });
      }

      this.emit({ type: 'push:item:failed', itemId: item.id, error: errorMessage });
    }
  }

  // ===========================================================================
  // ⏱️ DEBOUNCED PUSH
  // ===========================================================================

  /**
   * Startet einen debounced Push
   *
   * Bündelt schnelle aufeinanderfolgende Änderungen.
   */
  schedulePush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.processOutbox();
    }, this.config.debounceMs);
  }

  /**
   * Bricht scheduled Push ab
   */
  cancelScheduledPush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  // ===========================================================================
  // 🔄 RETRY
  // ===========================================================================

  /**
   * Versucht fehlgeschlagene Items erneut
   */
  async retryFailed(): Promise<PushProcessResult> {
    const retryable = await this.outboxManager.getRetryable();

    if (retryable.length === 0) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        conflicts: 0,
        skipped: 0,
        errors: [],
      };
    }

    // Items für Retry vorbereiten
    for (const item of retryable) {
      await this.outboxManager.retry(item.id);
    }

    // Normale Verarbeitung starten
    return this.processOutbox();
  }

  // ===========================================================================
  // 📣 EVENTS
  // ===========================================================================

  /**
   * Registriert einen Event-Callback
   */
  on(callback: PushEventCallback): () => void {
    this.eventCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventCallbacks.delete(callback);
    };
  }

  /**
   * Entfernt alle Event-Callbacks
   */
  removeAllListeners(): void {
    this.eventCallbacks.clear();
  }

  /**
   * Emittiert ein Event
   */
  private emit(event: PushServiceEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch {
        // Ignore callback errors
      }
    }
  }

  // ===========================================================================
  // 🗑️ CLEANUP
  // ===========================================================================

  /**
   * Räumt alte verarbeitete Items auf
   */
  async cleanup(): Promise<number> {
    return this.outboxManager.cleanup();
  }

  /**
   * Gibt Ressourcen frei
   */
  dispose(): void {
    this.cancelScheduledPush();
    this.removeAllListeners();
  }
}

// =============================================================================
// 🏭 FACTORY
// =============================================================================

/**
 * Erstellt einen neuen PushService
 */
export function createPushService(
  outboxManager: OutboxManager,
  config: PushServiceConfig
): PushService {
  return new PushService(outboxManager, config);
}
