/**
 * 🔌 Module Augmentation
 *
 * Erweitert bestehende Types ohne sie zu ändern.
 *
 * ⚠️ HINWEIS: Die eigentliche Module Augmentation für @automaker/types
 * wird erst aktiviert, wenn das Module existiert. Aktuell enthält diese
 * Datei die Sync-Metadaten-Types die eigenständig verwendet werden können.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 * @see docs/pg-online-sync/tasks/phase-0.3-erweiterungsstrategie.md
 */

import type { SyncStatus } from './sync.types.js';

// =============================================================================
// 🏷️ SYNC METADATA TYPES
// =============================================================================

/**
 * Sync-Metadaten die jedem synced Entity hinzugefügt werden
 *
 * Diese Felder werden Entities hinzugefügt, die zwischen
 * lokalem Storage und Postgres synchronisiert werden.
 */
export interface SyncMetadata {
  /** Remote-ID in Postgres (UUID) */
  syncId?: string;
  /** Aktueller Sync-Status */
  syncStatus?: SyncStatus;
  /** Letzte Synchronisation (ISO String) */
  lastSyncedAt?: string;
  /** Version auf dem Server */
  remoteVersion?: number;
  /** Lokale Version (für Konflikt-Erkennung) */
  localVersion?: number;
  /** Hat ungesyncte Änderungen? */
  isDirty?: boolean;
}

/**
 * Fügt SyncMetadata zu einem beliebigen Typ hinzu
 *
 * @template T - Der Basis-Typ
 *
 * @example
 * ```typescript
 * interface LocalFeature {
 *   id: string;
 *   title: string;
 * }
 *
 * type SyncableFeature = Syncable<LocalFeature>;
 * // Jetzt hat SyncableFeature auch syncId, syncStatus, etc.
 * ```
 */
export type Syncable<T> = T & SyncMetadata;

// =============================================================================
// 🔍 TYPE GUARDS
// =============================================================================

/**
 * Prüft ob ein Objekt SyncMetadata hat
 *
 * @param obj - Zu prüfendes Objekt
 * @returns true wenn das Objekt eine syncId-Property hat
 */
export function hasSyncMetadata(obj: unknown): obj is { syncId?: string } {
  return typeof obj === 'object' && obj !== null && 'syncId' in obj;
}

/**
 * Prüft ob ein Objekt erfolgreich gesynced ist
 *
 * @param obj - Zu prüfendes Objekt
 * @returns true wenn syncId existiert und Status 'idle' ist
 */
export function isSynced(obj: unknown): boolean {
  if (!hasSyncMetadata(obj)) return false;
  return obj.syncId !== undefined && (obj as SyncMetadata).syncStatus === 'idle';
}

/**
 * Prüft ob ein Objekt ungesyncte Änderungen hat
 *
 * @param obj - Zu prüfendes Objekt
 * @returns true wenn isDirty === true
 */
export function isDirty(obj: unknown): boolean {
  if (!hasSyncMetadata(obj)) return false;
  return (obj as SyncMetadata).isDirty === true;
}

// =============================================================================
// 🏭 HELPER FUNCTIONS
// =============================================================================

/**
 * Fügt Standard-SyncMetadata zu einem Objekt hinzu
 *
 * Macht ein beliebiges Objekt sync-fähig mit initialen Metadaten.
 *
 * @param obj - Das Objekt das sync-fähig gemacht werden soll
 * @returns Das Objekt mit SyncMetadata
 *
 * @example
 * ```typescript
 * const feature = { id: '1', title: 'Test' };
 * const syncableFeature = addSyncMetadata(feature);
 * console.log(syncableFeature.syncStatus); // 'idle'
 * console.log(syncableFeature.isDirty); // true
 * ```
 */
export function addSyncMetadata<T>(obj: T): Syncable<T> {
  return {
    ...obj,
    syncStatus: 'idle' as SyncStatus,
    localVersion: 1,
    isDirty: true,
  };
}

/**
 * Markiert ein Objekt als erfolgreich gesynced
 *
 * Wird nach einem erfolgreichen Push/Pull aufgerufen.
 *
 * @param obj - Das Objekt mit SyncMetadata
 * @param syncId - Die Remote-ID aus Postgres
 * @param remoteVersion - Die Version auf dem Server
 * @returns Das aktualisierte Objekt
 */
export function markAsSynced<T extends SyncMetadata>(
  obj: T,
  syncId: string,
  remoteVersion: number
): T {
  return {
    ...obj,
    syncId,
    syncStatus: 'idle' as SyncStatus,
    lastSyncedAt: new Date().toISOString(),
    remoteVersion,
    isDirty: false,
  };
}

/**
 * Markiert ein Objekt als dirty (lokale Änderung)
 *
 * Wird aufgerufen wenn eine lokale Änderung gemacht wird.
 * Erhöht die localVersion für Konflikt-Erkennung.
 *
 * @param obj - Das Objekt das geändert wurde
 * @returns Das Objekt mit erhöhter Version und isDirty=true
 */
export function markAsDirty<T extends SyncMetadata>(obj: T): T {
  return {
    ...obj,
    isDirty: true,
    localVersion: (obj.localVersion ?? 0) + 1,
  };
}

/**
 * Extrahiert SyncMetadata aus einem Objekt
 *
 * Nützlich für Debugging oder Logging.
 *
 * @param obj - Das Objekt von dem Metadaten extrahiert werden
 * @returns Die SyncMetadata oder null wenn keine vorhanden
 */
export function extractSyncMetadata(obj: unknown): SyncMetadata | null {
  if (!hasSyncMetadata(obj)) return null;

  const sync = obj as SyncMetadata;
  return {
    syncId: sync.syncId,
    syncStatus: sync.syncStatus,
    lastSyncedAt: sync.lastSyncedAt,
    remoteVersion: sync.remoteVersion,
    localVersion: sync.localVersion,
    isDirty: sync.isDirty,
  };
}

// =============================================================================
// 📝 MODULE AUGMENTATION TEMPLATE
// =============================================================================

/**
 * Template für Module Augmentation
 *
 * Wenn @automaker/types existiert, kann folgendes in einer separaten
 * .d.ts Datei verwendet werden:
 *
 * ```typescript
 * // libs/pg-sync/src/types/automaker-augment.d.ts
 * import type { SyncStatus } from './sync.types.js';
 *
 * declare module '@automaker/types' {
 *   interface Feature {
 *     syncId?: string;
 *     syncStatus?: SyncStatus;
 *     lastSyncedAt?: string;
 *     remoteVersion?: number;
 *     localVersion?: number;
 *     isDirty?: boolean;
 *   }
 * }
 * ```
 */
