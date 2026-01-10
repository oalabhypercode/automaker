/**
 * 🌐 @automaker/pg-sync
 *
 * Postgres Online-Sync Package für AutoMaker.
 * Ermöglicht die Synchronisation zwischen lokalen Offline-Boards und einer zentralen Postgres-DB.
 *
 * Verwendet Drizzle ORM für typsichere Queries.
 *
 * @packageDocumentation
 *
 * @example
 * // Einfacher Verbindungstest
 * import { testConnection } from '@automaker/pg-sync';
 *
 * const result = await testConnection();
 * if (result.success) {
 *   console.log(`✅ Verbunden! Latenz: ${result.latencyMs}ms`);
 * }
 *
 * @example
 * // Drizzle Client für Queries
 * import { getDb } from '@automaker/pg-sync';
 * import { projects } from '@automaker/pg-sync/db/schema';
 *
 * const db = getDb();
 * const allProjects = await db.select().from(projects);
 *
 * @example
 * // Feature-Flags prüfen
 * import { isSyncEnabled, getFeatureFlags } from '@automaker/pg-sync';
 *
 * if (isSyncEnabled()) {
 *   console.log('Sync ist aktiv!');
 * }
 *
 * @see docs/pg-online-sync/GLOBAL-TASKLIST.md für Projektübersicht
 */

// =============================================================================
// 🗄️ DATABASE EXPORTS
// =============================================================================

export {
  // Client Factory
  getDb,
  getSql,
  // Utilities
  testConnection,
  getConfigInfo,
  closeConnections,
  resetClients,
  // Config Validation
  validateEnv,
} from './db/index.js';

// =============================================================================
// 🚦 CONFIG & FEATURE FLAGS EXPORTS
// =============================================================================

export {
  // Feature Flags
  getFeatureFlags,
  isFeatureEnabled,
  isSyncEnabled,
  getFeatureFlagsInfo,
  // Testing utilities
  setTestFeatureFlags,
  clearTestFeatureFlags,
  getFeatureFlagValue,
} from './config/index.js';

export type { FeatureFlags } from './config/index.js';

// =============================================================================
// 📐 TYPE EXPORTS
// =============================================================================

// --- Core Entity Types ---
export type {
  // Project
  Project,
  ProjectSettings,
  TicketStatus,
  NewProject,
  UpdateProject,
  // User
  User,
  GlobalRole,
  ProjectRole,
  ProjectMember,
  RolePermissions,
  NewUser,
  UpdateUser,
  NewProjectMember,
  // Ticket
  Ticket,
  TicketPriority,
  NewTicket,
  UpdateTicket,
  ClaimTicketData,
  ChangeTicketStatusData,
  // Events
  TicketEvent,
  TicketEventType,
  EventPayload,
  CreatedPayload,
  UpdatedPayload,
  StatusChangedPayload,
  ClaimedPayload,
  UnclaimedPayload,
  CompletedPayload,
  CommentPayload,
  LabelPayload,
  FieldChange,
  NewTicketEvent,
} from './types/index.js';

// --- Sync Types ---
export type {
  SyncState,
  SyncStatus,
  SyncConfig,
  ConflictStrategy,
  RetryConfig,
  OutboxItem,
  EntityType,
  SyncOperation,
  OutboxStatus,
  PullResponse,
  SyncEvent,
  PushRequest,
  PushResponse,
  SyncConflict,
  ConflictStatus,
  // Presence Types (Phase 2.2)
  TicketPresenceState,
  PresenceMode,
  TicketPresenceInfo,
} from './types/index.js';

// --- API Types ---
export type {
  ApiResponse,
  ApiError,
  ApiMeta,
  PaginationParams,
  SortParams,
  PaginatedResponse,
  PaginationInfo,
  FilterParams,
  DateRangeFilter,
  AuthRequest,
  AuthResponse,
  ProjectAuthRequest,
  ProjectAuthResponse,
  ApiErrorCode,
} from './types/index.js';

// --- DB Config Types ---
export type {
  DatabaseConfig,
  ValidatedEnv,
  SyncOperationStatus,
  SyncResult,
} from './types/index.js';

// --- Module Augmentation Types ---
export type { SyncMetadata, Syncable } from './types/index.js';

// =============================================================================
// 🔧 UTILITY EXPORTS
// =============================================================================

export {
  // Project
  TICKET_STATUSES,
  getDefaultProjectSettings,
  createProject,
  // User
  GLOBAL_ROLES,
  PROJECT_ROLES,
  ROLE_PERMISSIONS,
  createUser,
  hasPermission,
  // Ticket
  TICKET_PRIORITIES,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  createTicket,
  isTicketFinal,
  getValidTransitions,
  // Events
  TICKET_EVENT_TYPES,
  createTicketEvent,
  createStatusChangedEvent,
  createClaimedEvent,
  createUpdatedEvent,
  isStatusChangedPayload,
  isClaimedPayload,
  isUpdatedPayload,
  isCommentPayload,
  // Sync
  SYNC_STATUSES,
  CONFLICT_STRATEGIES,
  getDefaultSyncConfig,
  createSyncState,
  createOutboxItem,
  calculateNextRetry,
  // Presence (Phase 2.2)
  PRESENCE_MODES,
  createTicketPresence,
  // API
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  API_ERROR_CODES,
  // Augmentation
  hasSyncMetadata,
  isSynced,
  isDirty,
  addSyncMetadata,
  markAsSynced,
  markAsDirty,
  extractSyncMetadata,
} from './types/index.js';

// =============================================================================
// 🗃️ SCHEMA EXPORTS (Phase 1.1)
// =============================================================================

// Tables & Relations
export {
  // Tables
  projects,
  users,
  projectMembers,
  tickets,
  ticketEvents,
  ticketDependencies,
  syncStates,
  outboxItems,
  // Settings helpers
  getDefaultPublicBoardSettings,
  // Enums
  userRoleEnum,
  projectRoleEnum,
  ticketStatusEnum,
  ticketPriorityEnum,
  eventTypeEnum,
  dependencyTypeEnum,
  outboxStatusEnum,
  // Relations
  projectsRelations,
  usersRelations,
  projectMembersRelations,
  ticketsRelations,
  ticketEventsRelations,
  ticketDependenciesRelations,
  syncStatesRelations,
  // Schema Object
  schema,
} from './db/schema/index.js';

// DB Types (inferred from Schema)
export type {
  // Projects
  ProjectSettingsJson,
  PublicBoardSettings,
  DbProject,
  DbNewProject,
  // Users
  DbUser,
  DbNewUser,
  DbProjectMember,
  DbNewProjectMember,
  // Tickets
  EventPayloadJson,
  DbTicket,
  DbNewTicket,
  DbTicketEvent,
  DbNewTicketEvent,
  // Dependencies (Phase 2.5)
  DependencyType,
  DbTicketDependency,
  DbNewTicketDependency,
  // Sync
  OutboxPayloadJson,
  DbSyncState,
  DbNewSyncState,
  DbOutboxItem,
  DbNewOutboxItem,
} from './db/schema/index.js';

// =============================================================================
// 🚨 ERRORS (Phase 1.2)
// =============================================================================

export {
  // Error Classes
  PgSyncError,
  NotFoundError,
  ConflictError,
  ValidationError,
  PermissionError,
  // Error Codes
  ERROR_CODES,
  // Helper Functions
  isPgSyncError,
  extractErrorInfo,
  type ErrorCode,
} from './errors/index.js';

// =============================================================================
// 🔍 FINDERS (Phase 1.2)
// =============================================================================

export {
  // Project Finders
  findProjectById,
  findProjectBySlug,
  findAllProjects,
  findProjectsByUser,
  findProjectWithMembers,
  projectExists,
  isSlugAvailable,
  countProjects,
  // Phase 3.1: Public Project Finders
  findPublicProjectBySlug,
  findAllPublicProjects,
  isPublicSlugAccessible,
  hasProjectPassword,
  // User Finders
  findUserById,
  findUserByEmail,
  findUserByClientId,
  findUsersByProject,
  findUserRole,
  isProjectMember,
  userExists,
  isEmailAvailable,
  countProjectMembers,
  // Ticket Finders
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
  findTicketAttachmentsByTicketIds,
  // Event Finders
  findEventById,
  findEventsByTicket,
  findEventsSince,
  findEventsSinceId,
  findLatestEvent,
  countEventsSince,
  findEventsWithCreator,
  findRecentProjectEvents,
  // Sync Finders
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
  // Dependency Finders (Phase 2.5)
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
} from './finders/index.js';

// Finder Types
export type {
  FindProjectsOptions,
  ProjectWithMembers,
  // Phase 3.1 + 3.5: Public Project Types
  PublicProjectData,
  PublicBoardSettingsData,
  ProjectMemberWithUser,
  ProjectRole as FinderProjectRole,
  FindTicketsOptions,
  PublicTicketFinderOptions,
  TicketWithRelations,
  StatusCounts,
  PublicTicketData,
  TicketStatus as FinderTicketStatus,
  TicketPriority as FinderTicketPriority,
  EventWithCreator,
  FindEventsOptions,
  TicketAttachmentData,
  OutboxStatus as FinderOutboxStatus,
  OutboxStats,
  // Dependency Finder Types (Phase 2.5)
  FinderDependencyWithTickets,
  DependencyGraphData,
  BlockerInfo,
} from './finders/index.js';

// =============================================================================
// ⚡ ACTIONS (Phase 1.2)
// =============================================================================

export {
  // Project Actions
  createProject as createProjectAction,
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
  validateProjectPassword,
  // Auth Actions (password management with hashing)
  setProjectCustomerPassword,
  removeProjectCustomerPassword,
  // Phase 3.5: Public Board Settings Actions
  updateProjectPublicSettings,
  getProjectPublicSettings,
  // User Actions
  createUser as createUserAction,
  updateUser,
  deleteUser,
  updateLastSeen,
  linkClientId,
  unlinkClientId,
  restoreUser,
  updateUserEmail,
  // Ticket Actions
  createTicket as createTicketAction,
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
  // Attachment Actions
  createTicketAttachments,
  // Event Actions
  createEvent as createEventAction,
  createBulkEvents,
  createCommentEvent,
  // Sync Actions
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
  // Dependency Actions (Phase 2.5)
  addDependency,
  removeDependency,
  removeDependencyByTickets,
  removeAllDependenciesForTicket,
  changeDependencyType,
  isTicketBlocked,
  getBlockingTicketIds,
  wouldCreateCycle,
} from './actions/index.js';

// Action Types
export type {
  CreateProjectData,
  UpdateProjectData,
  ProjectRoleType,
  // Phase 3.1: Auto-Slug Type
  CreateProjectAutoSlugData,
  // Phase 3.5: Public Board Settings Type
  UpdatePublicBoardSettingsData,
  CreateUserData,
  UpdateUserData,
  UserRoleType,
  CreateTicketData,
  UpdateTicketData,
  TicketStatusType,
  TicketPriorityType,
  EventTypeType,
  CreateEventData,
  EventType,
  CreateTicketAttachmentData,
  CreateOutboxData,
  OutboxStatusType,
  // Dependency Action Types (Phase 2.5)
  CreateDependencyData,
  DependencyWithTickets as ActionDependencyWithTickets,
  // Phase 3.4: Public Ticket Types
  CreatePublicTicketData,
  // Phase 7.1: Batch Delete Types
  BatchDeleteResult,
  // Phase 7.2: Batch Status Types
  BatchStatusResult,
  StatusUpdate,
} from './actions/index.js';

// =============================================================================
// 🔄 SYNC SERVICES (Phase 1.3)
// =============================================================================

// --- Sync Types ---
export type {
  // Event Types
  PushEventType,
  SyncEntityType,
  // Outbox Types
  LocalOutboxItem,
  OutboxPayload as SyncOutboxPayload,
  TicketCreatedPayload as SyncTicketCreatedPayload,
  TicketUpdatedPayload as SyncTicketUpdatedPayload,
  StatusChangedPayload as SyncStatusChangedPayload,
  TicketClaimedPayload as SyncTicketClaimedPayload,
  TicketUnclaimedPayload as SyncTicketUnclaimedPayload,
  TicketCompletedPayload as SyncTicketCompletedPayload,
  TicketDeletedPayload,
  LabelChangedPayload,
  FieldChange as SyncFieldChange,
  // Push Types
  PushRequestPayload,
  PushRequestEvent,
  PushResponsePayload,
  PushResult,
  PushConflict,
  ConflictType,
  // Config Types
  ConflictResolutionStrategy,
  PushConfig,
  PushStatus,
  PushProcessResult,
  PushProcessError,
  // Outbox Manager
  CreateOutboxEntry,
  OutboxManagerConfig,
  // Conflict Resolver
  ConflictResolution,
  ConflictAction,
  ConflictDetails,
  UserConflictDecision,
  // Push API
  ApiErrorResponse,
  PushApiConfig,
  // Sync Listener
  LocalFeature,
  StatusChangeEvent,
  ClaimEvent,
  UnclaimEvent,
  LabelEvent,
  FeatureEventHandler,
  FeatureEventType,
  // Push Service
  PushServiceConfig,
  PushServiceEvent,
  PushEventCallback,
} from './sync/index.js';

export {
  // Constants
  DEFAULT_PUSH_CONFIG,
  STATUS_MAP_TO_REMOTE,
  STATUS_MAP_TO_LOCAL,
  PRIORITY_MAP_TO_REMOTE,
  PRIORITY_MAP_TO_LOCAL,
  // Helper Functions
  mapStatusToRemote,
  mapStatusToLocal,
  mapPriorityToRemote,
  mapPriorityToLocal,
  isPushEventType,
  // Outbox Manager
  OutboxManager,
  createOutboxManager,
  generateEventId,
  // Conflict Resolver
  ConflictResolver,
  createConflictResolver,
  // Push API
  PushApi,
  PushApiError,
  createPushApi,
  outboxItemsToPushEvents,
  groupOutboxByProject,
  // Sync Listener
  SyncListener,
  createSyncListener,
  registerSyncListeners,
  // Push Service
  PushService,
  createPushService,
} from './sync/index.js';

// =============================================================================
// 📋 VALIDATIONS (Phase 2.1)
// =============================================================================

export {
  // Schemas
  TicketStatusSchema,
  TicketPrioritySchema,
  CreateTicketSchema,
  UpdateTicketSchema,
  ChangeTicketStatusSchema,
  ClaimTicketSchema,
  // Phase 3.4: Public Ticket Schema
  PublicTicketCategorySchema,
  CreatePublicTicketSchema,
  // Helpers
  validateCreateTicket,
  safeValidateCreateTicket,
  validateUpdateTicket,
  formatZodErrors,
  // Phase 3.4: Public Ticket Helpers
  validateCreatePublicTicket,
  safeValidateCreatePublicTicket,
} from './validations/index.js';

export type {
  TicketStatusSchemaType,
  TicketPrioritySchemaType,
  CreateTicketInput,
  CreateTicketDTO,
  UpdateTicketInput,
  UpdateTicketDTO,
  ChangeTicketStatusDTO,
  ClaimTicketDTO,
  // Phase 3.4: Public Ticket Types
  PublicTicketCategory,
  CreatePublicTicketInput,
  CreatePublicTicketDTO,
} from './validations/index.js';

// =============================================================================
// 🎣 HOOKS (Phase 2.1 + 2.3)
// =============================================================================

export {
  // === TICKET HOOKS (Phase 2.1) ===
  // Query Keys
  ticketKeys,
  // Query Functions
  fetchTicket,
  fetchTicketsByProject,
  fetchTicketsByStatus,
  fetchUserTickets,
  // Mutation Functions
  createTicketMutation,
  updateTicketMutation,
  claimTicketMutation,
  unclaimTicketMutation,
  changeStatusMutation,
  completeTicketMutation,
  deleteTicketMutation,
  // Query Configs
  getTicketQueryConfig,
  getProjectTicketsQueryConfig,
  // Mutation Configs
  getCreateTicketMutationConfig,
  getUpdateTicketMutationConfig,
  getClaimTicketMutationConfig,
  getUnclaimTicketMutationConfig,
  getChangeStatusMutationConfig,
  getCompleteTicketMutationConfig,
  getDeleteTicketMutationConfig,

  // === PROJECT HOOKS (Phase 2.3) ===
  // Query Keys
  projectKeys,
  // Query Functions
  fetchProject,
  fetchProjectBySlug,
  fetchAllProjects,
  fetchMyProjects,
  fetchProjectWithMembers,
  checkSlugAvailability,
  fetchProjectCount,
  checkProjectExists,
  // Mutation Functions
  createProjectMutation,
  updateProjectMutation,
  deleteProjectMutation,
  addMemberMutation,
  changeMemberRoleMutation,
  removeMemberMutation,
  // Query Configs
  getProjectQueryConfig,
  getProjectBySlugQueryConfig,
  getMyProjectsQueryConfig,
  getAllProjectsQueryConfig,
  getProjectWithMembersQueryConfig,
  getSlugAvailabilityQueryConfig,
  getProjectCountQueryConfig,
  // Mutation Configs
  getCreateProjectMutationConfig,
  getUpdateProjectMutationConfig,
  getDeleteProjectMutationConfig,
  getAddMemberMutationConfig,
  getChangeMemberRoleMutationConfig,
  getRemoveMemberMutationConfig,
} from './hooks/index.js';

// Ticket Hook Types (Phase 2.1)
export type {
  TicketCallbacks,
  MutationResult,
  CreateTicketParams,
  UpdateTicketParams as UpdateTicketHookParams,
  ClaimTicketParams,
  UnclaimTicketParams,
  ChangeStatusParams,
  CompleteTicketParams,
  DeleteTicketParams as DeleteTicketHookParams,
} from './hooks/index.js';

// Project Hook Types (Phase 2.3)
export type {
  ProjectCallbacks,
  CreateProjectParams,
  UpdateProjectParams as UpdateProjectHookParams,
  DeleteProjectParams,
  AddMemberParams,
  ChangeMemberRoleParams,
  RemoveMemberParams,
} from './hooks/index.js';

// =============================================================================
// 🔗 DEPENDENCY HOOKS (Phase 2.5)
// =============================================================================

export {
  // Query Keys
  dependencyKeys,
  // Query Functions
  fetchDependency,
  fetchTicketDependencies,
  fetchIncomingDependencies,
  fetchOutgoingDependencies,
  fetchIncomingDependenciesWithTickets,
  fetchOutgoingDependenciesWithTickets,
  fetchBlockerInfo,
  fetchDependencyGraph,
  checkDependencyExists,
  fetchDependencyCount,
  // Mutation Functions
  addDependencyMutation,
  removeDependencyMutation,
  removeDependencyByTicketsMutation,
  changeDependencyTypeMutation,
  // Query Configs
  getDependencyQueryConfig,
  getTicketDependenciesQueryConfig,
  getIncomingDependenciesQueryConfig,
  getOutgoingDependenciesQueryConfig,
  getBlockerInfoQueryConfig,
  getDependencyGraphQueryConfig,
  // Mutation Configs
  getAddDependencyMutationConfig,
  getRemoveDependencyMutationConfig,
  getRemoveDependencyByTicketsMutationConfig,
  getChangeDependencyTypeMutationConfig,
} from './hooks/index.js';

// Dependency Hook Types (Phase 2.5)
export type {
  DependencyCallbacks,
  HookDependencyWithTickets,
  HookDependencyGraphData,
  HookBlockerInfo,
  AddDependencyParams,
  RemoveDependencyParams,
  RemoveDependencyByTicketsParams,
  ChangeDependencyTypeParams,
} from './hooks/index.js';

// =============================================================================
// 🧰 UTILITIES (Phase 3.1)
// =============================================================================

export {
  // Slug Generator
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
  normalizeSlug,
  isReservedSlug,
  RESERVED_SLUGS,
} from './utils/index.js';

export type { SlugOptions, SlugAvailabilityChecker } from './utils/index.js';

// =============================================================================
// 🚧 NOCH NICHT IMPLEMENTIERT (FOLGENDE PHASEN)
// =============================================================================

// Phase 2.x: Route Plugin
// export { registerPgSyncRoutes } from './routes/index.js';
