/**
 * ⚡ Sync Actions
 *
 * Mutations für SyncState und Outbox.
 * Wichtig für Push/Pull Sync-Mechanismus.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, lt } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { syncStates, outboxItems } from '../db/schema/index.js';
import type {
  DbSyncState,
  DbNewSyncState,
  DbOutboxItem,
  DbNewOutboxItem,
  OutboxPayloadJson,
} from '../db/schema/index.js';
import { NotFoundError } from '../errors/index.js';
import { findSyncState, findOutboxItemById } from '../finders/sync-finder.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Outbox-Status
 */
export type OutboxStatusType = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Daten für Outbox-Eintrag
 */
export interface CreateOutboxData {
  clientId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  payload: OutboxPayloadJson;
}

// =============================================================================
// ⚡ SYNC STATE ACTIONS
// =============================================================================

/**
 * Erstellt oder aktualisiert einen SyncState (Upsert)
 */
export async function upsertSyncState(
  clientId: string,
  projectId: string,
  userId?: string
): Promise<DbSyncState> {
  const db = getDb();

  const existing = await findSyncState(clientId, projectId);

  if (existing) {
    // Update existierenden State
    const [updated] = await db
      .update(syncStates)
      .set({ userId })
      .where(and(eq(syncStates.clientId, clientId), eq(syncStates.projectId, projectId)))
      .returning();
    return updated;
  }

  // Neuen State erstellen
  const newState: DbNewSyncState = {
    clientId,
    projectId,
    userId,
  };

  const [created] = await db.insert(syncStates).values(newState).returning();

  return created;
}

/**
 * Aktualisiert den lastPulledAt Timestamp
 */
export async function updateLastPulled(
  clientId: string,
  projectId: string,
  timestamp: Date,
  lastEventId?: string
): Promise<void> {
  const db = getDb();

  // Sicherstellen dass State existiert
  const existing = await findSyncState(clientId, projectId);
  if (!existing) {
    await upsertSyncState(clientId, projectId);
  }

  await db
    .update(syncStates)
    .set({
      lastPulledAt: timestamp,
      ...(lastEventId && { lastEventId }),
    })
    .where(and(eq(syncStates.clientId, clientId), eq(syncStates.projectId, projectId)));
}

/**
 * Aktualisiert den lastPushedAt Timestamp
 */
export async function updateLastPushed(
  clientId: string,
  projectId: string,
  timestamp: Date
): Promise<void> {
  const db = getDb();

  // Sicherstellen dass State existiert
  const existing = await findSyncState(clientId, projectId);
  if (!existing) {
    await upsertSyncState(clientId, projectId);
  }

  await db
    .update(syncStates)
    .set({ lastPushedAt: timestamp })
    .where(and(eq(syncStates.clientId, clientId), eq(syncStates.projectId, projectId)));
}

// =============================================================================
// ⚡ OUTBOX ACTIONS
// =============================================================================

/**
 * Fügt einen neuen Eintrag zur Outbox hinzu
 */
export async function addToOutbox(data: CreateOutboxData): Promise<DbOutboxItem> {
  const db = getDb();

  const outboxData: DbNewOutboxItem = {
    clientId: data.clientId,
    eventType: data.eventType,
    entityType: data.entityType,
    entityId: data.entityId,
    payload: data.payload,
    status: 'pending',
    retries: 0,
  };

  const [item] = await db.insert(outboxItems).values(outboxData).returning();

  return item;
}

/**
 * Markiert einen Outbox-Eintrag als verarbeitet
 */
export async function markOutboxProcessed(id: string): Promise<void> {
  const db = getDb();

  await db
    .update(outboxItems)
    .set({
      status: 'completed',
      processedAt: new Date(),
    })
    .where(eq(outboxItems.id, id));
}

/**
 * Markiert einen Outbox-Eintrag als fehlgeschlagen
 */
export async function markOutboxFailed(id: string, errorMessage: string): Promise<void> {
  const db = getDb();

  await db
    .update(outboxItems)
    .set({
      status: 'failed',
      errorMessage,
    })
    .where(eq(outboxItems.id, id));
}

/**
 * Erhöht den Retry-Counter und setzt Status auf pending
 */
export async function retryOutboxItem(id: string): Promise<DbOutboxItem> {
  const db = getDb();

  const existing = await findOutboxItemById(id);
  if (!existing) {
    throw new NotFoundError('syncState', id);
  }

  const [item] = await db
    .update(outboxItems)
    .set({
      status: 'pending',
      retries: existing.retries + 1,
      errorMessage: null,
    })
    .where(eq(outboxItems.id, id))
    .returning();

  return item;
}

/**
 * Setzt Status auf "processing" (für Worker)
 */
export async function claimOutboxItem(id: string): Promise<DbOutboxItem | null> {
  const db = getDb();

  // Atomic claim: Nur wenn noch pending
  const [item] = await db
    .update(outboxItems)
    .set({ status: 'processing' })
    .where(and(eq(outboxItems.id, id), eq(outboxItems.status, 'pending')))
    .returning();

  return item ?? null;
}

/**
 * Löscht verarbeitete Outbox-Einträge (Cleanup)
 */
export async function clearProcessedOutbox(clientId: string, olderThan: Date): Promise<number> {
  const db = getDb();

  const result = await db
    .delete(outboxItems)
    .where(
      and(
        eq(outboxItems.clientId, clientId),
        eq(outboxItems.status, 'completed'),
        lt(outboxItems.processedAt, olderThan)
      )
    )
    .returning();

  return result.length;
}

/**
 * Erstellt mehrere Outbox-Einträge in einem Batch
 */
export async function addBatchToOutbox(items: CreateOutboxData[]): Promise<DbOutboxItem[]> {
  if (items.length === 0) return [];

  const db = getDb();

  const outboxDataList: DbNewOutboxItem[] = items.map((data) => ({
    clientId: data.clientId,
    eventType: data.eventType,
    entityType: data.entityType,
    entityId: data.entityId,
    payload: data.payload,
    status: 'pending' as const,
    retries: 0,
  }));

  const created = await db.insert(outboxItems).values(outboxDataList).returning();

  return created;
}
