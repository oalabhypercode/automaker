/**
 * ⚙️ Sync Configuration
 *
 * Konfigurationsschema und Validation für Auto-Sync Einstellungen.
 * Unterstützt globale und projekt-spezifische Konfiguration.
 *
 * @see docs/pg-online-sync/tasks/phase-1.5-auto-sync.md
 */

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Konflikt-Auflösungsstrategie
 */
export type SyncConflictStrategy = 'remote_wins' | 'local_wins' | 'manual';

/**
 * Verfügbare Sync-Intervalle in Millisekunden
 */
export type SyncIntervalPreset =
  | 900000 // 15 Minuten
  | 1800000 // 30 Minuten
  | 3600000 // 60 Minuten (Standard)
  | 7200000 // 2 Stunden
  | 14400000 // 4 Stunden
  | 0; // Nur manuell

/**
 * Globale Sync-Konfiguration
 * Wird in data/settings.json gespeichert
 */
export interface GlobalSyncConfig {
  /** Sync generell aktiviert */
  readonly enabled: boolean;

  /** Standard-Intervall für neue Projekte (ms) */
  readonly defaultInterval: number;

  /** Bei App-Start synchronisieren */
  readonly syncOnStart: boolean;

  /** Toast-Benachrichtigungen bei Änderungen */
  readonly notifyOnChanges: boolean;

  /** Background-Sync (Electron only) */
  readonly backgroundSync: boolean;

  /** Desktop-Benachrichtigungen aktiviert */
  readonly desktopNotifications: boolean;
}

/**
 * Projekt-spezifische Sync-Konfiguration
 * Wird in .automaker/settings.json pro Projekt gespeichert
 */
export interface ProjectSyncConfig {
  /** Sync für dieses Projekt aktiviert */
  readonly enabled: boolean;

  /** Remote Projekt-ID */
  readonly projectId: string;

  /** Sync-Intervall (überschreibt global, ms) */
  readonly interval: number;

  /** Automatisch pushen bei lokalen Änderungen */
  readonly pushAutomatically: boolean;

  /** Automatisch pullen im Intervall */
  readonly pullAutomatically: boolean;

  /** Konflikt-Auflösungsstrategie */
  readonly conflictStrategy: SyncConflictStrategy;

  /** Letzter Sync-Zeitpunkt (ISO) */
  readonly lastSyncAt: string | null;
}

/**
 * Retry-Konfiguration für fehlgeschlagene Operationen
 */
export interface RetryConfig {
  /** Maximale Anzahl Retry-Versuche */
  readonly maxAttempts: number;

  /** Basis-Delay in ms (wird exponentiell erhöht) */
  readonly baseDelay: number;

  /** Maximaler Delay in ms */
  readonly maxDelay: number;

  /** Jitter-Faktor (0-1) für zufällige Verzögerung */
  readonly jitterFactor: number;
}

/**
 * Komplette Sync-Konfiguration (kombiniert)
 */
export interface SyncConfig {
  readonly global: GlobalSyncConfig;
  readonly project: ProjectSyncConfig | null;
  readonly retry: RetryConfig;
}

// =============================================================================
// 📊 CONSTANTS
// =============================================================================

/**
 * Standard globale Sync-Konfiguration
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalSyncConfig = {
  enabled: true,
  defaultInterval: 3600000, // 1 Stunde
  syncOnStart: true,
  notifyOnChanges: true,
  backgroundSync: false,
  desktopNotifications: false,
} as const;

/**
 * Standard Projekt-Sync-Konfiguration
 */
export const DEFAULT_PROJECT_CONFIG: Omit<ProjectSyncConfig, 'projectId'> = {
  enabled: true,
  interval: 3600000, // 1 Stunde
  pushAutomatically: true,
  pullAutomatically: true,
  conflictStrategy: 'remote_wins',
  lastSyncAt: null,
} as const;

/**
 * Standard Retry-Konfiguration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelay: 1000, // 1 Sekunde
  maxDelay: 60000, // 1 Minute
  jitterFactor: 0.1, // 10% Jitter
} as const;

/**
 * Verfügbare Intervall-Optionen (für UI)
 */
export const SYNC_INTERVAL_OPTIONS = [
  { value: 900000, label: '15 Minuten' },
  { value: 1800000, label: '30 Minuten' },
  { value: 3600000, label: '60 Minuten (empfohlen)' },
  { value: 7200000, label: '2 Stunden' },
  { value: 14400000, label: '4 Stunden' },
  { value: 0, label: 'Nur manuell' },
] as const;

/**
 * Konflikt-Strategie-Optionen (für UI)
 */
export const CONFLICT_STRATEGY_OPTIONS = [
  { value: 'remote_wins', label: 'Remote-Änderungen bevorzugen' },
  { value: 'local_wins', label: 'Lokale Änderungen bevorzugen' },
  { value: 'manual', label: 'Manuell entscheiden' },
] as const;

// =============================================================================
// 🛠️ FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt eine neue Projekt-Sync-Konfiguration
 */
export function createProjectSyncConfig(
  projectId: string,
  overrides?: Partial<Omit<ProjectSyncConfig, 'projectId'>>
): ProjectSyncConfig {
  return {
    ...DEFAULT_PROJECT_CONFIG,
    ...overrides,
    projectId,
  };
}

/**
 * Erstellt eine komplette Sync-Konfiguration
 */
export function createSyncConfig(
  global?: Partial<GlobalSyncConfig>,
  project?: ProjectSyncConfig | null,
  retry?: Partial<RetryConfig>
): SyncConfig {
  return {
    global: { ...DEFAULT_GLOBAL_CONFIG, ...global },
    project: project ?? null,
    retry: { ...DEFAULT_RETRY_CONFIG, ...retry },
  };
}

/**
 * Berechnet das effektive Intervall (Projekt überschreibt Global)
 */
export function getEffectiveInterval(config: SyncConfig): number {
  if (!config.global.enabled) {
    return 0;
  }

  if (config.project?.enabled === false) {
    return 0;
  }

  return config.project?.interval ?? config.global.defaultInterval;
}

/**
 * Prüft ob Sync für eine Konfiguration aktiv ist
 */
export function isSyncEnabled(config: SyncConfig): boolean {
  return config.global.enabled && (config.project?.enabled ?? true);
}

// =============================================================================
// 🔢 BACKOFF CALCULATION
// =============================================================================

/**
 * Berechnet Exponential Backoff Delay
 *
 * @param attempt - Aktueller Versuch (0-basiert)
 * @param config - Retry-Konfiguration
 * @returns Delay in Millisekunden
 */
export function calculateBackoff(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponentieller Delay: baseDelay * 2^attempt
  const exponentialDelay = config.baseDelay * Math.pow(2, attempt);

  // Jitter hinzufügen (zufällige Verzögerung um Thundering Herd zu vermeiden)
  const jitter = exponentialDelay * config.jitterFactor * Math.random();

  // Max Delay nicht überschreiten
  return Math.min(exponentialDelay + jitter, config.maxDelay);
}

/**
 * Prüft ob Retry noch erlaubt ist
 */
export function canRetry(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): boolean {
  return attempt < config.maxAttempts;
}

// =============================================================================
// 📦 VALIDATION
// =============================================================================

/**
 * Validiert eine Sync-Konfiguration
 */
export function validateSyncConfig(config: unknown): config is SyncConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const c = config as Record<string, unknown>;

  // Global Config prüfen
  if (!c.global || typeof c.global !== 'object') {
    return false;
  }

  const global = c.global as Record<string, unknown>;
  if (typeof global.enabled !== 'boolean') return false;
  if (typeof global.defaultInterval !== 'number') return false;
  if (typeof global.syncOnStart !== 'boolean') return false;

  // Retry Config prüfen
  if (!c.retry || typeof c.retry !== 'object') {
    return false;
  }

  const retry = c.retry as Record<string, unknown>;
  if (typeof retry.maxAttempts !== 'number') return false;
  if (typeof retry.baseDelay !== 'number') return false;

  return true;
}

/**
 * Validiert ein Sync-Intervall
 */
export function validateInterval(interval: number): boolean {
  return interval >= 0 && interval <= 86400000; // Max 24 Stunden
}

/**
 * Formatiert Intervall für Anzeige
 */
export function formatInterval(ms: number): string {
  if (ms === 0) return 'Nur manuell';

  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} Minuten`;

  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 Stunde';
  return `${hours} Stunden`;
}
