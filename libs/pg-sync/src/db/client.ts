/**
 * 🔌 Postgres/Drizzle Client Factory
 *
 * Zentrale Client-Erstellung für alle Datenbank-Interaktionen.
 * Verwendet postgres.js als Driver und Drizzle ORM für Queries.
 *
 * @example
 * // Drizzle Client holen
 * const db = getDb();
 *
 * // Query ausführen
 * const projects = await db.select().from(projects);
 */

import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { validateEnv } from './types.js';

// =============================================================================
// 🏭 CLIENT FACTORY
// =============================================================================

/** Singleton-Instanzen für Performance */
let sqlClient: ReturnType<typeof postgres> | null = null;
let drizzleClient: PostgresJsDatabase | null = null;

/**
 * Erstellt den postgres.js SQL Client.
 * Wird intern von getDb() verwendet.
 *
 * @returns postgres.js Client
 */
function createSqlClient(): ReturnType<typeof postgres> {
  if (sqlClient) {
    return sqlClient;
  }

  const env = validateEnv();

  sqlClient = postgres(env.database.connectionString, {
    max: env.database.maxConnections ?? 10,
    idle_timeout: env.database.idleTimeout ?? 30,
    connect_timeout: 10,
    // Für Serverless-Umgebungen
    prepare: false,
  });

  return sqlClient;
}

/**
 * Holt den Drizzle ORM Client.
 * Verwendet Singleton-Pattern für Performance.
 *
 * @returns Drizzle ORM Client
 *
 * @example
 * import { getDb } from '@automaker/pg-sync';
 *
 * const db = getDb();
 * const allProjects = await db.select().from(projects);
 */
export function getDb(): PostgresJsDatabase {
  if (drizzleClient) {
    return drizzleClient;
  }

  const sql = createSqlClient();
  drizzleClient = drizzle(sql);

  return drizzleClient;
}

/**
 * Holt den rohen postgres.js Client für komplexe Queries.
 * Verwende getDb() für normale Operationen!
 *
 * @returns postgres.js SQL Client
 *
 * @example
 * const sql = getSql();
 * const result = await sql`SELECT NOW()`;
 */
export function getSql(): ReturnType<typeof postgres> {
  return createSqlClient();
}

// =============================================================================
// 🔧 UTILITY FUNCTIONS
// =============================================================================

/**
 * Testet die Verbindung zur Postgres-Datenbank.
 *
 * @returns Verbindungsstatus mit Latenz
 *
 * @example
 * const result = await testConnection();
 * if (result.success) {
 *   console.log(`✅ Verbunden! Latenz: ${result.latencyMs}ms`);
 * }
 */
export async function testConnection(): Promise<{
  success: boolean;
  error?: string;
  latencyMs?: number;
  serverVersion?: string;
}> {
  try {
    const start = Date.now();
    const sql = getSql();

    // Einfacher Health-Check Query
    const result = await sql`SELECT version() as version`;
    const latencyMs = Date.now() - start;

    return {
      success: true,
      latencyMs,
      serverVersion: result[0]?.version,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Gibt die aktuell geladene Konfiguration zurück (ohne sensible Daten).
 * Nützlich für Debugging und Logging.
 *
 * @returns Konfiguration mit maskiertem Connection String
 */
export function getConfigInfo(): {
  connectionHost: string;
  database: string;
  syncEnabled: boolean;
} {
  const env = validateEnv();

  // Connection String parsen um Host/DB zu extrahieren (ohne Password)
  let host = 'unknown';
  let database = 'unknown';

  try {
    const url = new URL(env.database.connectionString);
    host = url.hostname;
    database = url.pathname.replace('/', '') || 'postgres';
  } catch {
    // URL parsing fehlgeschlagen, verwende Defaults
  }

  return {
    connectionHost: host,
    database,
    syncEnabled: env.sync.enabled,
  };
}

/**
 * Schließt alle Datenbankverbindungen.
 * Sollte beim Herunterfahren der App aufgerufen werden.
 */
export async function closeConnections(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end();
    sqlClient = null;
    drizzleClient = null;
  }
}

/**
 * Setzt die Clients zurück (für Tests).
 */
export function resetClients(): void {
  sqlClient = null;
  drizzleClient = null;
}
