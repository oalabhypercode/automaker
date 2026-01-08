/**
 * 🔍 Sync Finder
 *
 * Read-Only Queries für Sync-State und Outbox.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, count, lt, desc, asc } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { syncStates, outboxItems } from '../db/schema/index.js';
import type { DbSyncState, DbOutboxItem } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Outbox-Status (aus DB-Enum)
 */
export type OutboxStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Statistiken für Outbox
 */
export interface OutboxStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// =============================================================================
// 🔍 SYNC STATE FINDERS
// =============================================================================

/**
 * Findet den Sync-Status für einen Client in einem Projekt
 */
export async function findSyncState(
  clientId: string,
  projectId: string
): Promise<DbSyncState | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(syncStates)
    .where(and(eq(syncStates.clientId, clientId), eq(syncStates.projectId, projectId)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet alle Sync-States eines Clients (alle Projekte)
 */
export async function findSyncStatesByClient(clientId: string): Promise<DbSyncState[]> {
  const db = getDb();

  const result = await db.select().from(syncStates).where(eq(syncStates.clientId, clientId));

  return result;
}

/**
 * Findet alle Sync-States eines Projekts (alle Clients)
 */
export async function findSyncStatesByProject(projectId: string): Promise<DbSyncState[]> {
  const db = getDb();

  const result = await db.select().from(syncStates).where(eq(syncStates.projectId, projectId));

  return result;
}

// =============================================================================
// 🔍 OUTBOX FINDERS
// =============================================================================

/**
 * Findet alle ausstehenden Outbox-Einträge eines Clients
 */
export async function findPendingOutbox(
  clientId: string,
  limit: number = 100
): Promise<DbOutboxItem[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(outboxItems)
    .where(and(eq(outboxItems.clientId, clientId), eq(outboxItems.status, 'pending')))
    .orderBy(asc(outboxItems.createdAt))
    .limit(limit);

  return result;
}

/**
 * Zählt ausstehende Outbox-Einträge
 */
export async function countPendingOutbox(clientId: string): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(outboxItems)
    .where(and(eq(outboxItems.clientId, clientId), eq(outboxItems.status, 'pending')));

  return result[0].count;
}

/**
 * Findet fehlgeschlagene Outbox-Einträge
 */
export async function findFailedOutbox(
  clientId: string,
  limit: number = 50
): Promise<DbOutboxItem[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(outboxItems)
    .where(and(eq(outboxItems.clientId, clientId), eq(outboxItems.status, 'failed')))
    .orderBy(desc(outboxItems.createdAt))
    .limit(limit);

  return result;
}

/**
 * Findet einen Outbox-Eintrag nach ID
 */
export async function findOutboxItemById(id: string): Promise<DbOutboxItem | null> {
  const db = getDb();

  const result = await db.select().from(outboxItems).where(eq(outboxItems.id, id)).limit(1);

  return result[0] ?? null;
}

/**
 * Holt Outbox-Statistiken für einen Client
 */
export async function getOutboxStats(clientId: string): Promise<OutboxStats> {
  const db = getDb();

  const statuses: OutboxStatus[] = ['pending', 'processing', 'completed', 'failed'];

  const results = await Promise.all(
    statuses.map(async (status) => {
      const result = await db
        .select({ count: count() })
        .from(outboxItems)
        .where(and(eq(outboxItems.clientId, clientId), eq(outboxItems.status, status)));
      return { status, count: result[0].count };
    })
  );

  const stats: OutboxStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  results.forEach(({ status, count: c }) => {
    stats[status] = c;
    stats.total += c;
  });

  return stats;
}

/**
 * Findet Outbox-Einträge die für Retry bereit sind
 * (fehlgeschlagen, aber unter max retries)
 */
export async function findRetryableOutbox(
  clientId: string,
  maxRetries: number = 5,
  limit: number = 50
): Promise<DbOutboxItem[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(outboxItems)
    .where(
      and(
        eq(outboxItems.clientId, clientId),
        eq(outboxItems.status, 'failed'),
        lt(outboxItems.retries, maxRetries)
      )
    )
    .orderBy(asc(outboxItems.createdAt))
    .limit(limit);

  return result;
}

/**
 * Findet alte verarbeitete Outbox-Einträge (für Cleanup)
 */
export async function findOldProcessedOutbox(
  olderThan: Date,
  limit: number = 1000
): Promise<DbOutboxItem[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(outboxItems)
    .where(and(eq(outboxItems.status, 'completed'), lt(outboxItems.processedAt, olderThan)))
    .limit(limit);

  return result;
}
