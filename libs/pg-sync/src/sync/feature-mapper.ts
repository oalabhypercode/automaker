/**
 * 🔄 Feature Mapper
 *
 * Konvertiert zwischen Remote-Tickets (Postgres) und lokalen Features.
 * Bidirektionale Transformation mit Status/Priority-Mapping.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type { RemoteTicket, LocalFeatureData } from './pull-types.js';
import {
  mapStatusToLocal,
  mapStatusToRemote,
  mapPriorityToLocal,
  mapPriorityToRemote,
} from './types.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Feature Mapper Konfiguration
 */
export interface FeatureMapperConfig {
  /**
   * Callback zum Generieren einer lokalen ID
   */
  generateLocalId: () => string;

  /**
   * Projekt-ID für neue Features
   */
  projectId: string;
}

/**
 * Partial Update für ein Feature
 */
export interface FeaturePartialUpdate {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  labels?: string[];
  assignedTo?: string | null;
  claimedBy?: string | null;
  claimedAt?: string | null;
  version?: number;
  updatedAt?: string;
}

/**
 * Ticket für Push-Request
 */
export interface TicketForPush {
  localId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  labels: string[];
  version: number;
}

// =============================================================================
// 🔄 FEATURE MAPPER CLASS
// =============================================================================

/**
 * Feature Mapper für Ticket ↔ Feature Konvertierung
 *
 * @example
 * ```ts
 * const mapper = createFeatureMapper({
 *   generateLocalId: () => crypto.randomUUID(),
 *   projectId: 'proj-123',
 * });
 *
 * const feature = mapper.mapTicketToFeature(remoteTicket);
 * const ticketData = mapper.mapFeatureToTicket(localFeature);
 * ```
 */
export class FeatureMapper {
  constructor(private readonly config: FeatureMapperConfig) {}

  // ---------------------------------------------------------------------------
  // 📥 TICKET → FEATURE (Pull)
  // ---------------------------------------------------------------------------

  /**
   * Konvertiert ein Remote-Ticket zu einem lokalen Feature
   */
  mapTicketToFeature(ticket: RemoteTicket): LocalFeatureData {
    const now = new Date().toISOString();

    return {
      id: ticket.localId ?? this.config.generateLocalId(),
      title: ticket.title,
      description: ticket.description,
      status: mapStatusToLocal(ticket.status),
      priority: mapPriorityToLocal(ticket.priority),
      labels: ticket.labels,
      syncId: ticket.id,
      syncStatus: 'synced',
      lastSyncedAt: now,
      version: ticket.version,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      createdBy: ticket.createdBy,
      assignedTo: ticket.assignedTo,
      claimedBy: ticket.claimedBy,
      claimedAt: ticket.claimedAt,
    };
  }

  /**
   * Extrahiert Änderungen aus einem Remote-Ticket
   * für Update eines bestehenden Features
   */
  extractChanges(
    currentFeature: LocalFeatureData,
    remoteTicket: RemoteTicket
  ): FeaturePartialUpdate {
    const changes: FeaturePartialUpdate = {};
    const remoteStatus = mapStatusToLocal(remoteTicket.status);
    const remotePriority = mapPriorityToLocal(remoteTicket.priority);

    if (currentFeature.title !== remoteTicket.title) {
      changes.title = remoteTicket.title;
    }

    if (currentFeature.description !== remoteTicket.description) {
      changes.description = remoteTicket.description;
    }

    if (currentFeature.status !== remoteStatus) {
      changes.status = remoteStatus;
    }

    if (currentFeature.priority !== remotePriority) {
      changes.priority = remotePriority;
    }

    if (!this.arraysEqual(currentFeature.labels, remoteTicket.labels)) {
      changes.labels = remoteTicket.labels;
    }

    if (currentFeature.assignedTo !== remoteTicket.assignedTo) {
      changes.assignedTo = remoteTicket.assignedTo;
    }

    if (currentFeature.claimedBy !== remoteTicket.claimedBy) {
      changes.claimedBy = remoteTicket.claimedBy;
      changes.claimedAt = remoteTicket.claimedAt;
    }

    if (currentFeature.version !== remoteTicket.version) {
      changes.version = remoteTicket.version;
    }

    if (currentFeature.updatedAt !== remoteTicket.updatedAt) {
      changes.updatedAt = remoteTicket.updatedAt;
    }

    return changes;
  }

  /**
   * Wendet Änderungen auf ein Feature an
   */
  applyChanges(feature: LocalFeatureData, changes: FeaturePartialUpdate): LocalFeatureData {
    const now = new Date().toISOString();

    return {
      ...feature,
      ...changes,
      syncStatus: 'synced',
      lastSyncedAt: now,
    };
  }

  /**
   * Prüft ob ein Feature Updates benötigt
   */
  needsUpdate(local: LocalFeatureData, remote: RemoteTicket): boolean {
    const changes = this.extractChanges(local, remote);
    return Object.keys(changes).length > 0;
  }

  // ---------------------------------------------------------------------------
  // 📤 FEATURE → TICKET (Push)
  // ---------------------------------------------------------------------------

  /**
   * Konvertiert ein lokales Feature zu Ticket-Daten für Push
   */
  mapFeatureToTicket(feature: LocalFeatureData): TicketForPush {
    return {
      localId: feature.id,
      title: feature.title,
      description: feature.description,
      status: mapStatusToRemote(feature.status),
      priority: mapPriorityToRemote(feature.priority),
      labels: feature.labels,
      version: feature.version,
    };
  }

  // ---------------------------------------------------------------------------
  // 📊 VERSION COMPARISON
  // ---------------------------------------------------------------------------

  /**
   * Vergleicht Versionen - gibt true zurück wenn remote neuer ist
   */
  isRemoteNewer(local: LocalFeatureData, remote: RemoteTicket): boolean {
    // Version-basierte Vergleich
    if (remote.version > local.version) {
      return true;
    }

    // Bei gleicher Version: updatedAt vergleichen
    if (remote.version === local.version) {
      const localUpdated = new Date(local.updatedAt).getTime();
      const remoteUpdated = new Date(remote.updatedAt).getTime();
      return remoteUpdated > localUpdated;
    }

    return false;
  }

  /**
   * Prüft ob Versionen identisch sind
   */
  versionsMatch(local: LocalFeatureData, remote: RemoteTicket): boolean {
    return local.version === remote.version;
  }

  /**
   * Prüft ob ein Konflikt vorliegt
   * (lokale Änderungen UND remote neuer)
   */
  hasConflict(local: LocalFeatureData, remote: RemoteTicket): boolean {
    const localHasChanges = local.syncStatus === 'pending';
    const remoteIsNewer = this.isRemoteNewer(local, remote);

    return localHasChanges && remoteIsNewer;
  }

  // ---------------------------------------------------------------------------
  // 🔧 UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Erstellt ein neues Feature mit Remote-Sync-Info
   */
  createSyncedFeature(ticket: RemoteTicket, existingLocalId?: string): LocalFeatureData {
    const feature = this.mapTicketToFeature(ticket);

    if (existingLocalId) {
      return { ...feature, id: existingLocalId };
    }

    return feature;
  }

  /**
   * Markiert ein Feature als gesynced
   */
  markAsSynced(feature: LocalFeatureData, remoteId?: string): LocalFeatureData {
    return {
      ...feature,
      syncStatus: 'synced',
      lastSyncedAt: new Date().toISOString(),
      syncId: remoteId ?? feature.syncId,
    };
  }

  /**
   * Markiert ein Feature als pending (ungesyncte Änderungen)
   */
  markAsPending(feature: LocalFeatureData): LocalFeatureData {
    return {
      ...feature,
      syncStatus: 'pending',
    };
  }

  /**
   * Markiert ein Feature als Konflikt
   */
  markAsConflict(feature: LocalFeatureData): LocalFeatureData {
    return {
      ...feature,
      syncStatus: 'conflict',
    };
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((val, i) => val === sortedB[i]);
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTION
// =============================================================================

/**
 * Erstellt einen neuen Feature Mapper
 */
export function createFeatureMapper(config: FeatureMapperConfig): FeatureMapper {
  return new FeatureMapper(config);
}

/**
 * Standard ID-Generator (falls nicht bereitgestellt)
 */
export function defaultIdGenerator(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `feature-${timestamp}-${random}`;
}
