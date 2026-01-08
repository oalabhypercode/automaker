/**
 * 🏢 Projects Schema
 *
 * Drizzle ORM Schema für die projects Tabelle.
 *
 * @see docs/pg-online-sync/tasks/phase-1.1-datenmodell.md
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';

// =============================================================================
// 🏢 PROJECTS TABLE
// =============================================================================

/**
 * Projekt-Tabelle
 *
 * Speichert alle Projekte mit ihren Einstellungen.
 */
export const projects = pgTable(
  'projects',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Basis-Informationen
    name: varchar('name', { length: 100 }).notNull(),
    slug: varchar('slug', { length: 50 }).notNull().unique(),
    description: text('description'),

    // Kunden-Zugang
    customerPasswordHash: varchar('customer_password_hash', { length: 255 }),
    customerAccessEnabled: boolean('customer_access_enabled').default(false).notNull(),

    // Sync-Konfiguration
    syncEnabled: boolean('sync_enabled').default(true).notNull(),

    // Erweiterte Einstellungen (JSONB für Flexibilität)
    settings: jsonb('settings').default({}).notNull().$type<ProjectSettingsJson>(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),

    // Soft-Delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Indizes für häufige Queries
    index('idx_projects_slug').on(table.slug),
    index('idx_projects_deleted').on(table.deletedAt),
  ]
);

// =============================================================================
// 📝 TYPESCRIPT TYPES (Inferred from Schema)
// =============================================================================

/**
 * Einstellungen für das öffentliche Kunden-Board
 *
 * Diese Settings steuern, was Kunden sehen und tun dürfen.
 * @see docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
 */
export interface PublicBoardSettings {
  /** Dürfen Kunden Tickets erstellen? (Default: true) */
  allowTicketCreation: boolean;
  /** Öffentliche Kommentare anzeigen? (Default: false) */
  showComments: boolean;
  /** Welche Status-Spalten werden angezeigt? (Default: ['todo', 'in_progress', 'done']) */
  visibleStatuses: string[];
  /** Willkommensnachricht für Kunden (optional) */
  introMessage?: string;
  /** Theme für das Kunden-Board (Default: 'dark') */
  theme: 'dark' | 'light';
}

/**
 * Erstellt Standard-Werte für PublicBoardSettings
 */
export function getDefaultPublicBoardSettings(): PublicBoardSettings {
  return {
    allowTicketCreation: true,
    showComments: false,
    visibleStatuses: ['todo', 'in_progress', 'done'],
    theme: 'dark',
  };
}

/**
 * Projekt-Einstellungen (JSONB Struktur)
 */
export interface ProjectSettingsJson {
  /** Erlaubte Status-Spalten */
  allowedStatuses?: string[];
  /** Standard-Priorität für neue Tickets */
  defaultPriority?: string;
  /** Farbschema */
  colorScheme?: string;
  /** Logo-URL für das Projekt */
  logoUrl?: string;
  /** Einstellungen für das öffentliche Kunden-Board */
  publicSettings?: PublicBoardSettings;
  /** Sonstige Einstellungen */
  [key: string]: unknown;
}

/**
 * SELECT Type - Projekt aus DB lesen
 */
export type DbProject = InferSelectModel<typeof projects>;

/**
 * INSERT Type - Neues Projekt einfügen
 */
export type DbNewProject = InferInsertModel<typeof projects>;

// =============================================================================
// 🔗 RELATIONS (werden in index.ts zusammengeführt)
// =============================================================================

/**
 * Projekt-Relationen
 * - Ein Projekt hat viele Tickets
 * - Ein Projekt hat viele Mitglieder
 * - Ein Projekt hat viele Sync-States
 */
export const projectsRelations = relations(projects, ({ many }) => ({
  // Diese werden in tickets.ts und users.ts definiert
  // projectMembers: many(projectMembers),
  // tickets: many(tickets),
  // syncStates: many(syncStates),
}));
