/**
 * 🔍 Ticket Finder
 *
 * Read-Only Queries für Tickets.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, isNull, ilike, desc, asc, count, ne, inArray, or, sql } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { tickets, ticketEvents, users } from '../db/schema/index.js';
import type { DbTicket, DbTicketEvent } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Ticket-Status (aus DB-Enum)
 */
export type TicketStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';

/**
 * Ticket-Priorität (aus DB-Enum)
 */
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Filter-Optionen für Ticket-Queries
 */
export interface FindTicketsOptions {
  /** Status-Filter (einzeln oder mehrere) */
  status?: TicketStatus | TicketStatus[];
  /** Prioritäts-Filter */
  priority?: TicketPriority;
  /** Geclaimed von User */
  claimedBy?: string;
  /** Labels enthalten (mindestens eines) */
  labels?: string[];
  /** Volltextsuche in Titel/Beschreibung */
  search?: string;
  /** Sortierung */
  orderBy?: 'created' | 'updated' | 'priority' | 'status';
  /** Sortierrichtung */
  order?: 'asc' | 'desc';
  /** Limit */
  limit?: number;
  /** Offset für Pagination */
  offset?: number;
  /** Gelöschte einschließen? */
  includeDeleted?: boolean;
}

/**
 * Ticket mit Creator und Claimer
 */
export interface TicketWithRelations extends DbTicket {
  creator?: typeof users.$inferSelect | null;
  claimer?: typeof users.$inferSelect | null;
}

/**
 * Aggregierte Status-Counts
 */
export interface StatusCounts {
  backlog: number;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
  archived: number;
}

/**
 * Öffentlich sichtbare Ticket-Daten (reduziert)
 */
export interface PublicTicketData {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Optionen für öffentliche Ticket-Queries
 */
export interface PublicTicketFinderOptions {
  /** Welche Status-Spalten werden angezeigt? */
  visibleStatuses?: string[];
}

// =============================================================================
// 🔍 FINDER FUNCTIONS
// =============================================================================

/**
 * Findet ein Ticket nach ID
 */
export async function findTicketById(id: string): Promise<DbTicket | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet ein Ticket nach lokaler ID (für Offline-Sync)
 */
export async function findTicketByLocalId(
  projectId: string,
  localId: string
): Promise<DbTicket | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(tickets)
    .where(
      and(eq(tickets.projectId, projectId), eq(tickets.localId, localId), isNull(tickets.deletedAt))
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet alle Tickets eines Projekts mit Filterung
 */
export async function findTicketsByProject(
  projectId: string,
  options: FindTicketsOptions = {}
): Promise<DbTicket[]> {
  const db = getDb();

  const {
    status,
    priority,
    claimedBy,
    labels,
    search,
    orderBy = 'created',
    order = 'desc',
    limit = 100,
    offset = 0,
    includeDeleted = false,
  } = options;

  // Basis-Bedingungen
  const conditions = [eq(tickets.projectId, projectId)];

  if (!includeDeleted) {
    conditions.push(isNull(tickets.deletedAt));
  }

  // Status-Filter
  if (status) {
    if (Array.isArray(status)) {
      conditions.push(inArray(tickets.status, status));
    } else {
      conditions.push(eq(tickets.status, status));
    }
  }

  // Prioritäts-Filter
  if (priority) {
    conditions.push(eq(tickets.priority, priority));
  }

  // Claimed-By Filter
  if (claimedBy) {
    conditions.push(eq(tickets.claimedBy, claimedBy));
  }

  // Suche in Titel/Beschreibung
  if (search) {
    conditions.push(
      or(ilike(tickets.title, `%${search}%`), ilike(tickets.description, `%${search}%`))!
    );
  }

  // Labels-Filter (enthält mindestens eines der Labels)
  // Hinweis: Array-Overlap in Drizzle ist komplexer, vereinfachte Version
  // Für produktives System: Raw SQL mit && Operator

  // Sortierung bestimmen
  const orderColumn = {
    created: tickets.createdAt,
    updated: tickets.updatedAt,
    priority: tickets.priority,
    status: tickets.status,
  }[orderBy];

  const orderFn = order === 'asc' ? asc : desc;

  const result = await db
    .select()
    .from(tickets)
    .where(and(...conditions))
    .orderBy(orderFn(orderColumn))
    .limit(limit)
    .offset(offset);

  return result;
}

/**
 * Findet Tickets für die öffentliche Kunden-Ansicht (reduzierte Felder)
 * Exkludiert Tickets mit dem Label "internal".
 */
export async function getPublicProjectTickets(
  projectId: string,
  options: PublicTicketFinderOptions = {}
): Promise<PublicTicketData[]> {
  const db = getDb();
  const { visibleStatuses } = options;
  const conditions = [
    eq(tickets.projectId, projectId),
    isNull(tickets.deletedAt),
    sql`NOT ('internal' = ANY(${tickets.labels}))`,
  ];

  if (visibleStatuses && visibleStatuses.length > 0) {
    conditions.push(inArray(tickets.status, visibleStatuses as TicketStatus[]));
  }

  const result = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      description: tickets.description,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(and(...conditions))
    .orderBy(desc(tickets.updatedAt));

  return result;
}

/**
 * Findet alle Tickets mit einem bestimmten Status
 */
export async function findTicketsByStatus(
  projectId: string,
  status: TicketStatus
): Promise<DbTicket[]> {
  return findTicketsByProject(projectId, { status });
}

/**
 * Findet alle Tickets die von einem User geclaimed wurden
 */
export async function findTicketsClaimedBy(userId: string): Promise<DbTicket[]> {
  const db = getDb();

  const result = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.claimedBy, userId), isNull(tickets.deletedAt)))
    .orderBy(desc(tickets.claimedAt));

  return result;
}

/**
 * Findet alle offenen Tickets (nicht done/archived)
 */
export async function findOpenTickets(projectId: string): Promise<DbTicket[]> {
  return findTicketsByProject(projectId, {
    status: ['backlog', 'todo', 'in_progress', 'review'],
  });
}

/**
 * Zählt Tickets pro Status
 */
export async function countTicketsByStatus(projectId: string): Promise<StatusCounts> {
  const db = getDb();

  // Einzelne Counts für jeden Status
  const statuses: TicketStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'];

  const counts: StatusCounts = {
    backlog: 0,
    todo: 0,
    in_progress: 0,
    review: 0,
    done: 0,
    archived: 0,
  };

  // Optimierter: Ein Query mit GROUP BY
  // Aber für Einfachheit: Parallel Queries
  const results = await Promise.all(
    statuses.map(async (status) => {
      const result = await db
        .select({ count: count() })
        .from(tickets)
        .where(
          and(
            eq(tickets.projectId, projectId),
            eq(tickets.status, status),
            isNull(tickets.deletedAt)
          )
        );
      return { status, count: result[0].count };
    })
  );

  results.forEach(({ status, count: c }) => {
    counts[status] = c;
  });

  return counts;
}

/**
 * Findet Ticket mit Relations (Creator, Claimer)
 */
export async function findTicketWithRelations(id: string): Promise<TicketWithRelations | null> {
  const db = getDb();

  const result = await db
    .select({
      ticket: tickets,
      creator: users,
    })
    .from(tickets)
    .leftJoin(users, eq(tickets.createdBy, users.id))
    .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
    .limit(1);

  if (result.length === 0) return null;

  const ticket = result[0].ticket;
  const creator = result[0].creator;

  // Claimer separat laden (falls vorhanden)
  let claimer = null;
  if (ticket.claimedBy) {
    const claimerResult = await db
      .select()
      .from(users)
      .where(eq(users.id, ticket.claimedBy))
      .limit(1);
    claimer = claimerResult[0] ?? null;
  }

  return {
    ...ticket,
    creator,
    claimer,
  };
}

/**
 * Prüft ob ein Ticket existiert
 */
export async function ticketExists(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)));

  return result[0].count > 0;
}

/**
 * Zählt alle Tickets in einem Projekt
 */
export async function countTicketsInProject(
  projectId: string,
  options: Pick<FindTicketsOptions, 'status' | 'includeDeleted'> = {}
): Promise<number> {
  const db = getDb();
  const { status, includeDeleted = false } = options;

  const conditions = [eq(tickets.projectId, projectId)];

  if (!includeDeleted) {
    conditions.push(isNull(tickets.deletedAt));
  }

  if (status) {
    if (Array.isArray(status)) {
      conditions.push(inArray(tickets.status, status));
    } else {
      conditions.push(eq(tickets.status, status));
    }
  }

  const result = await db
    .select({ count: count() })
    .from(tickets)
    .where(and(...conditions));

  return result[0].count;
}
