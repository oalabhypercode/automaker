/**
 * ⚡ Ticket Actions
 *
 * Mutations für Tickets (INSERT, UPDATE, DELETE).
 * Enthält wichtige Patterns: Optimistic Locking & Event-Generierung.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, sql, inArray, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { tickets, ticketEvents } from '../db/schema/index.js';
import type {
  DbTicket,
  DbNewTicket,
  DbTicketEvent,
  DbNewTicketEvent,
  EventPayloadJson,
} from '../db/schema/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/index.js';
import { findTicketById } from '../finders/ticket-finder.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Ticket-Status
 */
export type TicketStatusType = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';

/**
 * Ticket-Priorität
 */
export type TicketPriorityType = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Event-Typ
 */
export type EventTypeType =
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
 * Daten für Ticket-Erstellung
 */
export interface CreateTicketData {
  projectId: string;
  title: string;
  description?: string;
  status?: TicketStatusType;
  priority?: TicketPriorityType;
  labels?: string[];
  createdBy?: string;
  localId?: string;
}

/**
 * Daten für Ticket-Update
 */
export interface UpdateTicketData {
  title?: string;
  description?: string;
  priority?: TicketPriorityType;
  labels?: string[];
}

/**
 * Gültige Status-Übergänge
 */
const VALID_TRANSITIONS: Record<TicketStatusType, TicketStatusType[]> = {
  backlog: ['todo', 'archived'],
  todo: ['backlog', 'in_progress', 'archived'],
  in_progress: ['todo', 'review', 'done', 'archived'],
  review: ['in_progress', 'done', 'archived'],
  done: ['in_progress', 'archived'],
  archived: ['backlog', 'todo'],
};

// =============================================================================
// ⚡ HELPER FUNCTIONS
// =============================================================================

/**
 * Erstellt ein Ticket-Event
 */
async function createEvent(
  db: ReturnType<typeof getDb>,
  data: {
    ticketId: string;
    projectId: string;
    type: EventTypeType;
    payload: EventPayloadJson;
    createdBy?: string;
  }
): Promise<DbTicketEvent> {
  const eventData: DbNewTicketEvent = {
    ticketId: data.ticketId,
    projectId: data.projectId,
    type: data.type,
    payload: data.payload,
    createdBy: data.createdBy,
  };

  const [event] = await db.insert(ticketEvents).values(eventData).returning();

  return event;
}

/**
 * Prüft ob Status-Übergang gültig ist
 */
function isValidTransition(from: TicketStatusType, to: TicketStatusType): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

// =============================================================================
// ⚡ ACTION FUNCTIONS
// =============================================================================

/**
 * Erstellt ein neues Ticket
 */
export async function createTicket(data: CreateTicketData, userId?: string): Promise<DbTicket> {
  const db = getDb();

  const insertData: DbNewTicket = {
    projectId: data.projectId,
    title: data.title.trim(),
    description: data.description?.trim(),
    status: data.status ?? 'backlog',
    priority: data.priority ?? 'medium',
    labels: data.labels ?? [],
    createdBy: data.createdBy ?? userId,
    localId: data.localId,
  };

  const [ticket] = await db.insert(tickets).values(insertData).returning();

  // Event erstellen
  await createEvent(db, {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    type: 'created',
    payload: {
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
    },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Aktualisiert ein Ticket mit Optimistic Locking
 *
 * @throws NotFoundError - Wenn Ticket nicht gefunden
 * @throws ConflictError - Wenn Version nicht übereinstimmt
 */
export async function updateTicket(
  id: string,
  data: UpdateTicketData,
  expectedVersion: number,
  userId?: string
): Promise<DbTicket> {
  const db = getDb();

  // Update mit Version-Check
  const [updated] = await db
    .update(tickets)
    .set({
      ...(data.title !== undefined && { title: data.title.trim() }),
      ...(data.description !== undefined && { description: data.description?.trim() }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(data.labels !== undefined && { labels: data.labels }),
      version: sql`${tickets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(and(eq(tickets.id, id), eq(tickets.version, expectedVersion)))
    .returning();

  if (!updated) {
    // War es ein Versions-Konflikt oder nicht gefunden?
    const existing = await findTicketById(id);
    if (!existing) {
      throw new NotFoundError('ticket', id);
    }
    throw ConflictError.versionConflict('Ticket', id, expectedVersion);
  }

  // Event erstellen
  const changes: Record<string, { from: unknown; to: unknown }> = {};

  // Änderungen tracken (vereinfacht)
  if (data.title !== undefined) changes.title = { from: '...', to: data.title };
  if (data.description !== undefined) changes.description = { from: '...', to: data.description };
  if (data.priority !== undefined) changes.priority = { from: '...', to: data.priority };
  if (data.labels !== undefined) changes.labels = { from: '...', to: data.labels };

  await createEvent(db, {
    ticketId: id,
    projectId: updated.projectId,
    type: 'updated',
    payload: { changes },
    createdBy: userId,
  });

  return updated;
}

/**
 * Soft-Delete eines Tickets
 *
 * @throws NotFoundError - Wenn Ticket nicht gefunden
 */
export async function deleteTicket(id: string, userId?: string): Promise<void> {
  const db = getDb();

  const existing = await findTicketById(id);
  if (!existing) {
    throw new NotFoundError('ticket', id);
  }

  await db
    .update(tickets)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, id));
}

/**
 * Ergebnis eines Batch-Delete Vorgangs
 */
export interface BatchDeleteResult {
  /** Anzahl erfolgreich gelöschter Tickets */
  deletedCount: number;
  /** IDs die nicht gefunden wurden */
  notFoundIds: string[];
  /** IDs bei denen ein Fehler auftrat */
  failedIds: string[];
}

/**
 * Soft-Delete mehrerer Tickets (Batch-Operation)
 *
 * Löscht mehrere Tickets in einem Vorgang. Tickets die nicht gefunden
 * werden, werden in `notFoundIds` zurückgegeben. Die Operation ist
 * "best effort" - wenn ein Ticket fehlschlägt, werden die anderen
 * trotzdem verarbeitet.
 *
 * @param ids - Array von Ticket-IDs die gelöscht werden sollen
 * @param userId - Optional: User-ID für Audit-Trail
 * @returns BatchDeleteResult mit Statistiken
 */
export async function deleteMultipleTickets(
  ids: string[],
  userId?: string
): Promise<BatchDeleteResult> {
  const db = getDb();
  const now = new Date();

  const result: BatchDeleteResult = {
    deletedCount: 0,
    notFoundIds: [],
    failedIds: [],
  };

  // Leeres Array? Schnell zurück
  if (ids.length === 0) {
    return result;
  }

  try {
    // Ein einziger Update für alle gültigen IDs
    // Nutze inArray für effiziente Batch-Operation
    const updateResult = await db
      .update(tickets)
      .set({
        deletedAt: now,
        updatedAt: now,
      })
      .where(and(inArray(tickets.id, ids), isNull(tickets.deletedAt)))
      .returning({ id: tickets.id });

    // Zähle erfolgreiche Deletes
    result.deletedCount = updateResult.length;

    // Finde nicht gefundene IDs
    const deletedIds = new Set(updateResult.map((r) => r.id));
    for (const id of ids) {
      if (!deletedIds.has(id)) {
        result.notFoundIds.push(id);
      }
    }
  } catch (error) {
    // Bei einem Fehler: Alle IDs als fehlgeschlagen markieren
    console.error('Error in batch delete:', error);
    result.failedIds = [...ids];
  }

  return result;
}

/**
 * Claimed ein Ticket (setzt "In Bearbeitung")
 *
 * Verwendet Optimistic Locking mit Version-Check im WHERE-Clause.
 * Verhindert Race Conditions wenn zwei User gleichzeitig claimen.
 *
 * @throws NotFoundError - Wenn Ticket nicht gefunden
 * @throws ConflictError - Wenn Ticket bereits geclaimed oder Version-Konflikt
 */
export async function claimTicket(ticketId: string, userId: string): Promise<DbTicket> {
  const db = getDb();

  // 1. Ticket holen & Validierung
  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  // 2. Prüfen ob bereits geclaimed (von jemand anderem)
  if (existing.claimedBy && existing.claimedBy !== userId) {
    throw ConflictError.alreadyClaimed(ticketId, existing.claimedBy);
  }

  // 3. Bereits vom selben User geclaimed? Return existing
  if (existing.claimedBy === userId) {
    return existing;
  }

  const now = new Date();
  const previousStatus = existing.status;
  const expectedVersion = existing.version;

  // 4. Update mit Version-Check (Optimistic Locking)
  // WHERE prüft sowohl id als auch version - wenn jemand schneller war, schlägt es fehl
  const [ticket] = await db
    .update(tickets)
    .set({
      claimedBy: userId,
      claimedAt: now,
      status: 'in_progress',
      version: sql`${tickets.version} + 1`,
      updatedAt: now,
    })
    .where(and(eq(tickets.id, ticketId), eq(tickets.version, expectedVersion)))
    .returning();

  // 5. Wenn Update fehlschlug → Version-Konflikt (jemand war schneller)
  if (!ticket) {
    // Nochmal prüfen was passiert ist
    const reloadedTicket = await findTicketById(ticketId);
    if (reloadedTicket?.claimedBy && reloadedTicket.claimedBy !== userId) {
      throw ConflictError.alreadyClaimed(ticketId, reloadedTicket.claimedBy);
    }
    throw ConflictError.versionConflict('Ticket', ticketId, expectedVersion);
  }

  // 6. Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'claimed',
    payload: { previousStatus },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Gibt ein geclaimtes Ticket frei
 *
 * @throws NotFoundError - Wenn Ticket nicht gefunden
 */
export async function unclaimTicket(ticketId: string, userId?: string): Promise<DbTicket> {
  const db = getDb();

  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  const previousClaimedBy = existing.claimedBy;

  const [ticket] = await db
    .update(tickets)
    .set({
      claimedBy: null,
      claimedAt: null,
      status: 'todo',
      version: sql`${tickets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'unclaimed',
    payload: { previousClaimedBy: previousClaimedBy ?? undefined },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Ändert den Status eines Tickets
 *
 * @throws NotFoundError - Wenn Ticket nicht gefunden
 * @throws ValidationError - Wenn Status-Übergang ungültig
 */
export async function changeTicketStatus(
  ticketId: string,
  newStatus: TicketStatusType,
  userId?: string
): Promise<DbTicket> {
  const db = getDb();

  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  const fromStatus = existing.status as TicketStatusType;

  // Status-Übergang validieren
  if (!isValidTransition(fromStatus, newStatus)) {
    throw ValidationError.invalidStatusTransition(
      fromStatus,
      newStatus,
      VALID_TRANSITIONS[fromStatus]
    );
  }

  const [ticket] = await db
    .update(tickets)
    .set({
      status: newStatus,
      version: sql`${tickets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'status_changed',
    payload: { previousStatus: fromStatus, newStatus },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Markiert ein Ticket als abgeschlossen
 */
export async function completeTicket(ticketId: string, userId?: string): Promise<DbTicket> {
  const db = getDb();

  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  const now = new Date();
  const previousStatus = existing.status;

  const [ticket] = await db
    .update(tickets)
    .set({
      status: 'done',
      completedAt: now,
      version: sql`${tickets.version} + 1`,
      updatedAt: now,
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'completed',
    payload: { previousStatus },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Fügt ein Label zum Ticket hinzu
 */
export async function addTicketLabel(
  ticketId: string,
  label: string,
  userId?: string
): Promise<DbTicket> {
  const db = getDb();

  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  const normalizedLabel = label.trim().toLowerCase();
  const currentLabels = existing.labels as string[];

  if (currentLabels.includes(normalizedLabel)) {
    return existing; // Label existiert bereits
  }

  const newLabels = [...currentLabels, normalizedLabel];

  const [ticket] = await db
    .update(tickets)
    .set({
      labels: newLabels,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'label_added',
    payload: { label: normalizedLabel },
    createdBy: userId,
  });

  return ticket;
}

/**
 * Entfernt ein Label vom Ticket
 */
export async function removeTicketLabel(
  ticketId: string,
  label: string,
  userId?: string
): Promise<DbTicket> {
  const db = getDb();

  const existing = await findTicketById(ticketId);
  if (!existing) {
    throw new NotFoundError('ticket', ticketId);
  }

  const normalizedLabel = label.trim().toLowerCase();
  const currentLabels = existing.labels as string[];
  const newLabels = currentLabels.filter((l) => l !== normalizedLabel);

  const [ticket] = await db
    .update(tickets)
    .set({
      labels: newLabels,
      updatedAt: new Date(),
    })
    .where(eq(tickets.id, ticketId))
    .returning();

  // Event erstellen
  await createEvent(db, {
    ticketId,
    projectId: ticket.projectId,
    type: 'label_removed',
    payload: { label: normalizedLabel },
    createdBy: userId,
  });

  return ticket;
}

// =============================================================================
// 🔄 BATCH STATUS UPDATE (Phase 7.2)
// =============================================================================

/**
 * Ergebnis eines Batch-Status-Update Vorgangs
 */
export interface BatchStatusResult {
  /** Anzahl erfolgreich aktualisierter Tickets */
  updatedCount: number;
  /** IDs bei denen ein Fehler auftrat (nicht gefunden oder Update fehlgeschlagen) */
  failedIds: string[];
}

/**
 * Einzelnes Status-Update für ein Ticket
 */
export interface StatusUpdate {
  /** Postgres Ticket-ID */
  ticketId: string;
  /** Neuer Status (Remote-Format: backlog, todo, in_progress, review, done, archived) */
  status: TicketStatusType;
  /** Optional: Local Feature-ID für Audit-Trail */
  localId?: string;
}

/**
 * Aktualisiert den Status mehrerer Tickets (Batch-Operation)
 *
 * Diese Funktion aktualisiert den Status mehrerer Tickets in einem Vorgang.
 * Die Operation ist "best effort" - wenn ein Ticket fehlschlägt, werden
 * die anderen trotzdem verarbeitet.
 *
 * WICHTIG: Diese Funktion überspringt die Status-Transition-Validierung,
 * da der Status bereits vom Frontend gemappt wurde und die lokale
 * Kanban-Board-Logik die Validierung übernimmt.
 *
 * @param updates - Array von Status-Updates
 * @param userId - Optional: User-ID für Audit-Trail
 * @returns BatchStatusResult mit Statistiken
 */
export async function updateMultipleTicketsStatus(
  updates: StatusUpdate[],
  userId?: string
): Promise<BatchStatusResult> {
  const db = getDb();
  const now = new Date();

  const result: BatchStatusResult = {
    updatedCount: 0,
    failedIds: [],
  };

  // Leeres Array? Schnell zurück
  if (updates.length === 0) {
    return result;
  }

  // Gruppiere Updates nach Status für effizientere Batch-Operationen
  const updatesByStatus = new Map<TicketStatusType, string[]>();
  for (const update of updates) {
    const ids = updatesByStatus.get(update.status) ?? [];
    ids.push(update.ticketId);
    updatesByStatus.set(update.status, ids);
  }

  // Verarbeite jede Status-Gruppe
  for (const [status, ticketIds] of updatesByStatus) {
    try {
      // Ein einziger Update für alle Tickets mit demselben Ziel-Status
      // Inkludiere projectId für Event-Erstellung
      const updateResult = await db
        .update(tickets)
        .set({
          status,
          version: sql`${tickets.version} + 1`,
          updatedAt: now,
        })
        .where(and(inArray(tickets.id, ticketIds), isNull(tickets.deletedAt)))
        .returning({ id: tickets.id, projectId: tickets.projectId });

      // Zähle erfolgreiche Updates
      result.updatedCount += updateResult.length;

      // Finde fehlgeschlagene IDs (nicht gefunden oder bereits gelöscht)
      const updatedIds = new Set(updateResult.map((r) => r.id));
      for (const id of ticketIds) {
        if (!updatedIds.has(id)) {
          result.failedIds.push(id);
        }
      }

      // Events für erfolgreiche Updates erstellen
      for (const updated of updateResult) {
        await createEvent(db, {
          ticketId: updated.id,
          projectId: updated.projectId,
          type: 'status_changed',
          payload: { newStatus: status, source: 'batch_update' },
          createdBy: userId,
        });
      }
    } catch (error) {
      // Bei einem Fehler: Alle IDs dieser Gruppe als fehlgeschlagen markieren
      console.error(`Error in batch status update for status '${status}':`, error);
      result.failedIds.push(...ticketIds);
    }
  }

  return result;
}

// =============================================================================
// 🎫 PUBLIC TICKET ACTION (Phase 3.4 - Kunden-Ticket-Eingang)
// =============================================================================

/**
 * Kategorie-Labels für bessere Lesbarkeit
 */
const CATEGORY_LABELS: Record<string, string> = {
  bug: '🐛 Bug',
  feature: '✨ Feature',
  question: '❓ Frage',
};

/**
 * Daten für öffentliche Ticket-Erstellung (durch Kunden)
 */
export interface CreatePublicTicketData {
  /** Ticket-Titel */
  title: string;
  /** Beschreibung (optional) */
  description?: string;
  /** Name des Kunden */
  creatorName: string;
  /** Kategorie: bug, feature, question */
  category: 'bug' | 'feature' | 'question';
}

/**
 * Erstellt ein Ticket aus dem Kunden-Portal
 *
 * Diese Funktion wird verwendet wenn ein Kunde über das öffentliche
 * Board ein neues Ticket erstellt. Das Ticket:
 *
 * - Landet im Status 'todo' (sofort sichtbar für Team)
 * - Hat Priorität 'medium' (Team kann anpassen)
 * - Bekommt das Label 'customer-feedback'
 * - Die Description enthält Ersteller-Name und Kategorie
 *
 * @param projectId - Projekt-ID (aus dem Slug ermittelt)
 * @param data - Ticket-Daten vom Kunden
 * @returns Erstelltes Ticket
 */
export async function createPublicTicket(
  projectId: string,
  data: CreatePublicTicketData
): Promise<DbTicket> {
  const db = getDb();

  // Description mit Ersteller-Info anreichern
  const categoryLabel = CATEGORY_LABELS[data.category] || data.category;
  const descriptionParts = [
    `**📝 Erstellt von:** ${data.creatorName}`,
    `**📂 Kategorie:** ${categoryLabel}`,
    '',
    '---',
    '',
    data.description || '_Keine Beschreibung angegeben_',
  ];
  const fullDescription = descriptionParts.join('\n');

  // Ticket-Daten vorbereiten
  const insertData: DbNewTicket = {
    projectId,
    title: data.title.trim(),
    description: fullDescription,
    status: 'todo', // Sofort sichtbar für Team
    priority: 'medium', // Standard-Priorität (Team kann anpassen)
    labels: ['customer-feedback'], // Markiert als Kunden-Feedback
    createdBy: null, // Kein User-Account, aber Name in Description
  };

  const [ticket] = await db.insert(tickets).values(insertData).returning();

  // Event erstellen (für Activity-Feed)
  await createEvent(db, {
    ticketId: ticket.id,
    projectId: ticket.projectId,
    type: 'created',
    payload: {
      title: ticket.title,
      status: ticket.status,
      priority: ticket.priority,
      source: 'customer_portal',
      creatorName: data.creatorName,
      category: data.category,
    },
    createdBy: undefined, // Kein User, Gast-Erstellung
  });

  return ticket;
}
