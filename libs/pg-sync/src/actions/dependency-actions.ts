/**
 * 🔗 Dependency Actions
 *
 * CRUD-Operationen für Ticket-Abhängigkeiten (Blocker, Related).
 * Enthält wichtige Cycle-Detection um zyklische Abhängigkeiten zu verhindern.
 *
 * @see docs/pg-online-sync/tasks/phase-2.5-dependency-graph.md
 */

import { eq, and, or } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { ticketDependencies, tickets, type DependencyType } from '../db/schema/index.js';
import type { DbTicketDependency, DbNewTicketDependency, DbTicket } from '../db/schema/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/index.js';
import { findTicketById } from '../finders/ticket-finder.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Daten für Dependency-Erstellung
 */
export interface CreateDependencyData {
  sourceTicketId: string;
  targetTicketId: string;
  relationType: DependencyType;
  createdBy?: string;
}

/**
 * Dependency mit Ticket-Details
 */
export interface DependencyWithTickets extends DbTicketDependency {
  sourceTicket?: DbTicket;
  targetTicket?: DbTicket;
}

// =============================================================================
// 🔄 CYCLE DETECTION
// =============================================================================

/**
 * Prüft ob durch eine neue Abhängigkeit ein Zyklus entstehen würde
 *
 * Verwendet BFS (Breadth-First Search) um von targetTicketId aus zu prüfen,
 * ob man zu sourceTicketId zurückkommt.
 *
 * Beispiel-Zyklus: A → B → C → A
 * Wenn wir C → A hinzufügen wollen, prüfen wir:
 * - Von A aus: Gibt es einen Pfad zurück zu C?
 * - A → B? B → C? → Ja, Zyklus!
 *
 * @returns true wenn Zyklus erkannt, false sonst
 */
async function detectCycle(sourceTicketId: string, targetTicketId: string): Promise<boolean> {
  const db = getDb();

  // BFS: Starte von Target und suche Pfad zurück zu Source
  const visited = new Set<string>();
  const queue: string[] = [targetTicketId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    // Wenn wir bei Source ankommen → Zyklus!
    if (currentId === sourceTicketId) {
      return true;
    }

    // Schon besucht? Skip
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    // Finde alle ausgehenden 'blocks' Abhängigkeiten von currentId
    const outgoing = await db
      .select({ targetTicketId: ticketDependencies.targetTicketId })
      .from(ticketDependencies)
      .where(
        and(
          eq(ticketDependencies.sourceTicketId, currentId),
          eq(ticketDependencies.relationType, 'blocks')
        )
      );

    // Füge alle Ziele zur Queue hinzu
    for (const dep of outgoing) {
      if (!visited.has(dep.targetTicketId)) {
        queue.push(dep.targetTicketId);
      }
    }
  }

  return false;
}

/**
 * Validiert die Dependency-Erstellung
 */
async function validateDependency(data: CreateDependencyData): Promise<void> {
  // 1. Self-Reference verhindern
  if (data.sourceTicketId === data.targetTicketId) {
    throw new ValidationError('SELF_REFERENCE', 'Ein Ticket kann nicht von sich selbst abhängen');
  }

  // 2. Tickets existieren?
  const sourceTicket = await findTicketById(data.sourceTicketId);
  if (!sourceTicket) {
    throw new NotFoundError('ticket', data.sourceTicketId);
  }

  const targetTicket = await findTicketById(data.targetTicketId);
  if (!targetTicket) {
    throw new NotFoundError('ticket', data.targetTicketId);
  }

  // 3. Tickets im selben Projekt? (Optional, aber sinnvoll)
  if (sourceTicket.projectId !== targetTicket.projectId) {
    throw new ValidationError(
      'CROSS_PROJECT',
      'Abhängigkeiten zwischen Projekten sind nicht erlaubt'
    );
  }

  // 4. Zyklus-Erkennung nur für 'blocks' (relates_to darf zyklisch sein)
  if (data.relationType === 'blocks') {
    const hasCycle = await detectCycle(data.sourceTicketId, data.targetTicketId);
    if (hasCycle) {
      throw ConflictError.cyclicDependency(data.sourceTicketId, data.targetTicketId);
    }
  }
}

// =============================================================================
// ⚡ ACTION FUNCTIONS
// =============================================================================

/**
 * Erstellt eine neue Ticket-Abhängigkeit
 *
 * @throws NotFoundError - Ticket nicht gefunden
 * @throws ValidationError - Self-Reference oder Cross-Project
 * @throws ConflictError - Zyklus erkannt oder Duplikat
 */
export async function addDependency(
  data: CreateDependencyData,
  userId?: string
): Promise<DbTicketDependency> {
  // Validierung
  await validateDependency(data);

  const db = getDb();

  // Prüfe auf Duplikat
  const existing = await db
    .select()
    .from(ticketDependencies)
    .where(
      and(
        eq(ticketDependencies.sourceTicketId, data.sourceTicketId),
        eq(ticketDependencies.targetTicketId, data.targetTicketId),
        eq(ticketDependencies.relationType, data.relationType)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new ConflictError('DUPLICATE', `Diese Abhängigkeit existiert bereits`, {
      sourceTicketId: data.sourceTicketId,
      targetTicketId: data.targetTicketId,
    });
  }

  // Insert
  const insertData: DbNewTicketDependency = {
    sourceTicketId: data.sourceTicketId,
    targetTicketId: data.targetTicketId,
    relationType: data.relationType,
    createdBy: data.createdBy ?? userId,
  };

  const [dependency] = await db.insert(ticketDependencies).values(insertData).returning();

  return dependency;
}

/**
 * Entfernt eine Ticket-Abhängigkeit
 *
 * @throws NotFoundError - Abhängigkeit nicht gefunden
 */
export async function removeDependency(dependencyId: string): Promise<void> {
  const db = getDb();

  const result = await db
    .delete(ticketDependencies)
    .where(eq(ticketDependencies.id, dependencyId))
    .returning({ id: ticketDependencies.id });

  if (result.length === 0) {
    throw new NotFoundError('dependency', dependencyId);
  }
}

/**
 * Entfernt eine Abhängigkeit anhand von Source und Target
 */
export async function removeDependencyByTickets(
  sourceTicketId: string,
  targetTicketId: string,
  relationType?: DependencyType
): Promise<number> {
  const db = getDb();

  const conditions = [
    eq(ticketDependencies.sourceTicketId, sourceTicketId),
    eq(ticketDependencies.targetTicketId, targetTicketId),
  ];

  if (relationType) {
    conditions.push(eq(ticketDependencies.relationType, relationType));
  }

  const result = await db
    .delete(ticketDependencies)
    .where(and(...conditions))
    .returning({ id: ticketDependencies.id });

  return result.length;
}

/**
 * Entfernt alle Abhängigkeiten eines Tickets (als Source oder Target)
 *
 * Nützlich beim Löschen eines Tickets
 */
export async function removeAllDependenciesForTicket(ticketId: string): Promise<number> {
  const db = getDb();

  const result = await db
    .delete(ticketDependencies)
    .where(
      or(
        eq(ticketDependencies.sourceTicketId, ticketId),
        eq(ticketDependencies.targetTicketId, ticketId)
      )
    )
    .returning({ id: ticketDependencies.id });

  return result.length;
}

/**
 * Ändert den Typ einer Abhängigkeit
 *
 * @throws NotFoundError - Abhängigkeit nicht gefunden
 * @throws ConflictError - Zyklus erkannt bei Wechsel zu 'blocks'
 */
export async function changeDependencyType(
  dependencyId: string,
  newType: DependencyType
): Promise<DbTicketDependency> {
  const db = getDb();

  // Abhängigkeit laden
  const [existing] = await db
    .select()
    .from(ticketDependencies)
    .where(eq(ticketDependencies.id, dependencyId))
    .limit(1);

  if (!existing) {
    throw new NotFoundError('dependency', dependencyId);
  }

  // Wenn wir zu 'blocks' wechseln: Zyklus prüfen
  if (newType === 'blocks' && existing.relationType !== 'blocks') {
    const hasCycle = await detectCycle(existing.sourceTicketId, existing.targetTicketId);
    if (hasCycle) {
      throw ConflictError.cyclicDependency(existing.sourceTicketId, existing.targetTicketId);
    }
  }

  // Update
  const [updated] = await db
    .update(ticketDependencies)
    .set({ relationType: newType })
    .where(eq(ticketDependencies.id, dependencyId))
    .returning();

  return updated;
}

/**
 * Prüft ob ein Ticket blockiert ist (hat offene Blocker)
 */
export async function isTicketBlocked(ticketId: string): Promise<boolean> {
  const db = getDb();

  // Finde alle eingehenden 'blocks' Abhängigkeiten
  const blockers = await db
    .select({
      sourceTicketId: ticketDependencies.sourceTicketId,
      status: tickets.status,
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(
      and(
        eq(ticketDependencies.targetTicketId, ticketId),
        eq(ticketDependencies.relationType, 'blocks')
      )
    );

  // Ticket ist blockiert wenn mindestens ein Blocker nicht 'done' ist
  return blockers.some((b) => b.status !== 'done');
}

/**
 * Gibt die IDs der blockierenden Tickets zurück
 */
export async function getBlockingTicketIds(ticketId: string): Promise<string[]> {
  const db = getDb();

  const blockers = await db
    .select({
      sourceTicketId: ticketDependencies.sourceTicketId,
      status: tickets.status,
    })
    .from(ticketDependencies)
    .innerJoin(tickets, eq(ticketDependencies.sourceTicketId, tickets.id))
    .where(
      and(
        eq(ticketDependencies.targetTicketId, ticketId),
        eq(ticketDependencies.relationType, 'blocks')
      )
    );

  // Nur offene Blocker zurückgeben
  return blockers.filter((b) => b.status !== 'done').map((b) => b.sourceTicketId);
}

/**
 * Prüft ob das Hinzufügen einer Abhängigkeit einen Zyklus verursachen würde
 *
 * Öffentliche Wrapper-Funktion für UI-Validierung
 */
export async function wouldCreateCycle(
  sourceTicketId: string,
  targetTicketId: string
): Promise<boolean> {
  return detectCycle(sourceTicketId, targetTicketId);
}
