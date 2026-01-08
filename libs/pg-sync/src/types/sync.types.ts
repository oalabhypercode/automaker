/**
 * 🔄 Sync Types
 *
 * Typdefinitionen für den Sync-Mechanismus (Push/Pull).
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 🔄 SYNC STATE
// =============================================================================

/**
 * Sync-Status eines Clients
 */
export interface SyncState {
  /** Eindeutige Client-ID */
  clientId: string;
  /** Projekt-Kontext */
  projectId: string;
  /** Letzter Pull (ISO String) */
  lastPulledAt: string | null;
  /** Letzter Push (ISO String) */
  lastPushedAt: string | null;
  /** ID des letzten verarbeiteten Events */
  lastEventId: string | null;
  /** Aktueller Status */
  status: SyncStatus;
}

/**
 * Mögliche Sync-Zustände
 */
export type SyncStatus =
  | 'idle' // Bereit, nichts passiert
  | 'pushing' // Push läuft
  | 'pulling' // Pull läuft
  | 'error' // Fehler aufgetreten
  | 'offline'; // Keine Verbindung

/**
 * Array aller Sync-Status (für Validierung)
 */
export const SYNC_STATUSES: readonly SyncStatus[] = [
  'idle',
  'pushing',
  'pulling',
  'error',
  'offline',
] as const;

// =============================================================================
// ⚙️ SYNC CONFIG
// =============================================================================

/**
 * Sync-Konfiguration
 */
export interface SyncConfig {
  /** Sync aktiviert? */
  enabled: boolean;
  /** Automatischer Sync bei Änderungen? */
  autoSync: boolean;
  /** Sync-Intervall in Millisekunden */
  intervalMs: number;
  /** Konflikt-Strategie */
  conflictStrategy: ConflictStrategy;
  /** Retry-Konfiguration */
  retry: RetryConfig;
}

/**
 * Konflikt-Auflösungs-Strategie
 */
export type ConflictStrategy =
  | 'local_wins' // Lokale Änderung gewinnt
  | 'remote_wins' // Remote-Änderung gewinnt
  | 'manual'; // Manuelle Auflösung

/**
 * Array aller Konflikt-Strategien (für Validierung)
 */
export const CONFLICT_STRATEGIES: readonly ConflictStrategy[] = [
  'local_wins',
  'remote_wins',
  'manual',
] as const;

/**
 * Retry-Konfiguration für fehlgeschlagene Syncs
 */
export interface RetryConfig {
  /** Maximale Anzahl Versuche */
  maxRetries: number;
  /** Basis-Wartezeit in MS */
  baseDelayMs: number;
  /** Maximale Wartezeit in MS */
  maxDelayMs: number;
  /** Exponential Backoff Factor */
  backoffFactor: number;
}

// =============================================================================
// 📤 OUTBOX
// =============================================================================

/**
 * Ein Item in der Outbox-Queue (für Push)
 */
export interface OutboxItem {
  /** Eindeutige ID (UUID) */
  id: string;
  /** Das zu synchronisierende Event */
  eventId: string;
  /** Entity-Typ (project, ticket, etc.) */
  entityType: EntityType;
  /** Entity-ID */
  entityId: string;
  /** Operation-Typ */
  operation: SyncOperation;
  /** Payload-Daten */
  payload: unknown;
  /** Status des Items */
  status: OutboxStatus;
  /** Anzahl Versuche */
  retries: number;
  /** Letzter Fehler (wenn vorhanden) */
  lastError?: string;
  /** Erstellt am */
  createdAt: string;
  /** Nächster Versuch (ISO String) */
  nextRetryAt?: string;
}

/**
 * Entity-Typen für Sync
 */
export type EntityType = 'project' | 'ticket' | 'user' | 'event';

/**
 * Sync-Operationen
 */
export type SyncOperation = 'create' | 'update' | 'delete';

/**
 * Outbox-Item Status
 */
export type OutboxStatus =
  | 'pending' // Wartet auf Sync
  | 'processing' // Wird gerade gesynced
  | 'completed' // Erfolgreich gesynced
  | 'failed' // Endgültig fehlgeschlagen
  | 'retry'; // Wartet auf Retry

// =============================================================================
// 📥 PULL RESPONSE
// =============================================================================

/**
 * Antwort auf Pull-Request
 */
export interface PullResponse {
  /** Events seit letztem Pull */
  events: SyncEvent[];
  /** Neue lastEventId */
  lastEventId: string | null;
  /** Gibt es mehr Events? (Pagination) */
  hasMore: boolean;
  /** Server-Timestamp */
  serverTime: string;
}

/**
 * Ein Sync-Event (kommt vom Server)
 */
export interface SyncEvent {
  /** Event-ID */
  id: string;
  /** Entity-Typ */
  entityType: EntityType;
  /** Entity-ID */
  entityId: string;
  /** Operation */
  operation: SyncOperation;
  /** Payload-Daten */
  payload: unknown;
  /** Erstellt am */
  createdAt: string;
  /** Erstellt von (User-ID) */
  createdBy: string;
}

// =============================================================================
// 📤 PUSH REQUEST
// =============================================================================

/**
 * Push-Request zum Server
 */
export interface PushRequest {
  /** Client-ID */
  clientId: string;
  /** Projekt-ID */
  projectId: string;
  /** Events zum Pushen */
  events: SyncEvent[];
}

/**
 * Push-Response vom Server
 */
export interface PushResponse {
  /** Erfolgreich? */
  success: boolean;
  /** Anzahl verarbeiteter Events */
  processedCount: number;
  /** Konflikte (wenn vorhanden) */
  conflicts?: SyncConflict[];
  /** Server-Timestamp */
  serverTime: string;
}

// =============================================================================
// ⚔️ CONFLICTS
// =============================================================================

/**
 * Ein Sync-Konflikt
 */
export interface SyncConflict {
  /** Entity-Typ */
  entityType: EntityType;
  /** Entity-ID */
  entityId: string;
  /** Lokale Version */
  localVersion: unknown;
  /** Remote Version */
  remoteVersion: unknown;
  /** Konflikt-Zeitpunkt */
  detectedAt: string;
  /** Konflikt-Status */
  status: ConflictStatus;
  /** Gelöst durch (User-ID) */
  resolvedBy?: string;
  /** Gelöst am */
  resolvedAt?: string;
}

/**
 * Konflikt-Status
 */
export type ConflictStatus =
  | 'pending' // Noch nicht gelöst
  | 'resolved_local' // Lokale Version gewählt
  | 'resolved_remote' // Remote Version gewählt
  | 'resolved_merged'; // Manuell gemerged

// =============================================================================
// 👥 PRESENCE TYPES (Supabase Realtime)
// =============================================================================

/**
 * User-Presence für Live-Anzeige auf Tickets
 * Wird für Soft-Lock ohne DB verwendet.
 */
export interface TicketPresenceState {
  /** User-ID */
  userId: string;
  /** Username für Display */
  userName: string;
  /** User-Avatar URL */
  userAvatar?: string;
  /** Aktueller Modus */
  mode: PresenceMode;
  /** Ticket-ID auf dem der User ist */
  ticketId: string;
  /** Projekt-ID für Channel-Scoping */
  projectId: string;
  /** Zuletzt aktiv (ISO String) */
  activeAt: string;
}

/**
 * Presence-Modi für unterschiedliche Lock-Stärken
 */
export type PresenceMode =
  | 'viewing' // Nur anschauen (kein Lock)
  | 'editing'; // Aktiv bearbeiten (Soft-Lock Warnung)

/**
 * Array aller Presence-Modi (für Validierung)
 */
export const PRESENCE_MODES: readonly PresenceMode[] = ['viewing', 'editing'] as const;

/**
 * Aggregierte Presence für ein Ticket
 */
export interface TicketPresenceInfo {
  /** Ticket-ID */
  ticketId: string;
  /** Alle aktiven User auf diesem Ticket */
  activeUsers: TicketPresenceState[];
  /** Ist jemand im Editing-Modus? */
  hasEditor: boolean;
  /** Wer editiert gerade (falls vorhanden) */
  currentEditor?: TicketPresenceState;
}

/**
 * Erstellt einen neuen TicketPresenceState
 */
export function createTicketPresence(
  userId: string,
  userName: string,
  ticketId: string,
  projectId: string,
  mode: PresenceMode = 'viewing',
  userAvatar?: string
): TicketPresenceState {
  return {
    userId,
    userName,
    userAvatar,
    mode,
    ticketId,
    projectId,
    activeAt: new Date().toISOString(),
  };
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Standard-Werte für SyncConfig
 */
export function getDefaultSyncConfig(): SyncConfig {
  return {
    enabled: true,
    autoSync: true,
    intervalMs: 60_000, // 1 Minute
    conflictStrategy: 'remote_wins',
    retry: {
      maxRetries: 3,
      baseDelayMs: 1_000,
      maxDelayMs: 30_000,
      backoffFactor: 2,
    },
  };
}

/**
 * Erstellt einen neuen SyncState
 */
export function createSyncState(clientId: string, projectId: string): SyncState {
  return {
    clientId,
    projectId,
    lastPulledAt: null,
    lastPushedAt: null,
    lastEventId: null,
    status: 'idle',
  };
}

/**
 * Erstellt ein neues OutboxItem
 */
export function createOutboxItem(
  partial: Pick<OutboxItem, 'eventId' | 'entityType' | 'entityId' | 'operation' | 'payload'>
): OutboxItem {
  return {
    id: crypto.randomUUID(),
    ...partial,
    status: 'pending',
    retries: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Berechnet nächste Retry-Zeit mit Exponential Backoff
 */
export function calculateNextRetry(retries: number, config: RetryConfig): string {
  const delay = Math.min(
    config.baseDelayMs * Math.pow(config.backoffFactor, retries),
    config.maxDelayMs
  );
  return new Date(Date.now() + delay).toISOString();
}
