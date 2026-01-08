/**
 * 🎣 Dependency Hooks (React Query Configs)
 *
 * Framework-agnostic React Query Konfigurations-Factories für Dependency-Operationen.
 *
 * @see docs/pg-online-sync/tasks/phase-2.5-dependency-graph.md
 */

import type { DependencyType, DbTicketDependency } from '../db/schema/index.js';
import {
  addDependency,
  removeDependency,
  removeDependencyByTickets,
  changeDependencyType,
  type CreateDependencyData,
} from '../actions/index.js';
import {
  findDependencyById,
  findOutgoingDependencies,
  findIncomingDependencies,
  findAllDependenciesForTicket,
  findIncomingDependenciesWithTickets,
  findOutgoingDependenciesWithTickets,
  getBlockerInfo,
  getDependencyGraphData,
  dependencyExists,
  countDependencies,
  type DependencyGraphData,
  type BlockerInfo,
  type FinderDependencyWithTickets as DependencyWithTickets,
} from '../finders/index.js';

// =============================================================================
// 🔑 QUERY KEY FACTORIES
// =============================================================================

/**
 * Query Key Factory für Dependency-Queries
 *
 * Strukturierte Keys für konsistentes Cache-Invalidieren:
 * - dependency.all() - Alle Dependencies
 * - dependency.byId(id) - Einzelne Dependency
 * - dependency.ticket(id) - Alle Dependencies eines Tickets
 * - dependency.project(id) - Graph-Daten eines Projekts
 * - dependency.blockerInfo(id) - Blocker-Info eines Tickets
 */
export const dependencyKeys = {
  all: () => ['dependencies'] as const,
  byId: (id: string) => ['dependencies', 'detail', id] as const,
  ticket: (ticketId: string) => ['dependencies', 'ticket', ticketId] as const,
  ticketIncoming: (ticketId: string) => ['dependencies', 'ticket', ticketId, 'incoming'] as const,
  ticketOutgoing: (ticketId: string) => ['dependencies', 'ticket', ticketId, 'outgoing'] as const,
  project: (projectId: string) => ['dependencies', 'project', projectId] as const,
  graph: (projectId: string) => ['dependencies', 'graph', projectId] as const,
  blockerInfo: (ticketId: string) => ['dependencies', 'blockerInfo', ticketId] as const,
  exists: (sourceId: string, targetId: string) =>
    ['dependencies', 'exists', sourceId, targetId] as const,
};

// =============================================================================
// 🔍 QUERY FUNCTIONS
// =============================================================================

/**
 * Fetcht eine einzelne Dependency
 */
export async function fetchDependency(id: string): Promise<DbTicketDependency | undefined> {
  return findDependencyById(id);
}

/**
 * Fetcht alle Dependencies eines Tickets
 */
export async function fetchTicketDependencies(ticketId: string): Promise<DbTicketDependency[]> {
  return findAllDependenciesForTicket(ticketId);
}

/**
 * Fetcht eingehende Dependencies (Blocker)
 */
export async function fetchIncomingDependencies(
  ticketId: string,
  relationType?: DependencyType
): Promise<DbTicketDependency[]> {
  return findIncomingDependencies(ticketId, relationType);
}

/**
 * Fetcht ausgehende Dependencies
 */
export async function fetchOutgoingDependencies(
  ticketId: string,
  relationType?: DependencyType
): Promise<DbTicketDependency[]> {
  return findOutgoingDependencies(ticketId, relationType);
}

/**
 * Fetcht eingehende Dependencies mit Ticket-Details
 */
export async function fetchIncomingDependenciesWithTickets(
  ticketId: string
): Promise<DependencyWithTickets[]> {
  return findIncomingDependenciesWithTickets(ticketId);
}

/**
 * Fetcht ausgehende Dependencies mit Ticket-Details
 */
export async function fetchOutgoingDependenciesWithTickets(
  ticketId: string
): Promise<DependencyWithTickets[]> {
  return findOutgoingDependenciesWithTickets(ticketId);
}

/**
 * Fetcht Blocker-Informationen
 */
export async function fetchBlockerInfo(ticketId: string): Promise<BlockerInfo> {
  return getBlockerInfo(ticketId);
}

/**
 * Fetcht Graph-Daten für Visualisierung
 */
export async function fetchDependencyGraph(projectId: string): Promise<DependencyGraphData> {
  return getDependencyGraphData(projectId);
}

/**
 * Prüft ob eine Abhängigkeit existiert
 */
export async function checkDependencyExists(
  sourceTicketId: string,
  targetTicketId: string,
  relationType?: DependencyType
): Promise<boolean> {
  return dependencyExists(sourceTicketId, targetTicketId, relationType);
}

/**
 * Zählt Dependencies eines Tickets
 */
export async function fetchDependencyCount(ticketId: string): Promise<{
  incoming: number;
  outgoing: number;
  total: number;
}> {
  return countDependencies(ticketId);
}

// =============================================================================
// ✏️ MUTATION FUNCTIONS
// =============================================================================

/**
 * Erstellt eine neue Dependency
 */
export async function addDependencyMutation(params: {
  data: CreateDependencyData;
  userId?: string;
}): Promise<DbTicketDependency> {
  return addDependency(params.data, params.userId);
}

/**
 * Entfernt eine Dependency
 */
export async function removeDependencyMutation(params: { dependencyId: string }): Promise<void> {
  return removeDependency(params.dependencyId);
}

/**
 * Entfernt eine Dependency anhand von Source und Target
 */
export async function removeDependencyByTicketsMutation(params: {
  sourceTicketId: string;
  targetTicketId: string;
  relationType?: DependencyType;
}): Promise<number> {
  return removeDependencyByTickets(
    params.sourceTicketId,
    params.targetTicketId,
    params.relationType
  );
}

/**
 * Ändert den Typ einer Dependency
 */
export async function changeDependencyTypeMutation(params: {
  dependencyId: string;
  newType: DependencyType;
}): Promise<DbTicketDependency> {
  return changeDependencyType(params.dependencyId, params.newType);
}

// =============================================================================
// ⚙️ QUERY CONFIGS
// =============================================================================

/**
 * Config für einzelne Dependency Query
 */
export function getDependencyQueryConfig(id: string) {
  return {
    queryKey: dependencyKeys.byId(id),
    queryFn: () => fetchDependency(id),
    enabled: !!id,
  };
}

/**
 * Config für Ticket-Dependencies Query
 */
export function getTicketDependenciesQueryConfig(ticketId: string) {
  return {
    queryKey: dependencyKeys.ticket(ticketId),
    queryFn: () => fetchTicketDependencies(ticketId),
    enabled: !!ticketId,
  };
}

/**
 * Config für eingehende Dependencies (Blocker)
 */
export function getIncomingDependenciesQueryConfig(ticketId: string) {
  return {
    queryKey: dependencyKeys.ticketIncoming(ticketId),
    queryFn: () => fetchIncomingDependenciesWithTickets(ticketId),
    enabled: !!ticketId,
  };
}

/**
 * Config für ausgehende Dependencies
 */
export function getOutgoingDependenciesQueryConfig(ticketId: string) {
  return {
    queryKey: dependencyKeys.ticketOutgoing(ticketId),
    queryFn: () => fetchOutgoingDependenciesWithTickets(ticketId),
    enabled: !!ticketId,
  };
}

/**
 * Config für Blocker-Info
 */
export function getBlockerInfoQueryConfig(ticketId: string) {
  return {
    queryKey: dependencyKeys.blockerInfo(ticketId),
    queryFn: () => fetchBlockerInfo(ticketId),
    enabled: !!ticketId,
  };
}

/**
 * Config für Dependency-Graph
 */
export function getDependencyGraphQueryConfig(projectId: string) {
  return {
    queryKey: dependencyKeys.graph(projectId),
    queryFn: () => fetchDependencyGraph(projectId),
    enabled: !!projectId,
    // Graph-Daten seltener refetchen
    staleTime: 30 * 1000, // 30 Sekunden
  };
}

// =============================================================================
// ⚙️ MUTATION CONFIGS
// =============================================================================

/**
 * Callbacks für Dependency-Mutations
 */
export interface DependencyCallbacks {
  onSuccess?: (data: DbTicketDependency) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}

/**
 * Config für Add-Dependency Mutation
 */
export function getAddDependencyMutationConfig(callbacks?: DependencyCallbacks) {
  return {
    mutationFn: addDependencyMutation,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
    onSettled: callbacks?.onSettled,
  };
}

/**
 * Config für Remove-Dependency Mutation
 */
export function getRemoveDependencyMutationConfig(callbacks?: {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}) {
  return {
    mutationFn: removeDependencyMutation,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
    onSettled: callbacks?.onSettled,
  };
}

/**
 * Config für Remove-Dependency-By-Tickets Mutation
 */
export function getRemoveDependencyByTicketsMutationConfig(callbacks?: {
  onSuccess?: (count: number) => void;
  onError?: (error: Error) => void;
  onSettled?: () => void;
}) {
  return {
    mutationFn: removeDependencyByTicketsMutation,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
    onSettled: callbacks?.onSettled,
  };
}

/**
 * Config für Change-Dependency-Type Mutation
 */
export function getChangeDependencyTypeMutationConfig(callbacks?: DependencyCallbacks) {
  return {
    mutationFn: changeDependencyTypeMutation,
    onSuccess: callbacks?.onSuccess,
    onError: callbacks?.onError,
    onSettled: callbacks?.onSettled,
  };
}

// =============================================================================
// 📐 TYPES EXPORT
// =============================================================================

export type { DependencyGraphData, BlockerInfo };

// Re-export DependencyWithTickets under a specific name
export type { DependencyWithTickets };

export type AddDependencyParams = {
  data: CreateDependencyData;
  userId?: string;
};

export type RemoveDependencyParams = {
  dependencyId: string;
};

export type RemoveDependencyByTicketsParams = {
  sourceTicketId: string;
  targetTicketId: string;
  relationType?: DependencyType;
};

export type ChangeDependencyTypeParams = {
  dependencyId: string;
  newType: DependencyType;
};
