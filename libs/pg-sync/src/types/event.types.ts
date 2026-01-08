/**
 * 📡 Event Types
 *
 * Typdefinitionen für Ticket-Events und Event-Payloads.
 * Events werden für die Sync-Historie und Audit-Trail verwendet.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

import type { TicketStatus } from './project.types.js';

// =============================================================================
// 📡 TICKET EVENT ENTITY
// =============================================================================

/**
 * Ein Event das eine Änderung an einem Ticket dokumentiert
 */
export interface TicketEvent {
  /** Eindeutige ID (UUID) */
  id: string;
  /** Ticket-ID (Fremdschlüssel) */
  ticketId: string;
  /** Projekt-ID (für schnellere Queries) */
  projectId: string;
  /** Event-Typ */
  type: TicketEventType;
  /** Event-spezifische Daten */
  payload: EventPayload;
  /** User-ID der die Änderung gemacht hat */
  createdBy: string;
  /** Zeitstempel (ISO String) */
  createdAt: string;
}

// =============================================================================
// 🎭 EVENT TYPE ENUM
// =============================================================================

/**
 * Mögliche Event-Typen
 */
export type TicketEventType =
  | 'created' // Ticket erstellt
  | 'updated' // Ticket geändert
  | 'status_changed' // Status geändert
  | 'claimed' // Ticket geclaimed
  | 'unclaimed' // Claim aufgehoben
  | 'completed' // Abgeschlossen
  | 'comment_added' // Kommentar hinzugefügt
  | 'label_added' // Label hinzugefügt
  | 'label_removed'; // Label entfernt

/**
 * Array aller Event-Typen (für Validierung)
 */
export const TICKET_EVENT_TYPES: readonly TicketEventType[] = [
  'created',
  'updated',
  'status_changed',
  'claimed',
  'unclaimed',
  'completed',
  'comment_added',
  'label_added',
  'label_removed',
] as const;

// =============================================================================
// 📦 EVENT PAYLOADS (Union Type)
// =============================================================================

/**
 * Union Type für alle möglichen Event-Payloads
 */
export type EventPayload =
  | CreatedPayload
  | UpdatedPayload
  | StatusChangedPayload
  | ClaimedPayload
  | UnclaimedPayload
  | CompletedPayload
  | CommentPayload
  | LabelPayload;

/**
 * Payload für 'created' Event
 */
export interface CreatedPayload {
  type: 'created';
  /** Initial-Daten des Tickets */
  data: {
    title: string;
    description?: string;
    priority: string;
    labels: string[];
  };
}

/**
 * Payload für 'updated' Event
 */
export interface UpdatedPayload {
  type: 'updated';
  /** Geänderte Felder */
  changes: FieldChange[];
}

/**
 * Einzelne Feld-Änderung
 */
export interface FieldChange {
  /** Feldname */
  field: string;
  /** Alter Wert */
  from: unknown;
  /** Neuer Wert */
  to: unknown;
}

/**
 * Payload für 'status_changed' Event
 */
export interface StatusChangedPayload {
  type: 'status_changed';
  /** Vorheriger Status */
  from: TicketStatus;
  /** Neuer Status */
  to: TicketStatus;
}

/**
 * Payload für 'claimed' Event
 */
export interface ClaimedPayload {
  type: 'claimed';
  /** User-ID der das Ticket übernommen hat */
  userId: string;
  /** Username für Anzeige */
  userName?: string;
}

/**
 * Payload für 'unclaimed' Event
 */
export interface UnclaimedPayload {
  type: 'unclaimed';
  /** User-ID der den Claim aufgehoben hat */
  previousUserId: string;
}

/**
 * Payload für 'completed' Event
 */
export interface CompletedPayload {
  type: 'completed';
  /** User-ID der das Ticket abgeschlossen hat */
  completedBy: string;
  /** Dauer in Minuten (optional) */
  durationMinutes?: number;
}

/**
 * Payload für 'comment_added' Event
 */
export interface CommentPayload {
  type: 'comment_added';
  /** Kommentar-Inhalt (Markdown) */
  content: string;
  /** Kommentar-ID */
  commentId?: string;
}

/**
 * Payload für 'label_added' und 'label_removed' Events
 */
export interface LabelPayload {
  type: 'label_added' | 'label_removed';
  /** Label-Name */
  label: string;
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt ein neues TicketEvent
 */
export function createTicketEvent(partial: Omit<TicketEvent, 'id' | 'createdAt'>): TicketEvent {
  return {
    id: crypto.randomUUID(),
    ticketId: partial.ticketId,
    projectId: partial.projectId,
    type: partial.type,
    payload: partial.payload,
    createdBy: partial.createdBy,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Erstellt ein StatusChanged Event
 */
export function createStatusChangedEvent(
  ticketId: string,
  projectId: string,
  userId: string,
  from: TicketStatus,
  to: TicketStatus
): TicketEvent {
  return createTicketEvent({
    ticketId,
    projectId,
    type: 'status_changed',
    payload: { type: 'status_changed', from, to },
    createdBy: userId,
  });
}

/**
 * Erstellt ein Claimed Event
 */
export function createClaimedEvent(
  ticketId: string,
  projectId: string,
  userId: string,
  userName?: string
): TicketEvent {
  return createTicketEvent({
    ticketId,
    projectId,
    type: 'claimed',
    payload: { type: 'claimed', userId, userName },
    createdBy: userId,
  });
}

/**
 * Erstellt ein Updated Event aus Änderungen
 */
export function createUpdatedEvent(
  ticketId: string,
  projectId: string,
  userId: string,
  changes: FieldChange[]
): TicketEvent {
  return createTicketEvent({
    ticketId,
    projectId,
    type: 'updated',
    payload: { type: 'updated', changes },
    createdBy: userId,
  });
}

// =============================================================================
// 🔍 TYPE GUARDS
// =============================================================================

/**
 * Type Guard für StatusChangedPayload
 */
export function isStatusChangedPayload(payload: EventPayload): payload is StatusChangedPayload {
  return payload.type === 'status_changed';
}

/**
 * Type Guard für ClaimedPayload
 */
export function isClaimedPayload(payload: EventPayload): payload is ClaimedPayload {
  return payload.type === 'claimed';
}

/**
 * Type Guard für UpdatedPayload
 */
export function isUpdatedPayload(payload: EventPayload): payload is UpdatedPayload {
  return payload.type === 'updated';
}

/**
 * Type Guard für CommentPayload
 */
export function isCommentPayload(payload: EventPayload): payload is CommentPayload {
  return payload.type === 'comment_added';
}

// =============================================================================
// 📦 INSERT TYPES
// =============================================================================

/**
 * Daten für neues Event (ohne ID und Timestamp)
 */
export type NewTicketEvent = Omit<TicketEvent, 'id' | 'createdAt'>;
