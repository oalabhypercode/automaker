/**
 * 🎣 Hooks Index
 *
 * Re-exports aller Hooks für das pg-sync Package.
 */

// Ticket Hooks & Utilities
export {
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

  // Query Configs (für React Query)
  getTicketQueryConfig,
  getProjectTicketsQueryConfig,

  // Mutation Configs (für React Query)
  getCreateTicketMutationConfig,
  getUpdateTicketMutationConfig,
  getClaimTicketMutationConfig,
  getUnclaimTicketMutationConfig,
  getChangeStatusMutationConfig,
  getCompleteTicketMutationConfig,
  getDeleteTicketMutationConfig,

  // Types
  type TicketCallbacks,
  type MutationResult,
  type CreateTicketParams,
  type UpdateTicketParams,
  type ClaimTicketParams,
  type UnclaimTicketParams,
  type ChangeStatusParams,
  type CompleteTicketParams,
  type DeleteTicketParams,
} from './use-tickets.js';

// =============================================================================
// 🧭 PROJECT HOOKS (Phase 2.3)
// =============================================================================

export {
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

  // Query Configs (für React Query)
  getProjectQueryConfig,
  getProjectBySlugQueryConfig,
  getMyProjectsQueryConfig,
  getAllProjectsQueryConfig,
  getProjectWithMembersQueryConfig,
  getSlugAvailabilityQueryConfig,
  getProjectCountQueryConfig,

  // Mutation Configs (für React Query)
  getCreateProjectMutationConfig,
  getUpdateProjectMutationConfig,
  getDeleteProjectMutationConfig,
  getAddMemberMutationConfig,
  getChangeMemberRoleMutationConfig,
  getRemoveMemberMutationConfig,

  // Types
  type ProjectCallbacks,
  type CreateProjectParams,
  type UpdateProjectParams,
  type DeleteProjectParams,
  type AddMemberParams,
  type ChangeMemberRoleParams,
  type RemoveMemberParams,
} from './use-projects.js';

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

  // Query Configs (für React Query)
  getDependencyQueryConfig,
  getTicketDependenciesQueryConfig,
  getIncomingDependenciesQueryConfig,
  getOutgoingDependenciesQueryConfig,
  getBlockerInfoQueryConfig,
  getDependencyGraphQueryConfig,

  // Mutation Configs (für React Query)
  getAddDependencyMutationConfig,
  getRemoveDependencyMutationConfig,
  getRemoveDependencyByTicketsMutationConfig,
  getChangeDependencyTypeMutationConfig,

  // Types
  type DependencyCallbacks,
  type DependencyWithTickets as HookDependencyWithTickets,
  type DependencyGraphData as HookDependencyGraphData,
  type BlockerInfo as HookBlockerInfo,
  type AddDependencyParams,
  type RemoveDependencyParams,
  type RemoveDependencyByTicketsParams,
  type ChangeDependencyTypeParams,
} from './use-dependencies.js';
