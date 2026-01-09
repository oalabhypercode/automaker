/**
 * 🖊️ Feature Writer - Schreibt Remote-Tickets als lokale feature.json Dateien
 *
 * Verantwortlich für:
 * - Konvertierung Remote → Lokal
 * - Ordner-Erstellung
 * - Duplikat-Handling via ID-Mapping
 *
 * @see docs/pg-online-sync/tasks/phase-4.4-local-integration.md
 */

import type { Feature } from '@automaker/types';
import { createLogger } from '@automaker/utils';
import { FeatureLoader } from './feature-loader.js';
import {
  loadSyncMapping,
  saveSyncMapping,
  createEmptySyncMapping,
  findLocalIdByRemoteId,
  upsertMapping,
  updateLastPullAt,
  type SyncMapping,
} from './sync-id-mapper.js';

const logger = createLogger('FeatureWriter');

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Remote Ticket Format (wie von Pull-Route geliefert)
 */
export interface RemoteTicket {
  id: string;
  localId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string[];
  createdBy: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Optionen für das Schreiben eines Features
 */
export interface WriteFeatureOptions {
  projectPath: string; // z.B. "/home/user/projects/finance"
  ticket: RemoteTicket; // Postgres-Ticket
  overwriteExisting?: boolean; // Default: false
  projectId: string; // Postgres Project ID für Mapping
}

/**
 * Ergebnis einer Feature-Schreib-Operation
 */
export interface WriteFeatureResult {
  success: boolean;
  featureId: string;
  action: 'created' | 'updated' | 'skipped';
  path: string;
  error?: string;
}

/**
 * Optionen für Batch-Schreiben
 */
export interface WriteMultipleFeaturesOptions {
  projectPath: string;
  tickets: RemoteTicket[];
  projectId: string;
  overwriteExisting?: boolean;
}

/**
 * Ergebnis einer Batch-Schreib-Operation
 */
export interface WriteMultipleFeaturesResult {
  success: boolean;
  results: WriteFeatureResult[];
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  syncMapping: SyncMapping;
}

// =============================================================================
// 🗺️ MAPPING FUNKTIONEN
// =============================================================================

/**
 * Mappt Remote-Status auf lokalen Status
 *
 * | Remote Status | Lokal Status |
 * |---------------|--------------|
 * | `backlog` | `backlog` |
 * | `todo` | `todo` |
 * | `in_progress` | `in-progress` |
 * | `review` | `review` |
 * | `done` | `done` |
 * | `archived` | `archived` |
 */
function mapRemoteStatusToLocal(remoteStatus: string): string {
  const statusMap: Record<string, string> = {
    backlog: 'backlog',
    todo: 'todo',
    in_progress: 'in-progress',
    review: 'review',
    done: 'done',
    archived: 'archived',
  };
  return statusMap[remoteStatus] ?? 'backlog';
}

/**
 * Mappt Remote-Priorität auf lokale Priorität (Zahl)
 *
 * | Remote Priority | Lokal Priority (Zahl) |
 * |-----------------|----------------------|
 * | `urgent` | 0 |
 * | `high` | 1 |
 * | `medium` | 2 |
 * | `low` | 3 |
 */
function mapRemotePriorityToLocal(remotePriority: string): number {
  const priorityMap: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return priorityMap[remotePriority] ?? 2;
}

/**
 * Konvertiert ein Remote-Ticket in ein lokales Feature
 */
function remoteTicketToFeature(ticket: RemoteTicket, existingFeatureId?: string): Feature {
  const now = new Date().toISOString();

  // Verwende entweder:
  // 1. existingFeatureId (wenn bereits gemappt)
  // 2. ticket.localId (wenn beim Push gesetzt)
  // 3. ticket.id (Remote-ID als Fallback)
  const featureId = existingFeatureId ?? ticket.localId ?? ticket.id;

  return {
    id: featureId,
    title: ticket.title,
    description: ticket.description ?? '',
    category: 'Synced', // Markiert als synchronisiert
    status: mapRemoteStatusToLocal(ticket.status),
    priority: mapRemotePriorityToLocal(ticket.priority),
    // Sync-Metadaten
    remoteId: ticket.id,
    syncedAt: now,
    syncSource: 'remote',
    // Zusätzliche Metadaten
    labels: ticket.labels,
    createdBy: ticket.createdBy ?? undefined,
    claimedBy: ticket.claimedBy ?? undefined,
  };
}

// =============================================================================
// 🖊️ SCHREIB-FUNKTIONEN
// =============================================================================

const featureLoader = new FeatureLoader();

/**
 * Schreibt ein einzelnes Remote-Ticket als lokales Feature
 */
export async function writeFeatureFromTicket(
  options: WriteFeatureOptions
): Promise<WriteFeatureResult> {
  const { projectPath, ticket, overwriteExisting = false, projectId } = options;

  try {
    // 1. Sync-Mapping laden oder erstellen
    let mapping = await loadSyncMapping(projectPath);
    if (!mapping) {
      mapping = createEmptySyncMapping(projectId);
    }

    // 2. Prüfen ob bereits gemappt
    const existingLocalId = findLocalIdByRemoteId(mapping, ticket.id);
    const existingFeature = existingLocalId
      ? await featureLoader.get(projectPath, existingLocalId)
      : null;

    // 3. Entscheidung: erstellen, aktualisieren oder überspringen
    if (existingFeature) {
      if (!overwriteExisting) {
        logger.info(`Skipping ticket ${ticket.id} - already exists as ${existingLocalId}`);
        return {
          success: true,
          featureId: existingLocalId!,
          action: 'skipped',
          path: featureLoader.getFeatureJsonPath(projectPath, existingLocalId!),
        };
      }

      // Aktualisieren
      const updatedFeature = remoteTicketToFeature(ticket, existingLocalId!);
      await featureLoader.update(projectPath, existingLocalId!, updatedFeature);

      // Mapping aktualisieren
      mapping = upsertMapping(mapping, existingLocalId!, ticket.id, 'pull');
      await saveSyncMapping(projectPath, mapping);

      logger.info(`Updated feature ${existingLocalId} from remote ticket ${ticket.id}`);
      return {
        success: true,
        featureId: existingLocalId!,
        action: 'updated',
        path: featureLoader.getFeatureJsonPath(projectPath, existingLocalId!),
      };
    }

    // 4. Neues Feature erstellen
    const newFeature = remoteTicketToFeature(ticket);
    const created = await featureLoader.create(projectPath, newFeature);

    // Mapping speichern
    mapping = upsertMapping(mapping, created.id, ticket.id, 'pull');
    await saveSyncMapping(projectPath, mapping);

    logger.info(`Created feature ${created.id} from remote ticket ${ticket.id}`);
    return {
      success: true,
      featureId: created.id,
      action: 'created',
      path: featureLoader.getFeatureJsonPath(projectPath, created.id),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to write feature from ticket ${ticket.id}:`, error);
    return {
      success: false,
      featureId: ticket.id,
      action: 'skipped',
      path: '',
      error: errorMessage,
    };
  }
}

/**
 * Schreibt mehrere Remote-Tickets als lokale Features
 */
export async function writeMultipleFeaturesFromTickets(
  options: WriteMultipleFeaturesOptions
): Promise<WriteMultipleFeaturesResult> {
  const { projectPath, tickets, projectId, overwriteExisting = false } = options;

  // Mapping einmal laden für alle Tickets
  let mapping = await loadSyncMapping(projectPath);
  if (!mapping) {
    mapping = createEmptySyncMapping(projectId);
  }

  const results: WriteFeatureResult[] = [];
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const ticket of tickets) {
    const result = await writeFeatureFromTicket({
      projectPath,
      ticket,
      overwriteExisting,
      projectId,
    });

    results.push(result);

    if (!result.success) {
      failed++;
    } else {
      switch (result.action) {
        case 'created':
          created++;
          break;
        case 'updated':
          updated++;
          break;
        case 'skipped':
          skipped++;
          break;
      }
    }
  }

  // lastPullAt aktualisieren
  mapping = updateLastPullAt(mapping);
  await saveSyncMapping(projectPath, mapping);

  // Finales Mapping laden (enthält alle neuen Einträge)
  const finalMapping = await loadSyncMapping(projectPath);

  return {
    success: failed === 0,
    results,
    created,
    updated,
    skipped,
    failed,
    syncMapping: finalMapping ?? mapping,
  };
}

/**
 * Findet ein lokales Feature anhand der Remote-ID
 */
export async function findFeatureByRemoteId(
  projectPath: string,
  remoteId: string
): Promise<Feature | null> {
  const mapping = await loadSyncMapping(projectPath);
  if (!mapping) {
    return null;
  }

  const localId = findLocalIdByRemoteId(mapping, remoteId);
  if (!localId) {
    return null;
  }

  return featureLoader.get(projectPath, localId);
}
