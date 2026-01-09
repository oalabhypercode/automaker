/**
 * 🔄 Online Projects Hooks
 *
 * React Query hooks for managing online-sync projects and their public settings.
 *
 * @see docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-fetch';

// =============================================================================
// 📐 TYPES
// =============================================================================

export interface PublicBoardSettings {
  allowTicketCreation: boolean;
  showComments: boolean;
  visibleStatuses: string[];
  introMessage: string;
  theme: 'dark' | 'light';
}

export interface OnlineProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  customerAccessEnabled: boolean;
  hasPassword: boolean;
  syncEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  publicSettings: PublicBoardSettings;
}

export interface UpdatePublicSettingsPayload {
  allowTicketCreation?: boolean;
  showComments?: boolean;
  visibleStatuses?: string[];
  introMessage?: string;
  theme?: 'dark' | 'light';
}

export interface SeedLocalProjectInput {
  name: string;
  path: string;
}

export interface SeedLocalProjectsPayload {
  projects?: SeedLocalProjectInput[];
  includeTickets?: boolean;
}

export interface SeedLocalProjectsSummary {
  projectsProcessed: number;
  projectsCreated: number;
  projectsSkipped: number;
  ticketsCreated: number;
  ticketsSkipped: number;
}

export interface SeedLocalProjectsResponse {
  success: boolean;
  summary: SeedLocalProjectsSummary;
}

// =============================================================================
// 📥 PULL TYPES
// =============================================================================

/**
 * Remote Ticket Format (from Postgres)
 */
export interface RemoteTicket {
  id: string;
  localId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  labels: string[];
  createdBy: string | null;
  assignedTo: string | null;
  claimedBy: string | null;
  claimedAt: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

/**
 * Pull Response from Server
 */
export interface PullResponse {
  success: boolean;
  data?: {
    tickets: RemoteTicket[];
    hasMore: boolean;
    cursor: string | null;
    syncTimestamp: string;
    projectId: string;
    projectName: string;
  };
  error?: string;
}

/**
 * Pull Options
 */
export interface PullOptions {
  since?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Pull To Local Request (Phase 4.4)
 */
export interface PullToLocalRequest {
  localProjectPath: string;
  overwriteExisting?: boolean;
  limit?: number;
}

/**
 * Pull To Local Response (Phase 4.4)
 */
export interface PullToLocalResponse {
  success: boolean;
  data?: {
    projectId: string;
    projectName: string;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
    syncTimestamp: string;
  };
  error?: string;
}

/**
 * Pull Sync Status
 */
export interface PullSyncStatus {
  projectId: string;
  projectName: string;
  isProcessing: boolean;
  lastSyncAt: string | null;
  ticketCount: number;
}

// =============================================================================
// 📤 PUSH TYPES
// =============================================================================

/**
 * Push Request Body
 */
export interface PushRequest {
  localProjectPath: string;
  includeTickets?: boolean;
  updateExisting?: boolean;
}

/**
 * Push Response from Server
 */
export interface PushResponse {
  success: boolean;
  data: {
    ticketsCreated: number;
    ticketsUpdated: number;
    ticketsSkipped: number;
  };
  error?: string;
}

// =============================================================================
// 🔍 QUERY HOOKS
// =============================================================================

const QUERY_KEYS = {
  projects: ['pg-sync', 'projects'] as const,
  project: (id: string) => ['pg-sync', 'projects', id] as const,
  pullStatus: (id: string) => ['pg-sync', 'pull-status', id] as const,
};

/**
 * Fetches all online-sync projects
 */
export function useOnlineProjects() {
  return useQuery({
    queryKey: QUERY_KEYS.projects,
    queryFn: async () => {
      const response = await apiFetch('/api/pg-sync/projects');
      if (!response.ok) {
        throw new Error('Failed to fetch online projects');
      }
      const data = await response.json();
      return data.projects as OnlineProject[];
    },
  });
}

/**
 * Fetches a single online-sync project
 */
export function useOnlineProject(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.project(id),
    queryFn: async () => {
      const response = await apiFetch(`/api/pg-sync/projects/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      return (await response.json()) as OnlineProject;
    },
    enabled: !!id,
  });
}

// =============================================================================
// ⚡ MUTATION HOOKS
// =============================================================================

/**
 * Updates public board settings for a project
 */
export function useUpdatePublicSettings(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdatePublicSettingsPayload) => {
      const response = await apiFetch(
        `/api/pg-sync/projects/${projectId}/public-settings`,
        'PATCH',
        {
          headers: { 'Content-Type': 'application/json' },
          body: data,
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Enables customer access for a project
 */
export function useEnableCustomerAccess(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/enable-access`, 'POST', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to enable access');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Disables customer access for a project
 */
export function useDisableCustomerAccess(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/disable-access`, 'POST', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to disable access');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Sets the customer password for a project
 */
export function useSetProjectPassword(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (password: string) => {
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/set-password`, 'POST', {
        headers: { 'Content-Type': 'application/json' },
        body: { password },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to set password');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Removes the customer password from a project
 */
export function useRemoveProjectPassword(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiFetch(
        `/api/pg-sync/projects/${projectId}/remove-password`,
        'POST',
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to remove password');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Updates the project slug (public URL)
 */
export function useUpdateProjectSlug(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (slug: string) => {
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/slug`, 'PATCH', {
        headers: { 'Content-Type': 'application/json' },
        body: { slug },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update slug');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.project(projectId) });
    },
  });
}

/**
 * Seeds local projects into the online-sync database
 */
export function useSeedLocalProjects() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SeedLocalProjectsPayload) => {
      const response = await apiFetch('/api/pg-sync/projects/seed-local', 'POST', {
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to seed local projects');
      }
      return (await response.json()) as SeedLocalProjectsResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}

// =============================================================================
// 📥 PULL HOOKS
// =============================================================================

/**
 * Fetches pull sync status for a project
 */
export function usePullSyncStatus(projectId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.pullStatus(projectId),
    queryFn: async () => {
      const response = await apiFetch(`/api/pg-sync/pull/status?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch sync status');
      }
      const result = await response.json();
      return result.data as PullSyncStatus;
    },
    enabled: !!projectId,
    refetchInterval: false,
  });
}

/**
 * Pulls tickets from remote Postgres database
 */
export function usePullFromRemote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: PullOptions | void) => {
      const response = await apiFetch('/api/pg-sync/pull', 'POST', {
        headers: { 'Content-Type': 'application/json' },
        body: { projectId, ...(options || {}) },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pull from remote');
      }
      return (await response.json()) as PullResponse;
    },
    onSuccess: () => {
      // Invalidate both projects list and pull status
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pullStatus(projectId) });
    },
  });
}

/**
 * Pulls tickets from remote Postgres and writes them as local feature.json files
 * This is the main sync hook for Phase 4.4 - Local Feature Integration
 */
export function usePullToLocal(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PullToLocalRequest) => {
      const response = await apiFetch('/api/pg-sync/pull/to-local', 'POST', {
        headers: { 'Content-Type': 'application/json' },
        body: { projectId, ...request },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to pull to local');
      }
      return (await response.json()) as PullToLocalResponse;
    },
    onSuccess: () => {
      // Invalidate both projects list and pull status
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pullStatus(projectId) });
    },
  });
}

// =============================================================================
// 📤 PUSH HOOKS
// =============================================================================

/**
 * Pushes local tickets to remote Postgres database
 */
export function usePushToRemote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: PushRequest) => {
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/push`, 'POST', {
        headers: { 'Content-Type': 'application/json' },
        body: request,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to push to remote');
      }
      return (await response.json()) as PushResponse;
    },
    onSuccess: () => {
      // Invalidate projects list to refresh ticket counts
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
    },
  });
}
