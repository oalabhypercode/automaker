/**
 * 🔄 Sync Schema
 *
 * Drizzle ORM Schema für sync_states und outbox_items Tabellen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.1-datenmodell.md
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  primaryKey,
  pgEnum,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { projects } from './projects.js';
import { users } from './users.js';

// =============================================================================
// 🎭 ENUMS
// =============================================================================

/**
 * Outbox-Status Enum
 */
export const outboxStatusEnum = pgEnum('outbox_status_enum', [
  'pending', // Wartet auf Verarbeitung
  'processing', // Wird gerade verarbeitet
  'completed', // Erfolgreich verarbeitet
  'failed', // Fehlgeschlagen
]);

// =============================================================================
// 🔄 SYNC STATES TABLE
// =============================================================================

/**
 * Sync-State Tabelle
 *
 * Speichert den Sync-Status pro Client und Projekt.
 */
export const syncStates = pgTable(
  'sync_states',
  {
    // Client-Identifier (z.B. UUID des Offline-Clients)
    clientId: varchar('client_id', { length: 100 }).notNull(),

    // Projekt-Fremdschlüssel
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // User-Fremdschlüssel
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    // Sync-Timestamps
    lastPulledAt: timestamp('last_pulled_at', { withTimezone: true }),
    lastPushedAt: timestamp('last_pushed_at', { withTimezone: true }),

    // Letztes verarbeitetes Event (für inkrementellen Sync)
    lastEventId: uuid('last_event_id'),
  },
  (table) => [
    // Composite Primary Key
    primaryKey({ columns: [table.clientId, table.projectId] }),
  ]
);

// =============================================================================
// 📤 OUTBOX ITEMS TABLE
// =============================================================================

/**
 * Outbox-Items Tabelle
 *
 * Speichert ausstehende Events für den Push zum Server.
 * Transactional Outbox Pattern für zuverlässigen Event-Transport.
 */
export const outboxItems = pgTable(
  'outbox_items',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Client-Identifier
    clientId: varchar('client_id', { length: 100 }).notNull(),

    // Event-Informationen
    eventType: varchar('event_type', { length: 50 }).notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: uuid('entity_id').notNull(),

    // Event-Daten
    payload: jsonb('payload').notNull().$type<OutboxPayloadJson>(),

    // Verarbeitungs-Status
    status: outboxStatusEnum('status').default('pending').notNull(),

    // Retry-Handling
    retries: integer('retries').default(0).notNull(),
    errorMessage: text('error_message'),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (table) => [
    // Index für Pending-Queue (häufigste Query)
    index('idx_outbox_pending').on(table.status, table.createdAt),
    index('idx_outbox_client').on(table.clientId),
  ]
);

// =============================================================================
// 📝 TYPESCRIPT TYPES
// =============================================================================

/**
 * Outbox-Payload Struktur
 */
export interface OutboxPayloadJson {
  /** Event-Daten */
  data: Record<string, unknown>;
  /** Ursprüngliche lokale ID */
  localId?: string;
  /** Zusätzliche Metadaten */
  metadata?: Record<string, unknown>;
}

/**
 * SyncState Typen
 */
export type DbSyncState = InferSelectModel<typeof syncStates>;
export type DbNewSyncState = InferInsertModel<typeof syncStates>;

/**
 * OutboxItem Typen
 */
export type DbOutboxItem = InferSelectModel<typeof outboxItems>;
export type DbNewOutboxItem = InferInsertModel<typeof outboxItems>;

// =============================================================================
// 🔗 RELATIONS
// =============================================================================

/**
 * SyncStates-Relationen
 */
export const syncStatesRelations = relations(syncStates, ({ one }) => ({
  project: one(projects, {
    fields: [syncStates.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [syncStates.userId],
    references: [users.id],
  }),
}));
