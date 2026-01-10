/**
 * 🔄 Database Sync Hook
 *
 * Unified hook for syncing features between local filesystem and Postgres database.
 * Provides simplified Pull/Push operations with automatic project matching.
 *
 * @see docs/pg-online-sync/tasks/phase-6.3-simplified-sync.md
 */

import { useMemo, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useOnlineProjects,
  usePullToLocal,
  usePushToRemote,
  type OnlineProject,
  type PullToLocalResponse,
  type PushResponse,
} from './use-online-projects';

// =============================================================================
// 📐 TYPES
// =============================================================================

export interface PullResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

export interface PushResult {
  success: boolean;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsSkipped: number;
}

export interface UseDatabaseSyncOptions {
  projectPath: string | null;
  projectName: string;
  onFeaturesUpdated?: () => void;
}

export interface UseDatabaseSyncResult {
  // Pull: Postgres → Local Features
  pullFromDatabase: () => Promise<PullResult>;
  isPulling: boolean;

  // Push: Local Features → Postgres
  pushToDatabase: () => Promise<PushResult>;
  isPushing: boolean;

  // Connection status
  isConnected: boolean;
  isLoading: boolean;
  matchingProject: OnlineProject | null;
}

// =============================================================================
// 🎣 HOOK
// =============================================================================

/**
 * Unified hook for database sync operations.
 * Automatically finds matching online project and provides Pull/Push functions.
 *
 * @example
 * ```tsx
 * const { pullFromDatabase, pushToDatabase, isConnected, isPulling, isPushing } = useDatabaseSync({
 *   projectPath: '/path/to/project',
 *   projectName: 'My Project',
 *   onFeaturesUpdated: () => refetchFeatures(),
 * });
 * ```
 */
export function useDatabaseSync({
  projectPath,
  projectName,
  onFeaturesUpdated,
}: UseDatabaseSyncOptions): UseDatabaseSyncResult {
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);

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

  // Initialize mutations with project ID
  const pullMutation = usePullToLocal(matchingProject?.id ?? '');
  const pushMutation = usePushToRemote(matchingProject?.id ?? '');

  // Connection status
  const isConnected = !!matchingProject;

  /**
   * Pull from Database - Fetches tickets from Postgres and writes to local features
   */
  const pullFromDatabase = useCallback(async (): Promise<PullResult> => {
    const emptyResult: PullResult = {
      success: false,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
    };

    if (!matchingProject || !projectPath) {
      toast.error('Sync nicht möglich', {
        description: 'Kein passendes Projekt in der Datenbank gefunden',
      });
      return emptyResult;
    }

    setIsPulling(true);
    try {
      const result: PullToLocalResponse = await pullMutation.mutateAsync({
        localProjectPath: projectPath,
        overwriteExisting: false,
      });

      if (result.success && result.data) {
        const { created, updated, skipped, failed } = result.data;

        // Show informative toast
        if (created > 0 || updated > 0) {
          toast.success(`${created + updated} Ticket(s) aus Datenbank geladen`, {
            description: `Erstellt: ${created}, Aktualisiert: ${updated}`,
          });
        } else {
          toast.info('Keine neuen Tickets', {
            description: 'Alle Tickets sind bereits synchronisiert',
          });
        }

        // Trigger feature reload
        onFeaturesUpdated?.();

        return { success: true, created, updated, skipped, failed };
      }

      toast.error('Pull fehlgeschlagen', {
        description: result.error || 'Unbekannter Fehler',
      });
      return emptyResult;
    } catch (error) {
      toast.error('Pull fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      return emptyResult;
    } finally {
      setIsPulling(false);
    }
  }, [matchingProject, projectPath, pullMutation, onFeaturesUpdated]);

  /**
   * Push to Database - Sends local features to Postgres
   */
  const pushToDatabase = useCallback(async (): Promise<PushResult> => {
    const emptyResult: PushResult = {
      success: false,
      ticketsCreated: 0,
      ticketsUpdated: 0,
      ticketsSkipped: 0,
    };

    if (!matchingProject || !projectPath) {
      toast.error('Sync nicht möglich', {
        description: 'Kein passendes Projekt in der Datenbank gefunden',
      });
      return emptyResult;
    }

    setIsPushing(true);
    try {
      const result: PushResponse = await pushMutation.mutateAsync({
        localProjectPath: projectPath,
        includeTickets: true,
        updateExisting: true,
      });

      if (result.success) {
        const { ticketsCreated, ticketsUpdated, ticketsSkipped } = result.data;

        // Show informative toast
        if (ticketsCreated > 0 || ticketsUpdated > 0) {
          toast.success(`${ticketsCreated + ticketsUpdated} Ticket(s) zur Datenbank gesendet`, {
            description: `Erstellt: ${ticketsCreated}, Aktualisiert: ${ticketsUpdated}`,
          });
        } else {
          toast.info('Keine Änderungen', {
            description: 'Alle Tickets sind bereits synchronisiert',
          });
        }

        return { success: true, ticketsCreated, ticketsUpdated, ticketsSkipped };
      }

      toast.error('Push fehlgeschlagen', {
        description: result.error || 'Unbekannter Fehler',
      });
      return emptyResult;
    } catch (error) {
      toast.error('Push fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler',
      });
      return emptyResult;
    } finally {
      setIsPushing(false);
    }
  }, [matchingProject, projectPath, pushMutation]);

  return {
    pullFromDatabase,
    isPulling,
    pushToDatabase,
    isPushing,
    isConnected,
    isLoading,
    matchingProject,
  };
}
