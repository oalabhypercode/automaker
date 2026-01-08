/**
 * 🎫 Ticket Types
 *
 * Typdefinitionen für Tickets und deren Status.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 🎫 TICKET ENTITY
// =============================================================================

// Re-export TicketStatus from project.types (single source of truth)
export { TICKET_STATUSES } from './project.types.js';
export type { TicketStatus } from './project.types.js';

/**
 * Ein Ticket im Sync-System
 */
export interface Ticket {
  /** Eindeutige ID (UUID) */
  id: string;
  /** Projekt-ID (Fremdschlüssel) */
  projectId: string;
  /** Ticket-Titel */
  title: string;
  /** Beschreibung (Markdown) */
  description?: string;
  /** Aktueller Status */
  status: import('./project.types.js').TicketStatus;
  /** Priorität */
  priority: TicketPriority;
  /** Labels/Tags */
  labels: string[];
  /** User-ID des Erstellers */
  createdBy: string;
  /** User-ID wer es bearbeitet (geclaimed) */
  claimedBy?: string;
  /** Wann geclaimed (ISO String) */
  claimedAt?: string;
  /** Wann abgeschlossen (ISO String) */
  completedAt?: string;
  /** Erstellungsdatum (ISO String) */
  createdAt: string;
  /** Letztes Update (ISO String) */
  updatedAt: string;
}

// =============================================================================
// 🎯 PRIORITY ENUM
// =============================================================================

/**
 * Prioritätsstufen für Tickets
 */
export type TicketPriority =
  | 'low' // Niedrig
  | 'medium' // Mittel
  | 'high' // Hoch
  | 'urgent'; // Dringend

/**
 * Array aller Prioritäten (für Validierung)
 */
export const TICKET_PRIORITIES: readonly TicketPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

/**
 * Prioritäts-Konfiguration für UI
 */
export const PRIORITY_CONFIG: Record<
  TicketPriority,
  {
    label: string;
    emoji: string;
    color: string;
    sortOrder: number;
  }
> = {
  low: {
    label: 'Niedrig',
    emoji: '🟢',
    color: 'green',
    sortOrder: 1,
  },
  medium: {
    label: 'Mittel',
    emoji: '🟡',
    color: 'yellow',
    sortOrder: 2,
  },
  high: {
    label: 'Hoch',
    emoji: '🟠',
    color: 'orange',
    sortOrder: 3,
  },
  urgent: {
    label: 'Dringend',
    emoji: '🔴',
    color: 'red',
    sortOrder: 4,
  },
} as const;

// =============================================================================
// 📊 STATUS CONFIGURATION
// =============================================================================

import type { TicketStatus as TicketStatusType } from './project.types.js';

/**
 * Status-Konfiguration für UI
 */
export const STATUS_CONFIG: Record<
  TicketStatusType,
  {
    label: string;
    emoji: string;
    color: string;
    sortOrder: number;
    isFinal: boolean;
  }
> = {
  backlog: {
    label: 'Backlog',
    emoji: '📋',
    color: 'gray',
    sortOrder: 1,
    isFinal: false,
  },
  todo: {
    label: 'Zu erledigen',
    emoji: '📝',
    color: 'blue',
    sortOrder: 2,
    isFinal: false,
  },
  in_progress: {
    label: 'In Bearbeitung',
    emoji: '🔄',
    color: 'yellow',
    sortOrder: 3,
    isFinal: false,
  },
  review: {
    label: 'Review',
    emoji: '👀',
    color: 'purple',
    sortOrder: 4,
    isFinal: false,
  },
  done: {
    label: 'Erledigt',
    emoji: '✅',
    color: 'green',
    sortOrder: 5,
    isFinal: true,
  },
  archived: {
    label: 'Archiviert',
    emoji: '📦',
    color: 'gray',
    sortOrder: 6,
    isFinal: true,
  },
} as const;

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt ein neues Ticket mit Standard-Werten
 */
export function createTicket(
  partial: Partial<Ticket> & Pick<Ticket, 'projectId' | 'title' | 'createdBy'>
): Ticket {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? crypto.randomUUID(),
    projectId: partial.projectId,
    title: partial.title,
    description: partial.description,
    status: partial.status ?? 'backlog',
    priority: partial.priority ?? 'medium',
    labels: partial.labels ?? [],
    createdBy: partial.createdBy,
    claimedBy: partial.claimedBy,
    claimedAt: partial.claimedAt,
    completedAt: partial.completedAt,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/**
 * Prüft, ob ein Ticket in einem finalen Status ist
 */
export function isTicketFinal(status: TicketStatusType): boolean {
  return STATUS_CONFIG[status].isFinal;
}

/**
 * Gibt valide Übergänge für einen Status zurück
 */
export function getValidTransitions(currentStatus: TicketStatusType): TicketStatusType[] {
  const transitions: Record<TicketStatusType, TicketStatusType[]> = {
    backlog: ['todo'],
    todo: ['backlog', 'in_progress'],
    in_progress: ['todo', 'review', 'done'],
    review: ['in_progress', 'done'],
    done: ['archived', 'todo'],
    archived: ['backlog'],
  };
  return transitions[currentStatus];
}

// =============================================================================
// 📦 INSERT/UPDATE TYPES
// =============================================================================

/**
 * Daten für neues Ticket
 */
export type NewTicket = Omit<
  Ticket,
  'id' | 'createdAt' | 'updatedAt' | 'claimedAt' | 'completedAt'
>;

/**
 * Daten für Ticket-Update
 */
export type UpdateTicket = Partial<Omit<Ticket, 'id' | 'projectId' | 'createdBy' | 'createdAt'>> & {
  id: string;
};

/**
 * Claim-Daten
 */
export interface ClaimTicketData {
  ticketId: string;
  userId: string;
}

/**
 * Status-Änderungs-Daten
 */
export interface ChangeTicketStatusData {
  ticketId: string;
  newStatus: TicketStatusType;
  userId: string;
}
