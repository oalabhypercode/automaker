/**
 * 📦 Schema Index
 *
 * Zentraler Export aller Drizzle Schema-Definitionen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.1-datenmodell.md
 */

// =============================================================================
// 🏢 PROJECTS
// =============================================================================

export {
  projects,
  projectsRelations,
  getDefaultPublicBoardSettings,
  type ProjectSettingsJson,
  type PublicBoardSettings,
  type DbProject,
  type DbNewProject,
} from './projects.ts';

// =============================================================================
// 👤 USERS
// =============================================================================

export {
  users,
  usersRelations,
  projectMembers,
  projectMembersRelations,
  userRoleEnum,
  projectRoleEnum,
  type DbUser,
  type DbNewUser,
  type DbProjectMember,
  type DbNewProjectMember,
} from './users.ts';

// =============================================================================
// 🎫 TICKETS
// =============================================================================

export {
  tickets,
  ticketsRelations,
  ticketEvents,
  ticketEventsRelations,
  ticketAttachments,
  ticketAttachmentsRelations,
  ticketStatusEnum,
  ticketPriorityEnum,
  eventTypeEnum,
  // Phase 2.5: Dependency-Graph
  ticketDependencies,
  ticketDependenciesRelations,
  dependencyTypeEnum,
  type DependencyType,
  type DbTicketDependency,
  type DbNewTicketDependency,
  // Existing Types
  type EventPayloadJson,
  type DbTicket,
  type DbNewTicket,
  type DbTicketEvent,
  type DbNewTicketEvent,
  type DbTicketAttachment,
  type DbNewTicketAttachment,
} from './tickets.ts';

// =============================================================================
// 🔄 SYNC
// =============================================================================

export {
  syncStates,
  syncStatesRelations,
  outboxItems,
  outboxStatusEnum,
  type OutboxPayloadJson,
  type DbSyncState,
  type DbNewSyncState,
  type DbOutboxItem,
  type DbNewOutboxItem,
} from './sync.ts';

// =============================================================================
// 📊 SCHEMA OBJECT (für Drizzle Client)
// =============================================================================

import { projects, projectsRelations } from './projects.ts';
import { users, usersRelations, projectMembers, projectMembersRelations } from './users.ts';
import {
  tickets,
  ticketsRelations,
  ticketEvents,
  ticketEventsRelations,
  ticketAttachments,
  ticketAttachmentsRelations,
  ticketDependencies,
  ticketDependenciesRelations,
} from './tickets.ts';
import { syncStates, syncStatesRelations, outboxItems } from './sync.ts';

/**
 * Komplettes Schema-Objekt für Drizzle Client
 *
 * @example
 * import { drizzle } from 'drizzle-orm/postgres-js';
 * import { schema } from './schema';
 *
 * const db = drizzle(sql, { schema });
 */
export const schema = {
  // Tables
  projects,
  users,
  projectMembers,
  tickets,
  ticketEvents,
  ticketAttachments,
  ticketDependencies,
  syncStates,
  outboxItems,

  // Relations
  projectsRelations,
  usersRelations,
  projectMembersRelations,
  ticketsRelations,
  ticketEventsRelations,
  ticketAttachmentsRelations,
  ticketDependenciesRelations,
  syncStatesRelations,
};
