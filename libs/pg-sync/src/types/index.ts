/**
 * 📐 Shared Types Module - Public Exports
 *
 * Alle Shared Types für das pg-sync Package.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 🏢 PROJECT TYPES
// =============================================================================

export type {
  Project,
  ProjectSettings,
  TicketStatus,
  NewProject,
  UpdateProject,
} from './project.types.js';

export { TICKET_STATUSES, getDefaultProjectSettings, createProject } from './project.types.js';

// =============================================================================
// 👤 USER TYPES
// =============================================================================

export type {
  User,
  GlobalRole,
  ProjectRole,
  ProjectMember,
  RolePermissions,
  NewUser,
  UpdateUser,
  NewProjectMember,
} from './user.types.js';

export {
  GLOBAL_ROLES,
  PROJECT_ROLES,
  ROLE_PERMISSIONS,
  createUser,
  hasPermission,
} from './user.types.js';

// =============================================================================
// 🎫 TICKET TYPES
// =============================================================================

export type {
  Ticket,
  TicketPriority,
  NewTicket,
  UpdateTicket,
  ClaimTicketData,
  ChangeTicketStatusData,
} from './ticket.types.js';

export {
  TICKET_PRIORITIES,
  PRIORITY_CONFIG,
  STATUS_CONFIG,
  createTicket,
  isTicketFinal,
  getValidTransitions,
} from './ticket.types.js';

// =============================================================================
// 📡 EVENT TYPES
// =============================================================================

export type {
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
} from './event.types.js';

export {
  TICKET_EVENT_TYPES,
  createTicketEvent,
  createStatusChangedEvent,
  createClaimedEvent,
  createUpdatedEvent,
  isStatusChangedPayload,
  isClaimedPayload,
  isUpdatedPayload,
  isCommentPayload,
} from './event.types.js';

// =============================================================================
// 🔄 SYNC TYPES
// =============================================================================

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
} from './sync.types.js';

export {
  SYNC_STATUSES,
  CONFLICT_STRATEGIES,
  getDefaultSyncConfig,
  createSyncState,
  createOutboxItem,
  calculateNextRetry,
  // Presence (Phase 2.2)
  PRESENCE_MODES,
  createTicketPresence,
} from './sync.types.js';

// =============================================================================
// 🌐 API TYPES
// =============================================================================

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
} from './api.types.js';

export {
  createSuccessResponse,
  createErrorResponse,
  createPaginatedResponse,
  API_ERROR_CODES,
} from './api.types.js';

// =============================================================================
// 🔌 MODULE AUGMENTATION
// =============================================================================

export type { SyncMetadata, Syncable } from './augmentation.js';

export {
  hasSyncMetadata,
  isSynced,
  isDirty,
  addSyncMetadata,
  markAsSynced,
  markAsDirty,
  extractSyncMetadata,
} from './augmentation.js';

// =============================================================================
// 🗄️ RE-EXPORT DB TYPES
// =============================================================================

// Re-Export der DB-Types die bereits in Phase 0.2 definiert wurden
export type { DatabaseConfig, ValidatedEnv, SyncOperationStatus, SyncResult } from '../db/types.js';
