/**
 * 🔍 Dependency Finder
 *
 * Read-Only Queries für Ticket-Abhängigkeiten.
 *
 * @see docs/pg-online-sync/tasks/phase-2.5-dependency-graph.md
 */

import { eq, and, or, desc, asc, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { ticketDependencies, tickets, users, type DependencyType } from '../db/schema/index.js';
import type { DbTicketDependency, DbTicket } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Dependency mit Ticket-Details
 */
export interface DependencyWithTickets {
  dependency: DbTicketDependency;
  sourceTicket: Pick<DbTicket, 'id' | 'title' | 'status' | 'priority'> | null;
  targetTicket: Pick<DbTicket, 'id' | 'title' | 'status' | 'priority'> | null;
  creatorName?: string;
}

/**
 * Graph-Daten für Visualisierung
 */
export interface DependencyGraphData {
  /** Alle Tickets die im Graph vorkommen */
  tickets: Array<Pick<DbTicket, 'id' | 'title' | 'status' | 'priority' | 'projectId'>>;
  /** Alle Abhängigkeiten zwischen den Tickets */
  dependencies: Array<{
    id: string;
    sourceTicketId: string;
    targetTicketId: string;
    relationType: DependencyType;
  }>;
}

/**
 * Blocker-Info für ein Ticket
 */
export interface BlockerInfo {
  isBlocked: boolean;
  blockerCount: number;
  openBlockerCount: number;
  blockers: Array<{
    ticketId: string;
    ticketTitle: string;
    ticketStatus: string;
    isDone: boolean;
  }>;
}

// =============================================================================
// 🔍 FINDER FUNCTIONS
// =============================================================================

/**
 * Findet eine Dependency anhand ihrer ID
 */
export async function findDependencyById(id: string): Promise<DbTicketDependency | undefined> {
  const db = getDb();

  const [dependency] = await db
    .select()
    .from(ticketDependencies)
    .where(eq(ticketDependencies.id, id))
    .limit(1);

  return dependency;
}

/**
 * Findet alle ausgehenden Abhängigkeiten eines Tickets
 * (Tickets die von diesem Ticket blockiert werden)
 */
export async function findOutgoingDependencies(
  ticketId: string,
  relationType?: DependencyType
): Promise<DbTicketDependency[]> {
  const db = getDb();

  const conditions = [eq(ticketDependencies.sourceTicketId, ticketId)];
  if (relationType) {
    conditions.push(eq(ticketDependencies.relationType, relationType));
  }

  return db
    .select()
    .from(ticketDependencies)
    .where(and(...conditions))
    .orderBy(desc(ticketDependencies.createdAt));
}

/**
 * Findet alle eingehenden Abhängigkeiten eines Tickets
 * (Tickets die dieses Ticket blockieren)
 */
export async function findIncomingDependencies(
  ticketId: string,
  relationType?: DependencyType
): Promise<DbTicketDependency[]> {
  const db = getDb();

  const conditions = [eq(ticketDependencies.targetTicketId, ticketId)];
  if (relationType) {
    conditions.push(eq(ticketDependencies.relationType, relationType));
  }

  return db
    .select()
    .from(ticketDependencies)
    .where(and(...conditions))
    .orderBy(desc(ticketDependencies.createdAt));
}

/**
 * Findet alle Abhängigkeiten eines Tickets (ein- und ausgehend)
 */
export async function findAllDependenciesForTicket(
  ticketId: string
): Promise<DbTicketDependency[]> {
  const db = getDb();

  return db
    .select()
    .from(ticketDependencies)
    .where(
      or(
        eq(ticketDependencies.sourceTicketId, ticketId),
        eq(ticketDependencies.targetTicketId, ticketId)
      )
    )
    .orderBy(desc(ticketDependencies.createdAt));
}

/**
 * Findet ausgehende Abhängigkeiten mit Ticket-Details
 */
export async function findOutgoingDependenciesWithTickets(
  ticketId: string
): Promise<DependencyWithTickets[]> {
  const db = getDb();

  const results = await db
    .select({
      dependency: ticketDependencies,
      targetTicket: {
        id: tickets.id,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
      },
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.targetTicketId, tickets.id))
    .where(eq(ticketDependencies.sourceTicketId, ticketId))
    .orderBy(asc(tickets.title));

  return results.map((r) => ({
    dependency: r.dependency,
    sourceTicket: null, // Source ist das aktuelle Ticket
    targetTicket: r.targetTicket,
  }));
}

/**
 * Findet eingehende Abhängigkeiten mit Ticket-Details (Blocker)
 */
export async function findIncomingDependenciesWithTickets(
  ticketId: string
): Promise<DependencyWithTickets[]> {
  const db = getDb();

  const results = await db
    .select({
      dependency: ticketDependencies,
      sourceTicket: {
        id: tickets.id,
        title: tickets.title,
        status: tickets.status,
        priority: tickets.priority,
      },
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(eq(ticketDependencies.targetTicketId, ticketId))
    .orderBy(asc(tickets.title));

  return results.map((r) => ({
    dependency: r.dependency,
    sourceTicket: r.sourceTicket,
    targetTicket: null, // Target ist das aktuelle Ticket
  }));
}

/**
 * Holt Blocker-Informationen für ein Ticket
 */
export async function getBlockerInfo(ticketId: string): Promise<BlockerInfo> {
  const db = getDb();

  const blockers = await db
    .select({
      ticketId: tickets.id,
      ticketTitle: tickets.title,
      ticketStatus: tickets.status,
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(
      and(
        eq(ticketDependencies.targetTicketId, ticketId),
        eq(ticketDependencies.relationType, 'blocks')
      )
    );

  const mappedBlockers = blockers.map((b) => ({
    ticketId: b.ticketId,
    ticketTitle: b.ticketTitle,
    ticketStatus: b.ticketStatus,
    isDone: b.ticketStatus === 'done',
  }));

  const openBlockers = mappedBlockers.filter((b) => !b.isDone);

  return {
    isBlocked: openBlockers.length > 0,
    blockerCount: mappedBlockers.length,
    openBlockerCount: openBlockers.length,
    blockers: mappedBlockers,
  };
}

/**
 * Findet alle Abhängigkeiten eines Projekts
 */
export async function findDependenciesByProject(projectId: string): Promise<DbTicketDependency[]> {
  const db = getDb();

  // Über die Tickets gehen (Source-Ticket gehört zum Projekt)
  const deps = await db
    .select({
      dependency: ticketDependencies,
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(and(eq(tickets.projectId, projectId), isNull(tickets.deletedAt)));

  return deps.map((d) => d.dependency);
}

/**
 * Holt Graph-Daten für Visualisierung (React Flow kompatibel)
 */
export async function getDependencyGraphData(projectId: string): Promise<DependencyGraphData> {
  const db = getDb();

  // 1. Alle Tickets des Projekts (nicht gelöscht)
  const projectTickets = await db
    .select({
      id: tickets.id,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      projectId: tickets.projectId,
    })
    .from(tickets)
    .where(and(eq(tickets.projectId, projectId), isNull(tickets.deletedAt)));

  const ticketIds = projectTickets.map((t) => t.id);

  // 2. Alle Abhängigkeiten zwischen diesen Tickets
  const projectDeps = await db
    .select()
    .from(ticketDependencies)
    .where(
      or(
        // Source ist im Projekt
        and(
          ...(ticketIds.length > 0
            ? ticketIds.map((id) => eq(ticketDependencies.sourceTicketId, id))
            : [eq(ticketDependencies.sourceTicketId, '00000000-0000-0000-0000-000000000000')])
        )
      )
    );

  // Filtere: Beide Tickets müssen im Projekt sein
  const validDeps = projectDeps.filter(
    (dep) => ticketIds.includes(dep.sourceTicketId) && ticketIds.includes(dep.targetTicketId)
  );

  return {
    tickets: projectTickets,
    dependencies: validDeps.map((d) => ({
      id: d.id,
      sourceTicketId: d.sourceTicketId,
      targetTicketId: d.targetTicketId,
      relationType: d.relationType as DependencyType,
    })),
  };
}

/**
 * Prüft ob eine bestimmte Abhängigkeit existiert
 */
export async function dependencyExists(
  sourceTicketId: string,
  targetTicketId: string,
  relationType?: DependencyType
): Promise<boolean> {
  const db = getDb();

  const conditions = [
    eq(ticketDependencies.sourceTicketId, sourceTicketId),
    eq(ticketDependencies.targetTicketId, targetTicketId),
  ];

  if (relationType) {
    conditions.push(eq(ticketDependencies.relationType, relationType));
  }

  const [result] = await db
    .select({ id: ticketDependencies.id })
    .from(ticketDependencies)
    .where(and(...conditions))
    .limit(1);

  return !!result;
}

/**
 * Zählt Abhängigkeiten eines Tickets
 */
export async function countDependencies(ticketId: string): Promise<{
  incoming: number;
  outgoing: number;
  total: number;
}> {
  const db = getDb();

  const [incomingResult] = await db
    .select({ count: ticketDependencies.id })
    .from(ticketDependencies)
    .where(eq(ticketDependencies.targetTicketId, ticketId));

  const [outgoingResult] = await db
    .select({ count: ticketDependencies.id })
    .from(ticketDependencies)
    .where(eq(ticketDependencies.sourceTicketId, ticketId));

  // Drizzle gibt keine COUNT zurück, wir müssen die Länge nehmen
  const incoming = await findIncomingDependencies(ticketId);
  const outgoing = await findOutgoingDependencies(ticketId);

  return {
    incoming: incoming.length,
    outgoing: outgoing.length,
    total: incoming.length + outgoing.length,
  };
}

/**
 * Findet alle blockierten Tickets eines Projekts
 * (Tickets die mindestens einen offenen Blocker haben)
 */
export async function findBlockedTickets(
  projectId: string
): Promise<Array<{ ticketId: string; blockerCount: number }>> {
  const db = getDb();

  // Alle Tickets mit eingehenden 'blocks' wo Source nicht 'done' ist
  const results = await db
    .select({
      targetTicketId: ticketDependencies.targetTicketId,
      sourceStatus: tickets.status,
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(
      and(
        eq(ticketDependencies.relationType, 'blocks'),
        eq(tickets.projectId, projectId),
        isNull(tickets.deletedAt)
      )
    );

  // Gruppiere nach Target und filtere auf offene Blocker
  const blockedMap = new Map<string, number>();

  for (const r of results) {
    if (r.sourceStatus !== 'done') {
      const current = blockedMap.get(r.targetTicketId) ?? 0;
      blockedMap.set(r.targetTicketId, current + 1);
    }
  }

  return Array.from(blockedMap.entries()).map(([ticketId, blockerCount]) => ({
    ticketId,
    blockerCount,
  }));
}
