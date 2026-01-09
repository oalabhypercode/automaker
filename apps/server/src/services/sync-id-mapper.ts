/**
 * 🔗 Sync ID Mapper - Bidirektionales Mapping zwischen Remote-IDs und Local-IDs
 *
 * Speichert das Mapping in `.automaker/sync-mapping.json`
 *
 * @see docs/pg-online-sync/tasks/phase-4.4-local-integration.md
 */

import path from 'path';
import { createLogger } from '@automaker/utils';
import { ensureAutomakerDir, getAutomakerDir } from '@automaker/platform';
import * as secureFs from '../lib/secure-fs.js';

const logger = createLogger('SyncIdMapper');

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Ein einzelnes Mapping zwischen lokaler und Remote-ID
 */
export interface IdMapping {
  localId: string; // Lokale Feature-ID
  remoteId: string; // Postgres Ticket-ID
  lastSyncAt: string; // ISO Timestamp
  syncDirection: 'push' | 'pull';
}

/**
 * Das komplette Sync-Mapping für ein Projekt
 */
export interface SyncMapping {
  projectId: string; // Postgres Project ID
  mappings: IdMapping[];
  lastPullAt: string | null;
  lastPushAt: string | null;
}

// =============================================================================
// 🔧 HELPERS
// =============================================================================

/**
 * Gibt den Pfad zur sync-mapping.json Datei zurück
 */
function getSyncMappingPath(projectPath: string): string {
  return path.join(getAutomakerDir(projectPath), 'sync-mapping.json');
}

// =============================================================================
// 📖 LADEN / SPEICHERN
// =============================================================================

/**
 * Lädt das Sync-Mapping aus der Datei
 */
export async function loadSyncMapping(projectPath: string): Promise<SyncMapping | null> {
  try {
    const mappingPath = getSyncMappingPath(projectPath);
    const content = (await secureFs.readFile(mappingPath, 'utf-8')) as string;
    const mapping = JSON.parse(content) as SyncMapping;
    return mapping;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    logger.error('Failed to load sync mapping:', error);
    throw error;
  }
}

/**
 * Speichert das Sync-Mapping in die Datei
 */
export async function saveSyncMapping(projectPath: string, mapping: SyncMapping): Promise<void> {
  try {
    await ensureAutomakerDir(projectPath);
    const mappingPath = getSyncMappingPath(projectPath);
    await secureFs.writeFile(mappingPath, JSON.stringify(mapping, null, 2), 'utf-8');
    logger.info(`Saved sync mapping for project ${mapping.projectId}`);
  } catch (error) {
    logger.error('Failed to save sync mapping:', error);
    throw error;
  }
}

/**
 * Erstellt ein neues, leeres Sync-Mapping
 */
export function createEmptySyncMapping(projectId: string): SyncMapping {
  return {
    projectId,
    mappings: [],
    lastPullAt: null,
    lastPushAt: null,
  };
}

// =============================================================================
// 🔍 SUCHE
// =============================================================================

/**
 * Findet die lokale ID für eine Remote-ID
 */
export function findLocalIdByRemoteId(mapping: SyncMapping, remoteId: string): string | null {
  const found = mapping.mappings.find((m) => m.remoteId === remoteId);
  return found?.localId ?? null;
}

/**
 * Findet die Remote-ID für eine lokale ID
 */
export function findRemoteIdByLocalId(mapping: SyncMapping, localId: string): string | null {
  const found = mapping.mappings.find((m) => m.localId === localId);
  return found?.remoteId ?? null;
}

/**
 * Prüft, ob eine Remote-ID bereits gemappt ist
 */
export function hasRemoteId(mapping: SyncMapping, remoteId: string): boolean {
  return mapping.mappings.some((m) => m.remoteId === remoteId);
}

/**
 * Prüft, ob eine lokale ID bereits gemappt ist
 */
export function hasLocalId(mapping: SyncMapping, localId: string): boolean {
  return mapping.mappings.some((m) => m.localId === localId);
}

// =============================================================================
// ✏️ MODIFIKATION
// =============================================================================

/**
 * Fügt ein neues Mapping hinzu oder aktualisiert ein bestehendes
 */
export function upsertMapping(
  mapping: SyncMapping,
  localId: string,
  remoteId: string,
  syncDirection: 'push' | 'pull'
): SyncMapping {
  const now = new Date().toISOString();
  const existingIndex = mapping.mappings.findIndex(
    (m) => m.localId === localId || m.remoteId === remoteId
  );

  const newMapping: IdMapping = {
    localId,
    remoteId,
    lastSyncAt: now,
    syncDirection,
  };

  const newMappings = [...mapping.mappings];

  if (existingIndex >= 0) {
    newMappings[existingIndex] = newMapping;
  } else {
    newMappings.push(newMapping);
  }

  return {
    ...mapping,
    mappings: newMappings,
    lastPullAt: syncDirection === 'pull' ? now : mapping.lastPullAt,
    lastPushAt: syncDirection === 'push' ? now : mapping.lastPushAt,
  };
}

/**
 * Entfernt ein Mapping anhand der Remote-ID
 */
export function removeMappingByRemoteId(mapping: SyncMapping, remoteId: string): SyncMapping {
  return {
    ...mapping,
    mappings: mapping.mappings.filter((m) => m.remoteId !== remoteId),
  };
}

/**
 * Entfernt ein Mapping anhand der lokalen ID
 */
export function removeMappingByLocalId(mapping: SyncMapping, localId: string): SyncMapping {
  return {
    ...mapping,
    mappings: mapping.mappings.filter((m) => m.localId !== localId),
  };
}

/**
 * Aktualisiert lastPullAt Zeitstempel
 */
export function updateLastPullAt(mapping: SyncMapping): SyncMapping {
  return {
    ...mapping,
    lastPullAt: new Date().toISOString(),
  };
}

/**
 * Aktualisiert lastPushAt Zeitstempel
 */
export function updateLastPushAt(mapping: SyncMapping): SyncMapping {
  return {
    ...mapping,
    lastPushAt: new Date().toISOString(),
  };
}
