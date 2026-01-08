/**
 * 📐 Sync Types
 *
 * TypeScript-Definitionen für den Sync-Mechanismus.
 * Push/Pull, Konflikte, Mapping und Event-Typen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

// =============================================================================
// 🔄 SYNC EVENT TYPES
// =============================================================================

/**
 * Event-Typen die gepusht werden können
 */
export type PushEventType =
  | 'ticket_created'
  | 'ticket_updated'
  | 'status_changed'
  | 'ticket_claimed'
  | 'ticket_unclaimed'
  | 'ticket_completed'
  | 'ticket_deleted'
  | 'label_added'
  | 'label_removed';

/**
 * Entity-Typen für Sync
 */
export type SyncEntityType = 'ticket' | 'project' | 'user';

// =============================================================================
// 📦 OUTBOX TYPES
// =============================================================================

/**
 * Lokaler Outbox-Eintrag (vor Persistenz)
 */
export interface LocalOutboxItem {
  id: string;
  eventType: PushEventType;
  entityType: SyncEntityType;
  entityId: string;
  localId: string;
  projectId: string;
  payload: OutboxPayload;
  createdAt: Date;
}

/**
 * Payload für verschiedene Event-Typen
 */
export type OutboxPayload =
  | TicketCreatedPayload
  | TicketUpdatedPayload
  | StatusChangedPayload
  | TicketClaimedPayload
  | TicketUnclaimedPayload
  | TicketCompletedPayload
  | TicketDeletedPayload
  | LabelChangedPayload;

/**
 * Payload: Ticket erstellt
 */
export interface TicketCreatedPayload {
  type: 'ticket_created';
  ticket: {
    localId: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    labels: string[];
  };
}

/**
 * Payload: Ticket aktualisiert
 */
export interface TicketUpdatedPayload {
  type: 'ticket_updated';
  ticketId: string;
  localId: string;
  changes: FieldChange[];
  version: number;
}

/**
 * Einzelne Feldänderung
 */
export interface FieldChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

/**
 * Payload: Status geändert
 */
export interface StatusChangedPayload {
  type: 'status_changed';
  ticketId: string;
  localId: string;
  from: string;
  to: string;
  timestamp: Date;
}

/**
 * Payload: Ticket geclaimed
 */
export interface TicketClaimedPayload {
  type: 'ticket_claimed';
  ticketId: string;
  localId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload: Ticket unclaimed
 */
export interface TicketUnclaimedPayload {
  type: 'ticket_unclaimed';
  ticketId: string;
  localId: string;
  previousUserId: string;
  timestamp: Date;
}

/**
 * Payload: Ticket abgeschlossen
 */
export interface TicketCompletedPayload {
  type: 'ticket_completed';
  ticketId: string;
  localId: string;
  userId: string;
  timestamp: Date;
}

/**
 * Payload: Ticket gelöscht
 */
export interface TicketDeletedPayload {
  type: 'ticket_deleted';
  ticketId: string;
  localId: string;
  timestamp: Date;
}

/**
 * Payload: Label hinzugefügt/entfernt
 */
export interface LabelChangedPayload {
  type: 'label_added' | 'label_removed';
  ticketId: string;
  localId: string;
  label: string;
}

// =============================================================================
// 🔄 PUSH TYPES
// =============================================================================

/**
 * Push-Request an den Server
 */
export interface PushRequestPayload {
  clientId: string;
  projectId: string;
  events: PushRequestEvent[];
}

/**
 * Einzelnes Event im Push-Request
 */
export interface PushRequestEvent {
  id: string;
  type: PushEventType;
  entityId: string;
  localId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

/**
 * Push-Antwort vom Server
 */
export interface PushResponsePayload {
  success: boolean;
  results: PushResult[];
  conflicts: PushConflict[];
  serverTime: string;
}

/**
 * Ergebnis eines einzelnen Push-Events
 */
export interface PushResult {
  eventId: string;
  localId: string;
  remoteId?: string;
  status: 'created' | 'updated' | 'skipped' | 'failed';
  error?: string;
}

/**
 * Konflikt beim Push
 */
export interface PushConflict {
  eventId: string;
  localId: string;
  remoteId: string;
  type: ConflictType;
  message: string;
  remoteVersion?: number;
  localVersion?: number;
}

/**
 * Konflikt-Typen
 */
export type ConflictType =
  | 'version_mismatch'
  | 'already_claimed'
  | 'not_found'
  | 'permission_denied'
  | 'invalid_status_transition';

// =============================================================================
// 🔧 SYNC CONFIG
// =============================================================================

/**
 * Konflikt-Auflösungsstrategie
 */
export type ConflictResolutionStrategy = 'local_wins' | 'remote_wins' | 'manual';

/**
 * Push-Konfiguration
 */
export interface PushConfig {
  /**
   * Max Events pro Push-Request
   * @default 50
   */
  batchSize: number;

  /**
   * Max parallele Requests
   * @default 3
   */
  concurrency: number;

  /**
   * Debounce-Zeit in ms
   * @default 500
   */
  debounceMs: number;

  /**
   * Max Retry-Versuche
   * @default 5
   */
  maxRetries: number;

  /**
   * Retry-Intervalle in ms
   */
  retryIntervals: number[];

  /**
   * Konflikt-Strategie
   * @default 'remote_wins'
   */
  conflictStrategy: ConflictResolutionStrategy;

  /**
   * API Base URL
   */
  apiBaseUrl: string;
}

/**
 * Default Push-Konfiguration
 */
export const DEFAULT_PUSH_CONFIG: PushConfig = {
  batchSize: 50,
  concurrency: 3,
  debounceMs: 500,
  maxRetries: 5,
  retryIntervals: [
    60_000, // 1 Minute
    300_000, // 5 Minuten
    900_000, // 15 Minuten
    3_600_000, // 1 Stunde
    14_400_000, // 4 Stunden
  ],
  conflictStrategy: 'remote_wins',
  apiBaseUrl: '/api/pg-sync',
};

// =============================================================================
// 📊 PUSH STATUS
// =============================================================================

/**
 * Status des Push-Service
 */
export interface PushStatus {
  isProcessing: boolean;
  pending: number;
  failed: number;
  lastPushAt: Date | null;
  lastError: string | null;
  currentBatch: number;
  totalBatches: number;
}

/**
 * Push-Ergebnis nach Verarbeitung
 */
export interface PushProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
  conflicts: number;
  skipped: number;
  errors: PushProcessError[];
}

/**
 * Fehler beim Verarbeiten
 */
export interface PushProcessError {
  eventId: string;
  localId: string;
  error: string;
  retryable: boolean;
}

// =============================================================================
// 🗺️ STATUS MAPPING
// =============================================================================

/**
 * Status-Mapping: Lokal → Remote
 */
export const STATUS_MAP_TO_REMOTE: Record<string, string> = {
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in_progress',
  review: 'review',
  done: 'done',
  archived: 'archived',
};

/**
 * Status-Mapping: Remote → Lokal
 */
export const STATUS_MAP_TO_LOCAL: Record<string, string> = {
  backlog: 'backlog',
  todo: 'todo',
  in_progress: 'in-progress',
  review: 'review',
  done: 'done',
  archived: 'archived',
};

/**
 * Priorität-Mapping: Lokal → Remote
 */
export const PRIORITY_MAP_TO_REMOTE: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

/**
 * Priorität-Mapping: Remote → Lokal
 */
export const PRIORITY_MAP_TO_LOCAL: Record<string, string> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
};

// =============================================================================
// 🔧 HELPER FUNCTIONS
// =============================================================================

/**
 * Konvertiert lokalen Status zu Remote-Status
 */
export function mapStatusToRemote(localStatus: string): string {
  return STATUS_MAP_TO_REMOTE[localStatus] ?? localStatus;
}

/**
 * Konvertiert Remote-Status zu lokalem Status
 */
export function mapStatusToLocal(remoteStatus: string): string {
  return STATUS_MAP_TO_LOCAL[remoteStatus] ?? remoteStatus;
}

/**
 * Konvertiert lokale Priorität zu Remote-Priorität
 */
export function mapPriorityToRemote(localPriority: string): string {
  return PRIORITY_MAP_TO_REMOTE[localPriority] ?? localPriority;
}

/**
 * Konvertiert Remote-Priorität zu lokaler Priorität
 */
export function mapPriorityToLocal(remotePriority: string): string {
  return PRIORITY_MAP_TO_LOCAL[remotePriority] ?? remotePriority;
}

/**
 * Prüft ob ein Event-Typ ein Push-Event ist
 */
export function isPushEventType(type: string): type is PushEventType {
  const validTypes: PushEventType[] = [
    'ticket_created',
    'ticket_updated',
    'status_changed',
    'ticket_claimed',
    'ticket_unclaimed',
    'ticket_completed',
    'ticket_deleted',
    'label_added',
    'label_removed',
  ];
  return validTypes.includes(type as PushEventType);
}
