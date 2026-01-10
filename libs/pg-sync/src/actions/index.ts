/**
 * 📦 Actions Index
 *
 * Zentraler Export aller Action-Funktionen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

// =============================================================================
// 🏢 PROJECT ACTIONS
// =============================================================================

export {
  validateProjectPassword,
  setProjectCustomerPassword,
  removeProjectCustomerPassword,
} from './auth-actions.js';

export {
  createProject,
  updateProject,
  deleteProject,
  updateProjectSettings,
  addProjectMember,
  removeProjectMember,
  changeProjectMemberRole,
  restoreProject,
  // Phase 3.1: Customer Access Actions
  createProjectWithAutoSlug,
  enableCustomerAccess,
  disableCustomerAccess,
  setProjectPassword,
  removeProjectPassword,
  updateProjectSlug,
  // Phase 3.5: Public Board Settings Actions
  updateProjectPublicSettings,
  getProjectPublicSettings,
  type CreateProjectData,
  type UpdateProjectData,
  type ProjectRoleType,
  type CreateProjectAutoSlugData,
  type UpdatePublicBoardSettingsData,
} from './project-actions.js';

// =============================================================================
// 👤 USER ACTIONS
// =============================================================================

export {
  createUser,
  updateUser,
  deleteUser,
  updateLastSeen,
  linkClientId,
  unlinkClientId,
  restoreUser,
  updateUserEmail,
  type CreateUserData,
  type UpdateUserData,
  type UserRoleType,
} from './user-actions.js';

// =============================================================================
// 🎫 TICKET ACTIONS
// =============================================================================

export {
  createTicket,
  updateTicket,
  deleteTicket,
  deleteMultipleTickets,
  claimTicket,
  unclaimTicket,
  changeTicketStatus,
  completeTicket,
  addTicketLabel,
  removeTicketLabel,
  // Phase 3.4: Public Ticket Action
  createPublicTicket,
  // Phase 7.2: Batch Status Update
  updateMultipleTicketsStatus,
  type CreateTicketData,
  type UpdateTicketData,
  type TicketStatusType,
  type TicketPriorityType,
  type EventTypeType,
  // Phase 3.4: Public Ticket Types
  type CreatePublicTicketData,
  // Phase 7.1: Batch Delete Types
  type BatchDeleteResult,
  // Phase 7.2: Batch Status Types
  type BatchStatusResult,
  type StatusUpdate,
} from './ticket-actions.js';

// =============================================================================
// 📎 ATTACHMENT ACTIONS
// =============================================================================

export { createTicketAttachments, type CreateTicketAttachmentData } from './attachment-actions.js';

// =============================================================================
// 📡 EVENT ACTIONS
// =============================================================================

export {
  createEvent,
  createBulkEvents,
  createCommentEvent,
  type CreateEventData,
  type EventType,
} from './event-actions.js';

// =============================================================================
// 🔄 SYNC ACTIONS
// =============================================================================

export {
  upsertSyncState,
  updateLastPulled,
  updateLastPushed,
  addToOutbox,
  markOutboxProcessed,
  markOutboxFailed,
  retryOutboxItem,
  claimOutboxItem,
  clearProcessedOutbox,
  addBatchToOutbox,
  type CreateOutboxData,
  type OutboxStatusType,
} from './sync-actions.js';

// =============================================================================
// 🔗 DEPENDENCY ACTIONS (Phase 2.5)
// =============================================================================

export {
  addDependency,
  removeDependency,
  removeDependencyByTickets,
  removeAllDependenciesForTicket,
  changeDependencyType,
  isTicketBlocked,
  getBlockingTicketIds,
  wouldCreateCycle,
  type CreateDependencyData,
  type DependencyWithTickets,
} from './dependency-actions.js';
