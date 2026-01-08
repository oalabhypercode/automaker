/**
 * 🎫 Tickets Schema
 *
 * Drizzle ORM Schema für tickets und ticket_events Tabellen.
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
  pgEnum,
  jsonb,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel, sql } from 'drizzle-orm';
import { projects } from './projects.ts';
import { users } from './users.ts';

// =============================================================================
// 🎭 ENUMS
// =============================================================================

/**
 * Ticket-Status Enum
 */
export const ticketStatusEnum = pgEnum('ticket_status_enum', [
  'backlog', // Backlog
  'todo', // Zu erledigen
  'in_progress', // In Bearbeitung
  'review', // Review
  'done', // Erledigt
  'archived', // Archiviert
]);

/**
 * Ticket-Priorität Enum
 */
export const ticketPriorityEnum = pgEnum('ticket_priority_enum', [
  'low', // Niedrig
  'medium', // Mittel
  'high', // Hoch
  'urgent', // Dringend
]);

/**
 * Event-Typ Enum
 */
export const eventTypeEnum = pgEnum('event_type_enum', [
  'created', // Ticket erstellt
  'updated', // Ticket aktualisiert
  'status_changed', // Status geändert
  'claimed', // Ticket übernommen
  'unclaimed', // Claim aufgehoben
  'completed', // Ticket abgeschlossen
  'comment_added', // Kommentar hinzugefügt
  'label_added', // Label hinzugefügt
  'label_removed', // Label entfernt
]);

/**
 * Dependency-Typ Enum
 */
export const dependencyTypeEnum = pgEnum('dependency_type_enum', [
  'blocks', // Source blockiert Target (Source muss fertig sein bevor Target startet)
  'relates_to', // Verwandte Tickets (keine Abhängigkeit, nur Verknüpfung)
]);

// =============================================================================
// 🎫 TICKETS TABLE
// =============================================================================

/**
 * Tickets-Tabelle
 */
export const tickets = pgTable(
  'tickets',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Fremdschlüssel
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'restrict', onUpdate: 'cascade' }),

    // Lokale ID für Offline-Mapping
    localId: varchar('local_id', { length: 100 }),

    // Inhalt
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),

    // Status & Priorität
    status: ticketStatusEnum('status').default('backlog').notNull(),
    priority: ticketPriorityEnum('priority').default('medium').notNull(),

    // Labels als Array
    labels: text('labels')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),

    // Zuordnungen
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    claimedBy: uuid('claimed_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),

    // Optimistic Locking
    version: integer('version').default(1).notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    // Soft-Delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Indizes
    index('idx_tickets_project').on(table.projectId),
    index('idx_tickets_status').on(table.status),
    index('idx_tickets_claimed_by').on(table.claimedBy),
    // Unique Index für lokale ID pro Projekt
    uniqueIndex('idx_tickets_local_id').on(table.projectId, table.localId),
  ]
);

// =============================================================================
// 📡 TICKET EVENTS TABLE
// =============================================================================

/**
 * Ticket-Events Tabelle
 *
 * Speichert alle Änderungen an Tickets für Sync und Audit-Trail.
 */
export const ticketEvents = pgTable(
  'ticket_events',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Fremdschlüssel
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Denormalisiert für Performance bei Pull-Queries
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Event-Typ
    type: eventTypeEnum('type').notNull(),

    // Event-Daten (JSONB für Flexibilität)
    payload: jsonb('payload').default({}).notNull().$type<EventPayloadJson>(),

    // Wer hat das Event ausgelöst
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    // Wann
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Indizes für häufige Queries
    index('idx_events_ticket').on(table.ticketId),
    // Index für Pull-Queries (Events seit Timestamp pro Projekt)
    index('idx_events_project_time').on(table.projectId, table.createdAt),
    index('idx_events_created_at').on(table.createdAt),
  ]
);

// =============================================================================
// 📎 TICKET ATTACHMENTS TABLE (Phase 3.6)
// =============================================================================

/**
 * Ticket-Attachments Tabelle
 *
 * Speichert Bild-Uploads (z. B. aus dem Kunden-Portal) in Supabase Storage.
 */
export const ticketAttachments = pgTable(
  'ticket_attachments',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Fremdschlüssel
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Storage Metadaten
    storagePath: varchar('storage_path', { length: 600 }).notNull(),
    filename: varchar('filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    size: integer('size').notNull(),
    source: varchar('source', { length: 32 }).default('customer').notNull(),

    // Wann
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_ticket_attachments_ticket').on(table.ticketId),
    index('idx_ticket_attachments_project').on(table.projectId),
  ]
);

// =============================================================================
// 📝 TYPESCRIPT TYPES
// =============================================================================

/**
 * Event-Payload Struktur
 */
export interface EventPayloadJson {
  /** Vorheriger Status (bei status_changed) */
  previousStatus?: string;
  /** Neuer Status (bei status_changed) */
  newStatus?: string;
  /** Geänderte Felder (bei updated) */
  changes?: Record<string, { from: unknown; to: unknown }>;
  /** Kommentar-Text */
  comment?: string;
  /** Label-Name */
  label?: string;
  /** Vorheriger Claimer (bei unclaimed) */
  previousClaimedBy?: string;
  /** Sonstige Daten */
  [key: string]: unknown;
}

/**
 * Ticket Typen
 */
export type DbTicket = InferSelectModel<typeof tickets>;
export type DbNewTicket = InferInsertModel<typeof tickets>;

/**
 * TicketEvent Typen
 */
export type DbTicketEvent = InferSelectModel<typeof ticketEvents>;
export type DbNewTicketEvent = InferInsertModel<typeof ticketEvents>;

/**
 * TicketAttachment Typen
 */
export type DbTicketAttachment = InferSelectModel<typeof ticketAttachments>;
export type DbNewTicketAttachment = InferInsertModel<typeof ticketAttachments>;

// =============================================================================
// 🔗 RELATIONS
// =============================================================================

/**
 * Tickets-Relationen
 */
export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  project: one(projects, {
    fields: [tickets.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [tickets.createdBy],
    references: [users.id],
    relationName: 'ticketCreator',
  }),
  claimer: one(users, {
    fields: [tickets.claimedBy],
    references: [users.id],
    relationName: 'ticketClaimer',
  }),
  events: many(ticketEvents),
  attachments: many(ticketAttachments),
}));

/**
 * TicketEvents-Relationen
 */
export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketEvents.ticketId],
    references: [tickets.id],
  }),
  project: one(projects, {
    fields: [ticketEvents.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [ticketEvents.createdBy],
    references: [users.id],
  }),
}));

/**
 * TicketAttachments-Relationen
 */
export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketAttachments.ticketId],
    references: [tickets.id],
  }),
  project: one(projects, {
    fields: [ticketAttachments.projectId],
    references: [projects.id],
  }),
}));

// =============================================================================
// 🔗 TICKET DEPENDENCIES TABLE (Phase 2.5)
// =============================================================================

/**
 * Ticket-Abhängigkeiten Tabelle
 *
 * Speichert M:N Beziehungen zwischen Tickets für:
 * - Blocker-Beziehungen (A blocks B = B kann nicht starten bis A fertig)
 * - Verwandte Tickets (lose Verknüpfung)
 */
export const ticketDependencies = pgTable(
  'ticket_dependencies',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Source-Ticket (das blockierende Ticket)
    sourceTicketId: uuid('source_ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Target-Ticket (das blockierte Ticket)
    targetTicketId: uuid('target_ticket_id')
      .notNull()
      .references(() => tickets.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Art der Beziehung
    relationType: dependencyTypeEnum('relation_type').notNull(),

    // Wer hat die Beziehung erstellt
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'set null',
      onUpdate: 'cascade',
    }),

    // Wann
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite Index für schnelle Lookups
    index('idx_deps_source').on(table.sourceTicketId),
    index('idx_deps_target').on(table.targetTicketId),
    // Unique: Keine doppelten Abhängigkeiten
    uniqueIndex('idx_deps_unique').on(
      table.sourceTicketId,
      table.targetTicketId,
      table.relationType
    ),
  ]
);

// =============================================================================
// 📝 DEPENDENCY TYPESCRIPT TYPES
// =============================================================================

/**
 * Dependency-Typ
 */
export type DependencyType = 'blocks' | 'relates_to';

/**
 * TicketDependency Typen
 */
export type DbTicketDependency = InferSelectModel<typeof ticketDependencies>;
export type DbNewTicketDependency = InferInsertModel<typeof ticketDependencies>;

// =============================================================================
// 🔗 DEPENDENCY RELATIONS
// =============================================================================

/**
 * TicketDependencies-Relationen
 */
export const ticketDependenciesRelations = relations(ticketDependencies, ({ one }) => ({
  sourceTicket: one(tickets, {
    fields: [ticketDependencies.sourceTicketId],
    references: [tickets.id],
    relationName: 'outgoingDependencies',
  }),
  targetTicket: one(tickets, {
    fields: [ticketDependencies.targetTicketId],
    references: [tickets.id],
    relationName: 'incomingDependencies',
  }),
  creator: one(users, {
    fields: [ticketDependencies.createdBy],
    references: [users.id],
  }),
}));
