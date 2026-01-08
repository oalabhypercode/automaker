/**
 * 📦 Finders Index
 *
 * Zentraler Export aller Finder-Funktionen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

// =============================================================================
// 🏢 PROJECT FINDERS
// =============================================================================

export {
  findProjectById,
  findProjectBySlug,
  findAllProjects,
  findProjectsByUser,
  findProjectWithMembers,
  projectExists,
  isSlugAvailable,
  countProjects,
  // Phase 3.1 + 3.5: Public Project Finders
  findPublicProjectBySlug,
  findAllPublicProjects,
  isPublicSlugAccessible,
  hasProjectPassword,
  type FindProjectsOptions,
  type ProjectWithMembers,
  type PublicProjectData,
  type PublicBoardSettingsData,
} from './project-finder.js';

// =============================================================================
// 👤 USER FINDERS
// =============================================================================

export {
  findUserById,
  findUserByEmail,
  findUserByClientId,
  findUsersByProject,
  findUserRole,
  isProjectMember,
  userExists,
  isEmailAvailable,
  countProjectMembers,
  type ProjectMemberWithUser,
  type ProjectRole,
} from './user-finder.js';

// =============================================================================
// 🎫 TICKET FINDERS
// =============================================================================

export {
  findTicketById,
  findTicketByLocalId,
  findTicketsByProject,
  getPublicProjectTickets,
  findTicketsByStatus,
  findTicketsClaimedBy,
  findOpenTickets,
  countTicketsByStatus,
  findTicketWithRelations,
  ticketExists,
  countTicketsInProject,
  type FindTicketsOptions,
  type PublicTicketFinderOptions,
  type TicketWithRelations,
  type StatusCounts,
  type TicketStatus,
  type TicketPriority,
  type PublicTicketData,
} from './ticket-finder.js';

// =============================================================================
// 📎 ATTACHMENT FINDERS
// =============================================================================

export {
  findTicketAttachmentsByTicketIds,
  type TicketAttachmentData,
} from './attachment-finder.js';

// =============================================================================
// 📡 EVENT FINDERS
// =============================================================================

export {
  findEventById,
  findEventsByTicket,
  findEventsSince,
  findEventsSinceId,
  findLatestEvent,
  countEventsSince,
  findEventsWithCreator,
  findRecentProjectEvents,
  type EventWithCreator,
  type FindEventsOptions,
} from './event-finder.js';

// =============================================================================
// 🔄 SYNC FINDERS
// =============================================================================

export {
  findSyncState,
  findSyncStatesByClient,
  findSyncStatesByProject,
  findPendingOutbox,
  countPendingOutbox,
  findFailedOutbox,
  findOutboxItemById,
  getOutboxStats,
  findRetryableOutbox,
  findOldProcessedOutbox,
  type OutboxStatus,
  type OutboxStats,
} from './sync-finder.js';

// =============================================================================
// 🔗 DEPENDENCY FINDERS (Phase 2.5)
// =============================================================================

export {
  findDependencyById,
  findOutgoingDependencies,
  findIncomingDependencies,
  findAllDependenciesForTicket,
  findOutgoingDependenciesWithTickets,
  findIncomingDependenciesWithTickets,
  getBlockerInfo,
  findDependenciesByProject,
  getDependencyGraphData,
  dependencyExists,
  countDependencies,
  findBlockedTickets,
  type DependencyWithTickets as FinderDependencyWithTickets,
  type DependencyGraphData,
  type BlockerInfo,
} from './dependency-finder.js';
