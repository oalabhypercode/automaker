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

// =============================================================================
// 🔍 QUERY HOOKS
// =============================================================================

const QUERY_KEYS = {
  projects: ['pg-sync', 'projects'] as const,
  project: (id: string) => ['pg-sync', 'projects', id] as const,
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/public-settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/enable-access`, {
        method: 'POST',
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/disable-access`, {
        method: 'POST',
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/remove-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
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
      const response = await apiFetch(`/api/pg-sync/projects/${projectId}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
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
