/**
 * 🔄 Synced Operations Hook
 *
 * Hook for synced feature operations (delete, status update) with Postgres database.
 * Filters features by remoteId and calls batch API endpoints.
 *
 * @see docs/pg-online-sync/tasks/phase-7.0-synced-delete-status.md
 */

import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-fetch';
import { useOnlineProjects, type OnlineProject } from './use-online-projects';
import type { Feature } from '@automaker/types';

// =============================================================================
// 📐 TYPES
// =============================================================================

export interface DeleteResult {
  success: boolean;
  deletedCount: number;
  notFoundIds: string[];
  failedIds: string[];
}

export interface StatusUpdateResult {
  success: boolean;
  updatedCount: number;
  failedIds: string[];
}

export interface UseSyncedOperationsOptions {
  projectPath: string | null;
  projectName: string;
}

export interface UseSyncedOperationsResult {
  // Delete synced features from DB
  deleteSyncedFeatures: (features: Feature[]) => Promise<DeleteResult>;
  isDeleting: boolean;

  // Update status in DB
  updateSyncedStatus: (features: Feature[], newStatus: string) => Promise<StatusUpdateResult>;
  isUpdatingStatus: boolean;

  // Connection info
  isConnected: boolean;
  isLoading: boolean;
  matchingProject: OnlineProject | null;

  // Helper: Filter synced features from a list
  filterSyncedFeatures: (features: Feature[]) => Feature[];
}

// =============================================================================
// 🔧 API TYPES
// =============================================================================

interface BatchDeleteResponse {
  success: boolean;
  data: {
    deletedCount: number;
    notFoundIds: string[];
    failedIds: string[];
  };
}

interface BatchStatusResponse {
  success: boolean;
  data: {
    updatedCount: number;
    failedIds: string[];
  };
}

// =============================================================================
// 🎣 HOOK
// =============================================================================

/**
 * Hook for synced feature operations.
 * Provides delete and status-update functions that sync to Postgres database.
 *
 * @example
 * ```tsx
 * const { deleteSyncedFeatures, updateSyncedStatus, isConnected } = useSyncedOperations({
 *   projectPath: '/path/to/project',
 *   projectName: 'My Project',
 * });
 *
 * // Delete synced features from DB
 * const result = await deleteSyncedFeatures(selectedFeatures);
 *
 * // Update status for synced features
 * await updateSyncedStatus(selectedFeatures, 'in-progress');
 * ```
 */
export function useSyncedOperations({
  projectPath,
  projectName,
}: UseSyncedOperationsOptions): UseSyncedOperationsResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Fetch online projects
  const { data: onlineProjects, isLoading } = useOnlineProjects();

  // Find matching online project by name or slug
  const matchingProject = useMemo(() => {
    if (!onlineProjects || !projectName) return null;

    const normalizedName = projectName.toLowerCase().replace(/\s+/g, '-');
    return onlineProjects.find(
      (p) =>
        p.name.toLowerCase() === projectName.toLowerCase() ||
        p.slug.toLowerCase() === normalizedName ||
        p.name.toLowerCase().replace(/\s+/g, '-') === normalizedName
    );
  }, [onlineProjects, projectName]);

  // Connection status
  const isConnected = !!matchingProject;

  /**
   * Helper: Filter features that have a remoteId (are synced)
   */
  const filterSyncedFeatures = useCallback((features: Feature[]): Feature[] => {
    return features.filter((f) => f.remoteId && f.remoteId.trim().length > 0);
  }, []);

  /**
   * Delete synced features from Postgres database.
   * Only features with remoteId will be processed.
   */
  const deleteSyncedFeatures = useCallback(
    async (features: Feature[]): Promise<DeleteResult> => {
      const emptyResult: DeleteResult = {
        success: false,
        deletedCount: 0,
        notFoundIds: [],
        failedIds: [],
      };

      // Filter to only synced features
      const syncedFeatures = filterSyncedFeatures(features);

      if (syncedFeatures.length === 0) {
        return { ...emptyResult, success: true };
      }

      if (!matchingProject) {
        toast.error('Sync nicht möglich', {
          description: 'Kein passendes Projekt in der Datenbank gefunden',
        });
        return emptyResult;
      }

      setIsDeleting(true);
      try {
        const ticketIds = syncedFeatures.map((f) => f.remoteId!);

        const response = await apiFetch(
          `/api/pg-sync/projects/${matchingProject.id}/tickets/batch-delete`,
          'POST',
          {
            headers: { 'Content-Type': 'application/json' },
            body: { ticketIds },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to delete tickets');
        }

        const result = (await response.json()) as BatchDeleteResponse;

        if (result.success) {
          const { deletedCount, notFoundIds, failedIds } = result.data;

          // Show informative toast
          if (deletedCount > 0) {
            toast.success(`${deletedCount} Ticket(s) aus Datenbank gelöscht`);
          }

          if (failedIds.length > 0) {
            toast.warning(`${failedIds.length} Ticket(s) konnten nicht gelöscht werden`);
          }

          return {
            success: true,
            deletedCount,
            notFoundIds,
            failedIds,
          };
        }

        return emptyResult;
      } catch (error) {
        toast.error('Delete fehlgeschlagen', {
          description: error instanceof Error ? error.message : 'Unbekannter Fehler',
        });
        return emptyResult;
      } finally {
        setIsDeleting(false);
      }
    },
    [matchingProject, filterSyncedFeatures]
  );

  /**
   * Update status for synced features in Postgres database.
   * Only features with remoteId will be processed.
   */
  const updateSyncedStatus = useCallback(
    async (features: Feature[], newStatus: string): Promise<StatusUpdateResult> => {
      const emptyResult: StatusUpdateResult = {
        success: false,
        updatedCount: 0,
        failedIds: [],
      };

      // Filter to only synced features
      const syncedFeatures = filterSyncedFeatures(features);

      if (syncedFeatures.length === 0) {
        return { ...emptyResult, success: true };
      }

      if (!matchingProject) {
        // Silently skip if not connected (status updates happen frequently)
        return emptyResult;
      }

      setIsUpdatingStatus(true);
      try {
        const updates = syncedFeatures.map((f) => ({
          ticketId: f.remoteId!,
          status: newStatus,
          localId: f.id,
        }));

        const response = await apiFetch(
          `/api/pg-sync/projects/${matchingProject.id}/tickets/batch-status`,
          'POST',
          {
            headers: { 'Content-Type': 'application/json' },
            body: { updates },
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update status');
        }

        const result = (await response.json()) as BatchStatusResponse;

        if (result.success) {
          const { updatedCount, failedIds } = result.data;

          // Show toast only if multiple updates (bulk edit)
          // Single status changes should be silent
          if (updatedCount > 1) {
            toast.success(`${updatedCount} Ticket-Status in Datenbank aktualisiert`);
          }

          if (failedIds.length > 0) {
            toast.warning(`${failedIds.length} Ticket(s) konnten nicht aktualisiert werden`);
          }

          return {
            success: true,
            updatedCount,
            failedIds,
          };
        }

        return emptyResult;
      } catch (error) {
        // Silent fail for status updates to avoid spam
        console.error('Status sync failed:', error);
        return emptyResult;
      } finally {
        setIsUpdatingStatus(false);
      }
    },
    [matchingProject, filterSyncedFeatures]
  );

  return {
    deleteSyncedFeatures,
    isDeleting,
    updateSyncedStatus,
    isUpdatingStatus,
    isConnected,
    isLoading,
    matchingProject,
    filterSyncedFeatures,
  };
}
