/**
 * 📐 Pull Types
 *
 * TypeScript-Definitionen für den Pull-Mechanismus.
 * API-Responses, Event-Typen, Mapping-Strukturen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type { PushEventType, ConflictResolutionStrategy } from './types.js';

// =============================================================================
// 🔄 PULL CONFIGURATION
// =============================================================================

/**
 * Pull-Konfiguration
 */
export interface PullConfig {
  /**
   * Max Events pro Pull-Request
   * @default 1000
   */
  batchSize: number;

  /**
   * Max parallele Feature-Erstellungen
   * @default 5
   */
  concurrency: number;

  /**
   * Timeout für Pull-Request in ms
   * @default 30000
   */
  timeoutMs: number;

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
 * Default Pull-Konfiguration
 */
export const DEFAULT_PULL_CONFIG: PullConfig = {
  batchSize: 1000,
  concurrency: 5,
  timeoutMs: 30_000,
  conflictStrategy: 'remote_wins',
  apiBaseUrl: '/api/pg-sync',
};

// =============================================================================
// 📥 API RESPONSE TYPES
// =============================================================================

/**
 * Remote Event aus der Pull-Response
 */
export interface RemoteEvent {
  id: string;
  type: PushEventType;
  ticketId: string;
  projectId: string;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

/**
 * Remote Ticket aus der Pull-Response
 */
export interface RemoteTicket {
  id: string;
  localId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  labels: string[];
  createdBy: string;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Pull-Request Query Parameter
 */
export interface PullRequestParams {
  projectId: string;
  since: string;
  limit?: number;
  cursor?: string;
}

/**
 * Pull-Response vom Server
 */
export interface PullResponsePayload {
  success: boolean;
  data: {
    events: RemoteEvent[];
    newTickets: RemoteTicket[];
    hasMore: boolean;
    cursor: string | null;
    serverTime: string;
  };
  error?: string;
}

// =============================================================================
// 📊 PULL STATUS
// =============================================================================

/**
 * Aktueller Pull-Status
 */
export interface PullStatus {
  isProcessing: boolean;
  eventsTotal: number;
  eventsProcessed: number;
  ticketsCreated: number;
  ticketsUpdated: number;
  progress: number;
  currentPhase: 'idle' | 'fetching' | 'processing' | 'creating' | 'complete' | 'error';
  lastError: string | null;
  startedAt: Date | null;
}

/**
 * Pull-Ergebnis nach Verarbeitung
 */
export interface PullProcessResult {
  success: boolean;
  eventsProcessed: number;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsSkipped: number;
  conflicts: number;
  duration: number;
  errors: PullProcessError[];
}

/**
 * Fehler beim Verarbeiten
 */
export interface PullProcessError {
  eventId?: string;
  ticketId?: string;
  error: string;
  recoverable: boolean;
}

// =============================================================================
// 🗺️ ID MAPPING TYPES
// =============================================================================

/**
 * ID-Mapping-Struktur für Persistenz
 */
export interface IdMappingStore {
  remoteToLocal: Record<string, string>;
  localToRemote: Record<string, string>;
  lastUpdatedAt: string;
}

/**
 * Einzelnes ID-Mapping
 */
export interface IdMapping {
  localId: string;
  remoteId: string;
  createdAt: Date;
}

// =============================================================================
// 📋 SYNC STATE TYPES
// =============================================================================

/**
 * Sync-State pro Projekt (lokale Speicherung)
 */
export interface ProjectSyncState {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastEventId: string | null;
  pullCount: number;
  pushCount: number;
}

/**
 * Globaler Sync-State (lokal gespeichert)
 */
export interface LocalSyncState {
  clientId: string;
  projects: Record<string, ProjectSyncState>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Update für Sync-State
 */
export interface SyncStateUpdate {
  lastPulledAt?: string;
  lastPushedAt?: string;
  lastEventId?: string;
  incrementPull?: boolean;
  incrementPush?: boolean;
}

// =============================================================================
// 🎯 LOCAL FEATURE TYPES
// =============================================================================

/**
 * Lokale Feature-Struktur (Automaker Feature-Format)
 */
export interface LocalFeatureData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  labels: string[];
  syncId: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'local_only';
  lastSyncedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
}

/**
 * Feature-Erstellung aus Remote-Ticket
 */
export interface CreateLocalFeatureInput {
  remoteTicket: RemoteTicket;
  projectId: string;
}

/**
 * Feature-Update aus Remote-Daten
 */
export interface UpdateLocalFeatureInput {
  localId: string;
  remoteTicket: RemoteTicket;
  changedFields: string[];
}

// =============================================================================
// 🔄 EVENT PROCESSING TYPES
// =============================================================================

/**
 * Ergebnis einer Event-Verarbeitung
 */
export interface EventProcessResult {
  eventId: string;
  success: boolean;
  action: 'created' | 'updated' | 'skipped' | 'conflict' | 'error';
  localId?: string;
  error?: string;
}

/**
 * Event-Handler Funktion
 */
export type EventHandler = (event: RemoteEvent) => Promise<EventProcessResult>;

/**
 * Event-Handler Registry
 */
export type EventHandlerRegistry = Partial<Record<PushEventType, EventHandler>>;

// =============================================================================
// 🔧 HELPER TYPES
// =============================================================================

/**
 * Pull-Optionen für einen einzelnen Pull-Request
 */
export interface SinglePullOptions {
  projectId: string;
  force?: boolean;
  skipPushFirst?: boolean;
}

/**
 * Pull-Trigger Typ
 */
export type PullTrigger = 'manual' | 'app_start' | 'timer' | 'after_push' | 'network_reconnect';

/**
 * Pull-Event für Callbacks
 */
export interface PullEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  trigger: PullTrigger;
  projectId: string;
  status: PullStatus;
  result?: PullProcessResult;
}

/**
 * Pull-Event Callback
 */
export type PullEventCallback = (event: PullEvent) => void;
