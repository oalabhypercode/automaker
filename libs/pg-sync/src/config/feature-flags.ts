/**
 * 🚦 Feature Flags für pg-sync
 *
 * Steuert die Aktivierung von Sync-Features unabhängig vom Kern-System.
 *
 * @see docs/pg-online-sync/tasks/phase-0.3-erweiterungsstrategie.md
 */

// =============================================================================
// 🔧 FEATURE FLAG TYPES
// =============================================================================

/**
 * Konfiguration für das Feature-Flag-System
 */
export interface FeatureFlags {
  /** Sync-System aktiviert? */
  syncEnabled: boolean;
  /** Auto-Sync aktiviert? (Push bei Änderungen) */
  autoSyncEnabled: boolean;
  /** Debug-Modus aktiviert? */
  debugMode: boolean;
  /** Real-time Updates via WebSocket? */
  realtimeEnabled: boolean;
}

/**
 * Standard-Werte für Feature-Flags
 */
const DEFAULT_FLAGS: FeatureFlags = {
  syncEnabled: false,
  autoSyncEnabled: false,
  debugMode: false,
  realtimeEnabled: false,
};

// =============================================================================
// 🚦 FEATURE FLAG FUNCTIONS
// =============================================================================

/**
 * Liest Feature-Flags aus Environment-Variablen
 *
 * @returns Aktuell aktive Feature-Flags
 *
 * @example
 * ```typescript
 * const flags = getFeatureFlags();
 * if (flags.syncEnabled) {
 *   await initSync();
 * }
 * ```
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    syncEnabled: process.env.SYNC_ENABLED === 'true',
    autoSyncEnabled: process.env.AUTO_SYNC_ENABLED === 'true',
    debugMode: process.env.PG_SYNC_DEBUG === 'true',
    realtimeEnabled: process.env.REALTIME_ENABLED === 'true',
  };
}

/**
 * Prüft, ob ein spezifisches Feature aktiviert ist
 *
 * @param flag - Name des Feature-Flags
 * @returns true wenn aktiviert
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('syncEnabled')) {
 *   registerPgSyncRoutes(app);
 * }
 * ```
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[flag] ?? DEFAULT_FLAGS[flag];
}

/**
 * Prüft, ob das Sync-System aktiviert ist
 *
 * Shorthand für `isFeatureEnabled('syncEnabled')`
 *
 * @returns true wenn Sync aktiviert
 */
export function isSyncEnabled(): boolean {
  return isFeatureEnabled('syncEnabled');
}

/**
 * Gibt alle Feature-Flags mit ihren Werten zurück (für Debugging)
 *
 * @returns Objekt mit Flag-Namen und Werten
 */
export function getFeatureFlagsInfo(): Record<string, { value: boolean; source: string }> {
  return {
    syncEnabled: {
      value: process.env.SYNC_ENABLED === 'true',
      source: process.env.SYNC_ENABLED ? 'env' : 'default',
    },
    autoSyncEnabled: {
      value: process.env.AUTO_SYNC_ENABLED === 'true',
      source: process.env.AUTO_SYNC_ENABLED ? 'env' : 'default',
    },
    debugMode: {
      value: process.env.PG_SYNC_DEBUG === 'true',
      source: process.env.PG_SYNC_DEBUG ? 'env' : 'default',
    },
    realtimeEnabled: {
      value: process.env.REALTIME_ENABLED === 'true',
      source: process.env.REALTIME_ENABLED ? 'env' : 'default',
    },
  };
}

// =============================================================================
// 🧪 TESTING UTILITIES
// =============================================================================

/**
 * Für Tests: Ermöglicht das Überschreiben von Feature-Flags
 *
 * ⚠️ NUR für Tests verwenden!
 */
let testOverrides: Partial<FeatureFlags> | null = null;

/**
 * Setzt Test-Overrides für Feature-Flags
 *
 * @param overrides - Zu überschreibende Flags
 */
export function setTestFeatureFlags(overrides: Partial<FeatureFlags>): void {
  testOverrides = overrides;
}

/**
 * Löscht alle Test-Overrides
 */
export function clearTestFeatureFlags(): void {
  testOverrides = null;
}

/**
 * Interne Funktion: Gibt Flag-Wert zurück (mit Test-Override Support)
 */
export function getFeatureFlagValue<K extends keyof FeatureFlags>(flag: K): boolean {
  if (testOverrides && flag in testOverrides) {
    return testOverrides[flag] as boolean;
  }
  return isFeatureEnabled(flag);
}
