/**
 * 📦 Sync Index
 *
 * Zentraler Export für alle Sync-Funktionalitäten.
 * Push/Pull Services, Conflict Resolution, Event Listener.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

// =============================================================================
// 📐 TYPES
// =============================================================================

export type {
  // Event Types
  PushEventType,
  SyncEntityType,
  // Outbox Types
  LocalOutboxItem,
  OutboxPayload,
  TicketCreatedPayload,
  TicketUpdatedPayload,
  StatusChangedPayload,
  TicketClaimedPayload,
  TicketUnclaimedPayload,
  TicketCompletedPayload,
  TicketDeletedPayload,
  LabelChangedPayload,
  FieldChange,
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
} from './types.js';

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
} from './types.js';

// =============================================================================
// 📦 OUTBOX MANAGER
// =============================================================================

export type { CreateOutboxEntry, OutboxManagerConfig } from './outbox-manager.js';

export { OutboxManager, createOutboxManager, generateEventId } from './outbox-manager.js';

// =============================================================================
// ⚔️ CONFLICT RESOLVER
// =============================================================================

export type {
  ConflictResolution,
  ConflictAction,
  ConflictDetails,
  UserConflictDecision,
} from './conflict-resolver.js';

export { ConflictResolver, createConflictResolver } from './conflict-resolver.js';

// =============================================================================
// 🌐 PUSH API
// =============================================================================

export type { ApiErrorResponse, RequestOptions, PushApiConfig } from './push-api.js';

export {
  PushApi,
  PushApiError,
  createPushApi,
  outboxItemsToPushEvents,
  groupOutboxByProject,
} from './push-api.js';

// =============================================================================
// 🔊 SYNC LISTENER
// =============================================================================

export type {
  LocalFeature,
  StatusChangeEvent,
  ClaimEvent,
  UnclaimEvent,
  LabelEvent,
  FeatureEventHandler,
  FeatureEventType,
} from './sync-listener.js';

export { SyncListener, createSyncListener, registerSyncListeners } from './sync-listener.js';

// =============================================================================
// ⬆️ PUSH SERVICE
// =============================================================================

export type { PushServiceConfig, PushServiceEvent, PushEventCallback } from './push-service.js';

export { PushService, createPushService } from './push-service.js';

// =============================================================================
// 📐 PULL TYPES
// =============================================================================

export type {
  // Configuration
  PullConfig,
  // API Types
  RemoteEvent,
  RemoteTicket,
  PullRequestParams,
  PullResponsePayload,
  // Status Types
  PullStatus,
  PullProcessResult,
  PullProcessError,
  // Mapping Types
  IdMappingStore,
  IdMapping,
  // Sync State Types
  ProjectSyncState,
  LocalSyncState,
  SyncStateUpdate,
  // Feature Types
  LocalFeatureData,
  CreateLocalFeatureInput,
  UpdateLocalFeatureInput,
  // Event Processing Types
  EventProcessResult,
  EventHandler,
  EventHandlerRegistry,
  // Options Types
  SinglePullOptions,
  PullTrigger,
  PullEvent,
  PullEventCallback,
} from './pull-types.js';

export { DEFAULT_PULL_CONFIG } from './pull-types.js';

// =============================================================================
// 🗺️ ID MAPPER
// =============================================================================

export type { IdMapperConfig } from './id-mapper.js';

export { IdMapper, createIdMapper, DEFAULT_ID_MAPPER_PATH } from './id-mapper.js';

// =============================================================================
// 📊 SYNC STATE MANAGER
// =============================================================================

export type { SyncStateManagerConfig, SyncStatistics } from './sync-state-manager.js';

export {
  SyncStateManager,
  createSyncStateManager,
  generateClientId,
  DEFAULT_SYNC_STATE_PATH,
} from './sync-state-manager.js';

// =============================================================================
// 🔄 FEATURE MAPPER
// =============================================================================

export type { FeatureMapperConfig, FeaturePartialUpdate, TicketForPush } from './feature-mapper.js';

export { FeatureMapper, createFeatureMapper, defaultIdGenerator } from './feature-mapper.js';

// =============================================================================
// 🔄 EVENT PROCESSOR
// =============================================================================

export type { EventProcessorConfig } from './event-processor.js';

export { EventProcessor, createEventProcessor } from './event-processor.js';

// =============================================================================
// 🌐 PULL API
// =============================================================================

export type { PullApiConfig, SyncStatusResponse } from './pull-api.js';

export {
  PullApi,
  PullApiError,
  createPullApi,
  createDefaultPullApi,
  pullConfigToApiConfig,
} from './pull-api.js';

// =============================================================================
// ⬇️ PULL SERVICE
// =============================================================================

export type { PullServiceConfig, SimplePullServiceConfig } from './pull-service.js';

export { PullService, createPullService, createSimplePullService } from './pull-service.js';

// =============================================================================
// ⚙️ SYNC CONFIG (Phase 1.5)
// =============================================================================

export type {
  SyncConflictStrategy,
  SyncIntervalPreset,
  GlobalSyncConfig,
  ProjectSyncConfig,
  RetryConfig,
  SyncConfig,
} from './sync-config.js';

export {
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_RETRY_CONFIG,
  SYNC_INTERVAL_OPTIONS,
  CONFLICT_STRATEGY_OPTIONS,
  createProjectSyncConfig,
  createSyncConfig,
  getEffectiveInterval,
  isSyncEnabled,
  calculateBackoff,
  canRetry,
  validateSyncConfig,
  validateInterval,
  formatInterval,
} from './sync-config.js';

// =============================================================================
// 🌐 NETWORK MONITOR (Phase 1.5)
// =============================================================================

export type {
  NetworkStatus,
  NetworkEvent,
  NetworkStatusCallback,
  NetworkMonitorConfig,
} from './network-monitor.js';

export {
  DEFAULT_NETWORK_CONFIG,
  NetworkMonitor,
  createNetworkMonitor,
  getNetworkMonitor,
  resetNetworkMonitor,
} from './network-monitor.js';

// =============================================================================
// 🔄 RETRY QUEUE (Phase 1.5)
// =============================================================================

export type {
  RetryOperationType,
  RetryQueueItem,
  RetryResult,
  RetryHandler,
  RetryQueueEventType,
  RetryQueueEvent,
  RetryQueueCallback,
  RetryQueueConfig,
} from './retry-queue.js';

export { DEFAULT_RETRY_QUEUE_CONFIG, RetryQueue, createRetryQueue } from './retry-queue.js';

// =============================================================================
// ⏰ SYNC SCHEDULER (Phase 1.5)
// =============================================================================

export type {
  SyncTriggerType,
  SchedulerTimerStatus,
  SyncAction,
  SyncActionResult,
  SyncExecutor,
  SchedulerEventType,
  SchedulerEvent,
  SchedulerEventCallback,
  SyncSchedulerConfig,
} from './sync-scheduler.js';

export {
  SyncScheduler,
  createSyncScheduler,
  createDefaultSyncScheduler,
} from './sync-scheduler.js';

// =============================================================================
// 📊 UI SYNC STATUS MANAGER (Phase 1.5)
// =============================================================================

export type {
  UiSyncState,
  CurrentOperation,
  ToastType,
  ToastMessage,
  UiSyncStatus,
  UiSyncStatusUpdate,
  UiSyncStatusCallback,
  ToastCallback,
  UiSyncStatusManagerConfig,
} from './ui-sync-status-manager.js';

export {
  DEFAULT_UI_SYNC_STATUS,
  DEFAULT_UI_STATUS_CONFIG,
  UiSyncStatusManager,
  createUiSyncStatusManager,
  formatRelativeTime,
  formatRelativeTimeFuture,
  getStatusIcon,
  getStatusLabel,
} from './ui-sync-status-manager.js';
