/**
 * 🗄️ Database Types for Postgres/Drizzle Integration
 *
 * Diese Datei enthält die Typen für die Datenbank-Konfiguration
 * und grundlegende Operationen.
 */

// =============================================================================
// 🔧 DATABASE CONFIGURATION
// =============================================================================

/**
 * Konfiguration für die Postgres-Verbindung
 */
export interface DatabaseConfig {
  /** Postgres Connection String (DATABASE_URL) */
  connectionString: string;
  /** Maximale Anzahl Verbindungen im Pool */
  maxConnections?: number;
  /** Idle Timeout in Millisekunden */
  idleTimeout?: number;
}

/**
 * Sync-Konfiguration
 */
export interface SyncConfig {
  /** Sync aktiviert */
  enabled: boolean;
  /** Sync-Intervall in Millisekunden */
  intervalMs: number;
  /** Automatischer Push bei Änderungen */
  autoPush: boolean;
  /** Automatischer Pull bei App-Start */
  autoPull: boolean;
  /** Konflikt-Strategie */
  conflictStrategy: 'local_wins' | 'remote_wins' | 'manual';
}

// =============================================================================
// 📡 API RESPONSE TYPES
// =============================================================================

/**
 * Standard API Response Wrapper
 * Wird für alle API-Antworten verwendet
 */
export interface ApiResponse<T> {
  /** Operation erfolgreich? */
  success: boolean;
  /** Daten bei Erfolg */
  data?: T;
  /** Fehler bei Misserfolg */
  error?: ApiError;
}

/**
 * API Fehler-Struktur
 */
export interface ApiError {
  /** Fehlercode für programmatische Verarbeitung */
  code: string;
  /** Benutzerfreundliche Fehlermeldung */
  message: string;
  /** Zusätzliche Details zum Fehler */
  details?: unknown;
}

// =============================================================================
// 🔄 SYNC STATUS TYPES
// =============================================================================

/**
 * Status einer Sync-Operation
 */
export type SyncOperationStatus = 'idle' | 'pushing' | 'pulling' | 'error' | 'offline';

/**
 * Ergebnis einer Sync-Operation
 */
export interface SyncResult {
  /** Operation erfolgreich? */
  success: boolean;
  /** Anzahl der synchronisierten Elemente */
  syncedCount: number;
  /** Anzahl der Konflikte */
  conflictCount: number;
  /** Fehlermeldung bei Misserfolg */
  error?: string;
  /** Timestamp der Operation */
  timestamp: Date;
}

// =============================================================================
// 🔐 ENVIRONMENT VALIDATION
// =============================================================================

/**
 * Geladene und validierte Umgebungsvariablen
 */
export interface ValidatedEnv {
  database: DatabaseConfig;
  sync: SyncConfig;
}

/**
 * Prüft ob alle notwendigen Umgebungsvariablen gesetzt sind
 */
export function validateEnv(): ValidatedEnv {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      '❌ DATABASE_URL nicht gesetzt!\n' +
        'Bitte setze DATABASE_URL in deiner .env.local Datei.\n' +
        'Siehe libs/pg-sync/.env.example für ein Template.\n\n' +
        'Beispiel: postgresql://postgres:password@localhost:5432/automaker'
    );
  }

  return {
    database: {
      connectionString,
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    },
    sync: {
      enabled: process.env.SYNC_ENABLED !== 'false',
      intervalMs: parseInt(process.env.SYNC_INTERVAL_MS || '3600000', 10),
      autoPush: process.env.SYNC_AUTO_PUSH !== 'false',
      autoPull: process.env.SYNC_AUTO_PULL !== 'false',
      conflictStrategy:
        (process.env.SYNC_CONFLICT_STRATEGY as 'local_wins' | 'remote_wins' | 'manual') ||
        'remote_wins',
    },
  };
}
