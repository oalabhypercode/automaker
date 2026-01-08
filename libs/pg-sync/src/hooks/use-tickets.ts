/**
 * 🎣 Ticket Hooks
 *
 * React Query Hooks für Ticket-Operationen.
 * Diese Hooks sind für die Web-UI gedacht und interagieren direkt mit der DB.
 *
 * @see docs/pg-online-sync/tasks/phase-2.1-ticket-creation.md
 */

// =============================================================================
// 📦 HOOK FACTORY TYPES
// =============================================================================

/**
 * Callback-Typen für Hooks (Framework-agnostisch)
 */
export interface TicketCallbacks<TResult> {
  onSuccess?: (result: TResult) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

/**
 * Mutation-Ergebnis (Framework-agnostisch)
 */
export interface MutationResult<TData, TError, TVariables> {
  mutate: (variables: TVariables) => void;
  mutateAsync: (variables: TVariables) => Promise<TData>;
  isLoading: boolean;
  isError: boolean;
  error: TError | null;
  data: TData | undefined;
  reset: () => void;
}

// =============================================================================
// 🔧 TICKET API FUNCTIONS
// =============================================================================

import {
  createTicket as createTicketAction,
  updateTicket as updateTicketAction,
  claimTicket as claimTicketAction,
  unclaimTicket as unclaimTicketAction,
  changeTicketStatus as changeStatusAction,
  completeTicket as completeTicketAction,
  deleteTicket as deleteTicketAction,
  type CreateTicketData,
  type UpdateTicketData,
  type TicketStatusType,
} from '../actions/ticket-actions.js';

import {
  findTicketById,
  findTicketsByProject,
  findTicketsByStatus,
  findTicketsClaimedBy,
} from '../finders/ticket-finder.js';

import type { DbTicket } from '../db/schema/tickets.js';

// =============================================================================
// 📊 QUERY KEY FACTORY
// =============================================================================

/**
 * Query Keys für Ticket-Queries (für Invalidierung)
 */
export const ticketKeys = {
  all: ['tickets'] as const,
  lists: () => [...ticketKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...ticketKeys.lists(), filters] as const,
  byProject: (projectId: string) => [...ticketKeys.all, 'project', projectId] as const,
  byStatus: (projectId: string, status: string) =>
    [...ticketKeys.all, 'project', projectId, 'status', status] as const,
  byUser: (userId: string) => [...ticketKeys.all, 'user', userId] as const,
  details: () => [...ticketKeys.all, 'detail'] as const,
  detail: (id: string) => [...ticketKeys.details(), id] as const,
};

// =============================================================================
// 📊 QUERY FUNCTIONS (für React Query useQuery)
// =============================================================================

/**
 * Lädt ein einzelnes Ticket
 */
export async function fetchTicket(ticketId: string): Promise<DbTicket | null> {
  return findTicketById(ticketId);
}

/**
 * Lädt alle Tickets eines Projekts
 */
export async function fetchTicketsByProject(
  projectId: string,
  options?: {
    includeArchived?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<DbTicket[]> {
  return findTicketsByProject(projectId, options);
}

/**
 * Lädt Tickets nach Status
 */
export async function fetchTicketsByStatus(
  projectId: string,
  status: TicketStatusType
): Promise<DbTicket[]> {
  return findTicketsByStatus(projectId, status);
}

/**
 * Lädt Tickets eines Users (geclaimed)
 */
export async function fetchUserTickets(userId: string): Promise<DbTicket[]> {
  return findTicketsClaimedBy(userId);
}

// =============================================================================
// ⚡ MUTATION FUNCTIONS (für React Query useMutation)
// =============================================================================

/**
 * Create-Mutation Funktion
 */
export interface CreateTicketParams extends CreateTicketData {}

export async function createTicketMutation(params: CreateTicketParams): Promise<DbTicket> {
  return createTicketAction(params);
}

/**
 * Update-Mutation Funktion
 */
export interface UpdateTicketParams {
  ticketId: string;
  data: UpdateTicketData;
  expectedVersion: number;
  userId?: string;
}

export async function updateTicketMutation(params: UpdateTicketParams): Promise<DbTicket> {
  return updateTicketAction(params.ticketId, params.data, params.expectedVersion, params.userId);
}

/**
 * Claim-Mutation Funktion
 */
export interface ClaimTicketParams {
  ticketId: string;
  userId: string;
}

export async function claimTicketMutation(params: ClaimTicketParams): Promise<DbTicket> {
  return claimTicketAction(params.ticketId, params.userId);
}

/**
 * Unclaim-Mutation Funktion
 */
export interface UnclaimTicketParams {
  ticketId: string;
  userId?: string;
}

export async function unclaimTicketMutation(params: UnclaimTicketParams): Promise<DbTicket> {
  return unclaimTicketAction(params.ticketId, params.userId);
}

/**
 * Status-Change-Mutation Funktion
 */
export interface ChangeStatusParams {
  ticketId: string;
  newStatus: TicketStatusType;
  userId?: string;
}

export async function changeStatusMutation(params: ChangeStatusParams): Promise<DbTicket> {
  return changeStatusAction(params.ticketId, params.newStatus, params.userId);
}

/**
 * Complete-Mutation Funktion
 */
export interface CompleteTicketParams {
  ticketId: string;
  userId?: string;
}

export async function completeTicketMutation(params: CompleteTicketParams): Promise<DbTicket> {
  return completeTicketAction(params.ticketId, params.userId);
}

/**
 * Delete-Mutation Funktion
 */
export interface DeleteTicketParams {
  ticketId: string;
  userId?: string;
}

export async function deleteTicketMutation(params: DeleteTicketParams): Promise<void> {
  return deleteTicketAction(params.ticketId, params.userId);
}

// =============================================================================
// 🎯 HOOK FACTORY CONFIGS (für React Query)
// =============================================================================

/**
 * Config für useQuery Hook (Ticket-Details)
 */
export function getTicketQueryConfig(ticketId: string) {
  return {
    queryKey: ticketKeys.detail(ticketId),
    queryFn: () => fetchTicket(ticketId),
    enabled: !!ticketId,
  };
}

/**
 * Config für useQuery Hook (Projekt-Tickets)
 */
export function getProjectTicketsQueryConfig(
  projectId: string,
  options?: { includeArchived?: boolean; limit?: number; offset?: number }
) {
  return {
    queryKey: ticketKeys.byProject(projectId),
    queryFn: () => fetchTicketsByProject(projectId, options),
    enabled: !!projectId,
  };
}

/**
 * Config für useMutation Hook (Create)
 */
export function getCreateTicketMutationConfig() {
  return {
    mutationFn: createTicketMutation,
  };
}

/**
 * Config für useMutation Hook (Update)
 */
export function getUpdateTicketMutationConfig() {
  return {
    mutationFn: updateTicketMutation,
  };
}

/**
 * Config für useMutation Hook (Claim)
 */
export function getClaimTicketMutationConfig() {
  return {
    mutationFn: claimTicketMutation,
  };
}

/**
 * Config für useMutation Hook (Status Change)
 */
export function getChangeStatusMutationConfig() {
  return {
    mutationFn: changeStatusMutation,
  };
}

/**
 * Config für useMutation Hook (Complete)
 */
export function getCompleteTicketMutationConfig() {
  return {
    mutationFn: completeTicketMutation,
  };
}

/**
 * Config für useMutation Hook (Delete)
 */
export function getDeleteTicketMutationConfig() {
  return {
    mutationFn: deleteTicketMutation,
  };
}

/**
 * Config für useMutation Hook (Unclaim)
 */
export function getUnclaimTicketMutationConfig() {
  return {
    mutationFn: unclaimTicketMutation,
  };
}
