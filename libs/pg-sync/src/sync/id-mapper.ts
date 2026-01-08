/**
 * 🗺️ ID Mapper
 *
 * Bidirektionales Mapping zwischen Remote-IDs (Postgres) und Local-IDs.
 * Persistiert Mappings in JSON-Datei für Wiederverwendung.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type { IdMappingStore, IdMapping } from './pull-types.js';

// =============================================================================
// 📐 CONFIGURATION
// =============================================================================

/**
 * ID Mapper Konfiguration
 */
export interface IdMapperConfig {
  /**
   * Pfad zur Mapping-Datei
   * @default '.automaker/sync-mappings.json'
   */
  storagePath: string;

  /**
   * Callback zum Laden der Datei
   */
  readFile: (path: string) => Promise<string | null>;

  /**
   * Callback zum Speichern der Datei
   */
  writeFile: (path: string, content: string) => Promise<void>;
}

// =============================================================================
// 🗺️ ID MAPPER CLASS
// =============================================================================

/**
 * ID Mapper für Remote ↔ Local ID Konvertierung
 *
 * @example
 * ```ts
 * const mapper = createIdMapper({
 *   storagePath: '.automaker/sync-mappings.json',
 *   readFile: async (p) => fs.readFile(p, 'utf-8'),
 *   writeFile: async (p, c) => fs.writeFile(p, c),
 * });
 *
 * await mapper.load();
 * mapper.setMapping('local-123', 'remote-456');
 * const local = mapper.getLocalId('remote-456');
 * ```
 */
export class IdMapper {
  private store: IdMappingStore;
  private isDirty = false;

  constructor(private readonly config: IdMapperConfig) {
    this.store = this.createEmptyStore();
  }

  // ---------------------------------------------------------------------------
  // 📂 PERSISTENCE
  // ---------------------------------------------------------------------------

  /**
   * Lädt Mappings aus der Datei
   */
  async load(): Promise<void> {
    try {
      const content = await this.config.readFile(this.config.storagePath);

      if (content) {
        const parsed = JSON.parse(content) as IdMappingStore;
        this.validateStore(parsed);
        this.store = parsed;
      }
    } catch {
      // Datei existiert nicht oder ungültig - leeren Store verwenden
      this.store = this.createEmptyStore();
    }
  }

  /**
   * Speichert Mappings in die Datei
   */
  async save(): Promise<void> {
    if (!this.isDirty) return;

    this.store.lastUpdatedAt = new Date().toISOString();
    const content = JSON.stringify(this.store, null, 2);
    await this.config.writeFile(this.config.storagePath, content);
    this.isDirty = false;
  }

  /**
   * Lädt und speichert automatisch nach Operation
   */
  async withAutoSave<T>(operation: () => T): Promise<T> {
    const result = operation();
    await this.save();
    return result;
  }

  // ---------------------------------------------------------------------------
  // 🔍 LOOKUP METHODS
  // ---------------------------------------------------------------------------

  /**
   * Gibt die lokale ID für eine Remote-ID zurück
   */
  getLocalId(remoteId: string): string | null {
    return this.store.remoteToLocal[remoteId] ?? null;
  }

  /**
   * Gibt die Remote-ID für eine lokale ID zurück
   */
  getRemoteId(localId: string): string | null {
    return this.store.localToRemote[localId] ?? null;
  }

  /**
   * Prüft ob ein Remote-Mapping existiert
   */
  hasRemoteId(remoteId: string): boolean {
    return remoteId in this.store.remoteToLocal;
  }

  /**
   * Prüft ob ein Local-Mapping existiert
   */
  hasLocalId(localId: string): boolean {
    return localId in this.store.localToRemote;
  }

  // ---------------------------------------------------------------------------
  // ✏️ MODIFICATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Setzt ein bidirektionales Mapping
   */
  setMapping(localId: string, remoteId: string): void {
    // Alte Mappings entfernen falls vorhanden
    this.removeMappingByLocal(localId);
    this.removeMappingByRemote(remoteId);

    // Neue Mappings setzen
    this.store.remoteToLocal[remoteId] = localId;
    this.store.localToRemote[localId] = remoteId;
    this.isDirty = true;
  }

  /**
   * Entfernt Mapping anhand der lokalen ID
   */
  removeMappingByLocal(localId: string): boolean {
    const remoteId = this.store.localToRemote[localId];
    if (!remoteId) return false;

    delete this.store.localToRemote[localId];
    delete this.store.remoteToLocal[remoteId];
    this.isDirty = true;
    return true;
  }

  /**
   * Entfernt Mapping anhand der Remote-ID
   */
  removeMappingByRemote(remoteId: string): boolean {
    const localId = this.store.remoteToLocal[remoteId];
    if (!localId) return false;

    delete this.store.remoteToLocal[remoteId];
    delete this.store.localToRemote[localId];
    this.isDirty = true;
    return true;
  }

  /**
   * Entfernt alle Mappings
   */
  clear(): void {
    this.store = this.createEmptyStore();
    this.isDirty = true;
  }

  // ---------------------------------------------------------------------------
  // 📊 UTILITY METHODS
  // ---------------------------------------------------------------------------

  /**
   * Gibt alle Mappings als Array zurück
   */
  getAllMappings(): IdMapping[] {
    return Object.entries(this.store.localToRemote).map(([localId, remoteId]) => ({
      localId,
      remoteId,
      createdAt: new Date(this.store.lastUpdatedAt),
    }));
  }

  /**
   * Anzahl der gespeicherten Mappings
   */
  get count(): number {
    return Object.keys(this.store.localToRemote).length;
  }

  /**
   * Prüft ob Änderungen vorliegen
   */
  get hasUnsavedChanges(): boolean {
    return this.isDirty;
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private createEmptyStore(): IdMappingStore {
    return {
      remoteToLocal: {},
      localToRemote: {},
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  private validateStore(data: unknown): asserts data is IdMappingStore {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid IdMappingStore: not an object');
    }

    const obj = data as Record<string, unknown>;

    if (typeof obj.remoteToLocal !== 'object' || obj.remoteToLocal === null) {
      throw new Error('Invalid IdMappingStore: missing remoteToLocal');
    }

    if (typeof obj.localToRemote !== 'object' || obj.localToRemote === null) {
      throw new Error('Invalid IdMappingStore: missing localToRemote');
    }
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTION
// =============================================================================

/**
 * Erstellt einen neuen ID Mapper
 */
export function createIdMapper(config: IdMapperConfig): IdMapper {
  return new IdMapper(config);
}

/**
 * Default Speicherpfad (im Automaker-Ordner)
 */
export const DEFAULT_ID_MAPPER_PATH = '.automaker/sync-mappings.json';
