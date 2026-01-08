/**
 * ⚡ Event Actions
 *
 * Mutations für Ticket-Events (INSERT).
 * Events werden normalerweise automatisch von Ticket-Actions erstellt.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { getDb } from '../db/client.js';
import { ticketEvents } from '../db/schema/index.js';
import type { DbTicketEvent, DbNewTicketEvent, EventPayloadJson } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Event-Typ
 */
export type EventType =
  | 'created'
  | 'updated'
  | 'status_changed'
  | 'claimed'
  | 'unclaimed'
  | 'completed'
  | 'comment_added'
  | 'label_added'
  | 'label_removed';

/**
 * Daten für Event-Erstellung
 */
export interface CreateEventData {
  ticketId: string;
  projectId: string;
  type: EventType;
  payload?: EventPayloadJson;
  createdBy?: string;
}

// =============================================================================
// ⚡ ACTION FUNCTIONS
// =============================================================================

/**
 * Erstellt ein einzelnes Event
 *
 * @note Normalerweise werden Events automatisch von Ticket-Actions erstellt.
 * Diese Funktion ist für Spezialfälle (z.B. Kommentare, externe Events).
 */
export async function createEvent(data: CreateEventData): Promise<DbTicketEvent> {
  const db = getDb();

  const eventData: DbNewTicketEvent = {
    ticketId: data.ticketId,
    projectId: data.projectId,
    type: data.type,
    payload: data.payload ?? {},
    createdBy: data.createdBy,
  };

  const [event] = await db.insert(ticketEvents).values(eventData).returning();

  return event;
}

/**
 * Erstellt mehrere Events in einem Batch (für Sync)
 */
export async function createBulkEvents(events: CreateEventData[]): Promise<DbTicketEvent[]> {
  if (events.length === 0) return [];

  const db = getDb();

  const eventDataList: DbNewTicketEvent[] = events.map((e) => ({
    ticketId: e.ticketId,
    projectId: e.projectId,
    type: e.type,
    payload: e.payload ?? {},
    createdBy: e.createdBy,
  }));

  const createdEvents = await db.insert(ticketEvents).values(eventDataList).returning();

  return createdEvents;
}

/**
 * Erstellt ein Kommentar-Event
 */
export async function createCommentEvent(
  ticketId: string,
  projectId: string,
  comment: string,
  userId?: string
): Promise<DbTicketEvent> {
  return createEvent({
    ticketId,
    projectId,
    type: 'comment_added',
    payload: { comment },
    createdBy: userId,
  });
}
