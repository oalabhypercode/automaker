/**
 * 🗄️ Database Module - Public Exports
 *
 * Zentrale Exports für alle Datenbank-bezogenen Funktionen.
 */

// Client Factory
export {
  getDb,
  getSql,
  testConnection,
  getConfigInfo,
  closeConnections,
  resetClients,
} from './client.js';

// Types
export type {
  DatabaseConfig,
  SyncConfig,
  ApiResponse,
  ApiError,
  SyncOperationStatus,
  SyncResult,
  ValidatedEnv,
} from './types.js';

export { validateEnv } from './types.js';

// Schema (Drizzle Tables & Relations)
export * from './schema/index.js';
