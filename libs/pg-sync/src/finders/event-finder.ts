/**
 * 🔍 Event Finder
 *
 * Read-Only Queries für Ticket-Events.
 * Kritisch für Pull-Sync Mechanismus.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, gt, gte, desc, asc, count } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { ticketEvents, users, tickets } from '../db/schema/index.js';
import type { DbTicketEvent } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Event mit Creator-Informationen
 */
export interface EventWithCreator extends DbTicketEvent {
  creator?: typeof users.$inferSelect | null;
}

/**
 * Optionen für Event-Queries
 */
export interface FindEventsOptions {
  /** Limit (Standard: 1000 für Pull) */
  limit?: number;
  /** Event-Typ Filter */
  type?: string | string[];
  /** Sortierrichtung */
  order?: 'asc' | 'desc';
}

// =============================================================================
// 🔍 FINDER FUNCTIONS
// =============================================================================

/**
 * Findet ein Event nach ID
 */
export async function findEventById(id: string): Promise<DbTicketEvent | null> {
  const db = getDb();

  const result = await db.select().from(ticketEvents).where(eq(ticketEvents.id, id)).limit(1);

  return result[0] ?? null;
}

/**
 * Findet alle Events eines Tickets (History)
 */
export async function findEventsByTicket(
  ticketId: string,
  options: FindEventsOptions = {}
): Promise<DbTicketEvent[]> {
  const db = getDb();
  const { limit = 100, order = 'desc' } = options;

  const orderFn = order === 'asc' ? asc : desc;

  const result = await db
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(orderFn(ticketEvents.createdAt))
    .limit(limit);

  return result;
}

/**
 * Findet alle Events seit einem Timestamp (für Pull-Sync)
 *
 * @important Dies ist die Kern-Query für den Pull-Mechanismus!
 */
export async function findEventsSince(
  projectId: string,
  since: Date,
  options: FindEventsOptions = {}
): Promise<DbTicketEvent[]> {
  const db = getDb();
  const { limit = 1000, order = 'asc' } = options;

  const orderFn = order === 'asc' ? asc : desc;

  const result = await db
    .select()
    .from(ticketEvents)
    .where(and(eq(ticketEvents.projectId, projectId), gt(ticketEvents.createdAt, since)))
    .orderBy(orderFn(ticketEvents.createdAt))
    .limit(limit);

  return result;
}

/**
 * Findet alle Events nach einer bestimmten Event-ID (für inkrementellen Sync)
 */
export async function findEventsSinceId(
  projectId: string,
  lastEventId: string,
  options: FindEventsOptions = {}
): Promise<DbTicketEvent[]> {
  const db = getDb();
  const { limit = 1000 } = options;

  // Erst das Referenz-Event finden um den Timestamp zu bekommen
  const referenceEvent = await findEventById(lastEventId);

  if (!referenceEvent) {
    // Wenn Event nicht gefunden, alle Events zurückgeben (Initial-Sync)
    return db
      .select()
      .from(ticketEvents)
      .where(eq(ticketEvents.projectId, projectId))
      .orderBy(asc(ticketEvents.createdAt))
      .limit(limit);
  }

  // Events nach dem Referenz-Event
  const result = await db
    .select()
    .from(ticketEvents)
    .where(
      and(
        eq(ticketEvents.projectId, projectId),
        gt(ticketEvents.createdAt, referenceEvent.createdAt)
      )
    )
    .orderBy(asc(ticketEvents.createdAt))
    .limit(limit);

  return result;
}

/**
 * Findet das letzte Event eines Projekts
 */
export async function findLatestEvent(projectId: string): Promise<DbTicketEvent | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(ticketEvents)
    .where(eq(ticketEvents.projectId, projectId))
    .orderBy(desc(ticketEvents.createdAt))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Zählt Events seit einem Timestamp (für UI-Anzeige)
 */
export async function countEventsSince(projectId: string, since: Date): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(ticketEvents)
    .where(and(eq(ticketEvents.projectId, projectId), gt(ticketEvents.createdAt, since)));

  return result[0].count;
}

/**
 * Findet Events mit Creator-Informationen
 */
export async function findEventsWithCreator(
  ticketId: string,
  options: FindEventsOptions = {}
): Promise<EventWithCreator[]> {
  const db = getDb();
  const { limit = 100, order = 'desc' } = options;

  const orderFn = order === 'asc' ? asc : desc;

  const result = await db
    .select({
      event: ticketEvents,
      creator: users,
    })
    .from(ticketEvents)
    .leftJoin(users, eq(ticketEvents.createdBy, users.id))
    .where(eq(ticketEvents.ticketId, ticketId))
    .orderBy(orderFn(ticketEvents.createdAt))
    .limit(limit);

  return result.map((r) => ({
    ...r.event,
    creator: r.creator,
  }));
}

/**
 * Findet alle Events eines Projekts (für Admin-Dashboard)
 */
export async function findRecentProjectEvents(
  projectId: string,
  limit: number = 50
): Promise<EventWithCreator[]> {
  const db = getDb();

  const result = await db
    .select({
      event: ticketEvents,
      creator: users,
    })
    .from(ticketEvents)
    .leftJoin(users, eq(ticketEvents.createdBy, users.id))
    .where(eq(ticketEvents.projectId, projectId))
    .orderBy(desc(ticketEvents.createdAt))
    .limit(limit);

  return result.map((r) => ({
    ...r.event,
    creator: r.creator,
  }));
}
