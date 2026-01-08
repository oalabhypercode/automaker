/**
 * 📦 Outbox Manager
 *
 * Verwaltet die lokale Outbox für den Push-Service.
 * Abstraktion über die DB-Actions für einfachere Nutzung.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 */

// Nutze native crypto API statt uuid
import { randomUUID } from 'crypto';
import {
  addToOutbox,
  addBatchToOutbox,
  markOutboxProcessed,
  markOutboxFailed,
  retryOutboxItem,
  claimOutboxItem,
  clearProcessedOutbox,
} from '../actions/sync-actions.js';
import {
  findPendingOutbox,
  findFailedOutbox,
  findRetryableOutbox,
  getOutboxStats,
  countPendingOutbox,
} from '../finders/sync-finder.js';
import type { DbOutboxItem } from '../db/schema/index.js';
import type {
  PushEventType,
  SyncEntityType,
  OutboxPayload,
  LocalOutboxItem,
  PushConfig,
  DEFAULT_PUSH_CONFIG,
} from './types.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Daten für neuen Outbox-Eintrag
 */
export interface CreateOutboxEntry {
  eventType: PushEventType;
  entityType: SyncEntityType;
  entityId: string;
  localId: string;
  projectId: string;
  payload: OutboxPayload;
}

/**
 * Outbox-Manager Konfiguration
 */
export interface OutboxManagerConfig {
  clientId: string;
  maxRetries: number;
  cleanupAfterDays: number;
}

// =============================================================================
// 📦 OUTBOX MANAGER CLASS
// =============================================================================

/**
 * OutboxManager - Zentrale Steuerung der Outbox
 *
 * Verantwortlich für:
 * - Erstellen neuer Outbox-Einträge
 * - Abrufen von pending/failed Items
 * - Status-Updates
 * - Cleanup alter Einträge
 */
export class OutboxManager {
  private readonly clientId: string;
  private readonly maxRetries: number;
  private readonly cleanupAfterDays: number;

  constructor(config: OutboxManagerConfig) {
    this.clientId = config.clientId;
    this.maxRetries = config.maxRetries;
    this.cleanupAfterDays = config.cleanupAfterDays;
  }

  // ===========================================================================
  // 📝 CREATE
  // ===========================================================================

  /**
   * Fügt einen neuen Eintrag zur Outbox hinzu
   */
  async add(entry: CreateOutboxEntry): Promise<DbOutboxItem> {
    // OutboxPayloadJson Format: { data, localId?, metadata? }
    const outboxPayload = {
      data: {
        ...entry.payload,
        projectId: entry.projectId,
      },
      localId: entry.localId,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    return addToOutbox({
      clientId: this.clientId,
      eventType: entry.eventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: outboxPayload,
    });
  }

  /**
   * Fügt mehrere Einträge auf einmal hinzu (Batch)
   */
  async addBatch(entries: CreateOutboxEntry[]): Promise<DbOutboxItem[]> {
    if (entries.length === 0) return [];

    // OutboxPayloadJson Format: { data, localId?, metadata? }
    const items = entries.map((entry) => ({
      clientId: this.clientId,
      eventType: entry.eventType,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: {
        data: {
          ...entry.payload,
          projectId: entry.projectId,
        },
        localId: entry.localId,
        metadata: {
          timestamp: new Date().toISOString(),
        },
      },
    }));

    return addBatchToOutbox(items);
  }

  // ===========================================================================
  // 🔍 READ
  // ===========================================================================

  /**
   * Holt alle ausstehenden Einträge
   */
  async getPending(limit: number = 100): Promise<DbOutboxItem[]> {
    return findPendingOutbox(this.clientId, limit);
  }

  /**
   * Zählt ausstehende Einträge
   */
  async getPendingCount(): Promise<number> {
    return countPendingOutbox(this.clientId);
  }

  /**
   * Holt alle fehlgeschlagenen Einträge
   */
  async getFailed(limit: number = 50): Promise<DbOutboxItem[]> {
    return findFailedOutbox(this.clientId, limit);
  }

  /**
   * Holt Einträge die für Retry bereit sind
   */
  async getRetryable(limit: number = 50): Promise<DbOutboxItem[]> {
    return findRetryableOutbox(this.clientId, this.maxRetries, limit);
  }

  /**
   * Holt Statistiken
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total: number;
  }> {
    return getOutboxStats(this.clientId);
  }

  /**
   * Prüft ob Einträge ausstehen
   */
  async hasPending(): Promise<boolean> {
    const count = await this.getPendingCount();
    return count > 0;
  }

  // ===========================================================================
  // ✏️ UPDATE
  // ===========================================================================

  /**
   * Markiert einen Eintrag als "wird verarbeitet"
   * Gibt null zurück wenn bereits von anderem Worker bearbeitet
   */
  async claim(id: string): Promise<DbOutboxItem | null> {
    return claimOutboxItem(id);
  }

  /**
   * Markiert einen Eintrag als erfolgreich verarbeitet
   */
  async markCompleted(id: string): Promise<void> {
    await markOutboxProcessed(id);
  }

  /**
   * Markiert einen Eintrag als fehlgeschlagen
   */
  async markFailed(id: string, error: string): Promise<void> {
    await markOutboxFailed(id, error);
  }

  /**
   * Erhöht Retry-Counter und setzt Status zurück auf pending
   */
  async retry(id: string): Promise<DbOutboxItem> {
    return retryOutboxItem(id);
  }

  /**
   * Prüft ob ein Eintrag erneut versucht werden soll
   */
  shouldRetry(item: DbOutboxItem): boolean {
    return item.retries < this.maxRetries;
  }

  /**
   * Berechnet die Wartezeit bis zum nächsten Retry (Exponential Backoff)
   */
  getRetryDelay(retryCount: number, intervals: number[]): number {
    if (retryCount >= intervals.length) {
      return intervals[intervals.length - 1] ?? 3600_000;
    }
    return intervals[retryCount] ?? 60_000;
  }

  // ===========================================================================
  // 🗑️ CLEANUP
  // ===========================================================================

  /**
   * Löscht alte verarbeitete Einträge
   */
  async cleanup(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.cleanupAfterDays);

    return clearProcessedOutbox(this.clientId, cutoffDate);
  }
}

// =============================================================================
// 🏭 FACTORY
// =============================================================================

/**
 * Erstellt einen neuen OutboxManager
 */
export function createOutboxManager(
  clientId: string,
  options?: Partial<OutboxManagerConfig>
): OutboxManager {
  return new OutboxManager({
    clientId,
    maxRetries: options?.maxRetries ?? 5,
    cleanupAfterDays: options?.cleanupAfterDays ?? 7,
  });
}

/**
 * Generiert eine neue eindeutige Event-ID
 */
export function generateEventId(): string {
  return `evt_${randomUUID()}`;
}
