/**
 * 👤 Users Schema
 *
 * Drizzle ORM Schema für users und project_members Tabellen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.1-datenmodell.md
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  primaryKey,
  pgEnum,
  index,
} from 'drizzle-orm/pg-core';
import { relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { projects } from './projects.js';

// =============================================================================
// 🎭 ENUMS
// =============================================================================

/**
 * Globale Benutzer-Rollen
 */
export const userRoleEnum = pgEnum('user_role_enum', [
  'admin', // System-Administrator
  'member', // Team-Mitglied
  'customer', // Kunde
]);

/**
 * Projekt-spezifische Rollen
 */
export const projectRoleEnum = pgEnum('project_role_enum', [
  'owner', // Projekt-Besitzer
  'admin', // Projekt-Admin
  'member', // Team-Mitglied
  'viewer', // Nur Lesen
]);

// =============================================================================
// 👤 USERS TABLE
// =============================================================================

/**
 * Benutzer-Tabelle
 */
export const users = pgTable(
  'users',
  {
    // Primärschlüssel
    id: uuid('id').defaultRandom().primaryKey(),

    // Authentifizierung
    email: varchar('email', { length: 255 }).notNull().unique(),

    // Profil
    name: varchar('name', { length: 100 }).notNull(),
    role: userRoleEnum('role').default('member').notNull(),
    avatarUrl: varchar('avatar_url', { length: 500 }),

    // Offline-Client Verknüpfung
    clientId: varchar('client_id', { length: 100 }).unique(),

    // Aktivitäts-Tracking
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    // Soft-Delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_client_id').on(table.clientId),
  ]
);

// =============================================================================
// 👥 PROJECT MEMBERS TABLE (Join-Table)
// =============================================================================

/**
 * Projekt-Mitglieder Tabelle
 *
 * Many-to-Many zwischen Users und Projects
 */
export const projectMembers = pgTable(
  'project_members',
  {
    // Fremdschlüssel
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),

    // Rolle im Projekt
    role: projectRoleEnum('role').default('member').notNull(),

    // Beitrittsdatum
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // Composite Primary Key
    primaryKey({ columns: [table.projectId, table.userId] }),
  ]
);

// =============================================================================
// 📝 TYPESCRIPT TYPES
// =============================================================================

/**
 * User Typen
 */
export type DbUser = InferSelectModel<typeof users>;
export type DbNewUser = InferInsertModel<typeof users>;

/**
 * ProjectMember Typen
 */
export type DbProjectMember = InferSelectModel<typeof projectMembers>;
export type DbNewProjectMember = InferInsertModel<typeof projectMembers>;

// =============================================================================
// 🔗 RELATIONS
// =============================================================================

/**
 * User-Relationen
 */
export const usersRelations = relations(users, ({ many }) => ({
  projectMembers: many(projectMembers),
  // ticketsCreated: many(tickets, { relationName: 'createdBy' }),
  // ticketsClaimed: many(tickets, { relationName: 'claimedBy' }),
}));

/**
 * ProjectMembers-Relationen
 */
export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}));
