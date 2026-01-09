/**
 * 🔄 Pull Routes - Sync from Postgres to Local
 *
 * Server-Route für den Pull-Mechanismus.
 * Holt Tickets aus Postgres für lokale Synchronisation.
 *
 * @see docs/pg-online-sync/tasks/phase-4.1-pull-server-route.md
 */

import { Router } from 'express';
import { findProjectById, findTicketsByProject, type DbTicket } from '@automaker/pg-sync';
import {
  writeMultipleFeaturesFromTickets,
  type RemoteTicket,
} from '../../services/feature-writer.js';
import * as secureFs from '../../lib/secure-fs.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Request-Body für POST /pull
 */
interface PullRequest {
  projectId: string;
  since?: string; // ISO Timestamp (optional) - für inkrementelles Sync
  limit?: number; // Max Tickets (default 100)
  cursor?: string; // Pagination Cursor (ticket ID)
}

/**
 * Remote Ticket Format (für Client) - Re-exported from feature-writer
 */
export type { RemoteTicket };

/**
 * Request-Body für POST /pull/to-local
 */
interface PullToLocalRequest {
  projectId: string;
  localProjectPath: string; // Lokaler Projekt-Pfad (z.B. "/home/user/projects/finance")
  overwriteExisting?: boolean; // Default: false
  limit?: number; // Max Tickets (default 100)
}

/**
 * Response-Body für POST /pull/to-local
 */
interface PullToLocalResponse {
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
 * Response-Body für POST /pull
 */
interface PullResponse {
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
 * In-memory sync status tracking (per projectId)
 */
interface SyncStatus {
  isProcessing: boolean;
  lastSyncAt: string | null;
  ticketCount: number;
}

// =============================================================================
// 🗃️ STATE
// =============================================================================

// Simple in-memory tracking for sync status per project
const syncStatuses = new Map<string, SyncStatus>();

// =============================================================================
// 🔧 HELPERS
// =============================================================================

/**
 * Konvertiert ein DB-Ticket in das Remote-Format
 */
function dbTicketToRemote(ticket: DbTicket): RemoteTicket {
  return {
    id: ticket.id,
    localId: ticket.localId,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    labels: ticket.labels ?? [],
    createdBy: ticket.createdBy,
    assignedTo: null, // Not in current schema
    claimedBy: ticket.claimedBy,
    claimedAt: ticket.claimedAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    version: ticket.version,
  };
}

/**
 * Validiert die Pull-Request Parameter
 */
function validatePullRequest(
  body: unknown
): { valid: true; data: PullRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body is required' };
  }

  const req = body as Record<string, unknown>;

  if (!req.projectId || typeof req.projectId !== 'string') {
    return { valid: false, error: 'projectId is required and must be a string' };
  }

  const data: PullRequest = {
    projectId: req.projectId,
  };

  // Optional: since (ISO timestamp)
  if (req.since !== undefined) {
    if (typeof req.since !== 'string') {
      return { valid: false, error: 'since must be an ISO timestamp string' };
    }
    const date = new Date(req.since);
    if (isNaN(date.getTime())) {
      return { valid: false, error: 'since must be a valid ISO timestamp' };
    }
    data.since = req.since;
  }

  // Optional: limit (1-1000)
  if (req.limit !== undefined) {
    if (typeof req.limit !== 'number' || req.limit < 1 || req.limit > 1000) {
      return { valid: false, error: 'limit must be a number between 1 and 1000' };
    }
    data.limit = req.limit;
  }

  // Optional: cursor (ticket ID)
  if (req.cursor !== undefined) {
    if (typeof req.cursor !== 'string') {
      return { valid: false, error: 'cursor must be a string' };
    }
    data.cursor = req.cursor;
  }

  return { valid: true, data };
}

// =============================================================================
// 🚀 ROUTER
// =============================================================================

export function createPullRoutes() {
  const router = Router();

  /**
   * POST /pull
   * Holt Tickets für ein Projekt aus Postgres
   */
  router.post('/', async (req, res) => {
    try {
      // 1. Validierung
      const validation = validatePullRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        } satisfies PullResponse);
      }

      const { projectId, since, limit = 100, cursor } = validation.data;

      // 2. Prüfen ob bereits ein Sync für dieses Projekt läuft
      const existingStatus = syncStatuses.get(projectId);
      if (existingStatus?.isProcessing) {
        return res.status(409).json({
          success: false,
          error: 'A sync operation is already in progress for this project',
        } satisfies PullResponse);
      }

      // 3. Sync-Status setzen
      syncStatuses.set(projectId, {
        isProcessing: true,
        lastSyncAt: existingStatus?.lastSyncAt ?? null,
        ticketCount: existingStatus?.ticketCount ?? 0,
      });

      try {
        // 4. Projekt validieren
        const project = await findProjectById(projectId);
        if (!project) {
          syncStatuses.set(projectId, {
            isProcessing: false,
            lastSyncAt: existingStatus?.lastSyncAt ?? null,
            ticketCount: existingStatus?.ticketCount ?? 0,
          });
          return res.status(404).json({
            success: false,
            error: 'Project not found',
          } satisfies PullResponse);
        }

        // 5. Tickets laden
        // Wir holen limit+1 um zu wissen ob es mehr gibt
        const tickets = await findTicketsByProject(projectId, {
          limit: limit + 1,
          orderBy: 'updated',
          order: 'desc',
          includeDeleted: false,
        });

        // 6. Pagination bestimmen
        const hasMore = tickets.length > limit;
        const resultTickets = hasMore ? tickets.slice(0, limit) : tickets;
        const nextCursor =
          hasMore && resultTickets.length > 0 ? resultTickets[resultTickets.length - 1].id : null;

        // 7. Zu Remote-Format konvertieren
        const remoteTickets = resultTickets.map(dbTicketToRemote);

        // 8. Sync-Status aktualisieren
        const syncTimestamp = new Date().toISOString();
        syncStatuses.set(projectId, {
          isProcessing: false,
          lastSyncAt: syncTimestamp,
          ticketCount: remoteTickets.length,
        });

        // 9. Response senden
        res.json({
          success: true,
          data: {
            tickets: remoteTickets,
            hasMore,
            cursor: nextCursor,
            syncTimestamp,
            projectId: project.id,
            projectName: project.name,
          },
        } satisfies PullResponse);
      } catch (error) {
        // Reset sync status on error
        syncStatuses.set(projectId, {
          isProcessing: false,
          lastSyncAt: existingStatus?.lastSyncAt ?? null,
          ticketCount: existingStatus?.ticketCount ?? 0,
        });
        throw error;
      }
    } catch (error) {
      console.error('Error in pull route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      } satisfies PullResponse);
    }
  });

  /**
   * GET /pull/status
   * Gibt den aktuellen Sync-Status für ein Projekt zurück
   */
  router.get('/status', async (req, res) => {
    try {
      const projectId = req.query.projectId as string | undefined;

      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId query parameter is required',
        });
      }

      // Projekt validieren
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      const status = syncStatuses.get(projectId) ?? {
        isProcessing: false,
        lastSyncAt: null,
        ticketCount: 0,
      };

      res.json({
        success: true,
        data: {
          projectId,
          projectName: project.name,
          ...status,
        },
      });
    } catch (error) {
      console.error('Error in pull status route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  /**
   * GET /pull/project/:projectId
   * Alternative: Tickets für ein Projekt per GET abrufen (für einfachere Nutzung)
   */
  router.get('/project/:projectId', async (req, res) => {
    try {
      const { projectId } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 100, 1000);

      // Projekt validieren
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        } satisfies PullResponse);
      }

      // Tickets laden
      const tickets = await findTicketsByProject(projectId, {
        limit: limit + 1,
        orderBy: 'updated',
        order: 'desc',
        includeDeleted: false,
      });

      const hasMore = tickets.length > limit;
      const resultTickets = hasMore ? tickets.slice(0, limit) : tickets;
      const nextCursor =
        hasMore && resultTickets.length > 0 ? resultTickets[resultTickets.length - 1].id : null;

      const remoteTickets = resultTickets.map(dbTicketToRemote);

      res.json({
        success: true,
        data: {
          tickets: remoteTickets,
          hasMore,
          cursor: nextCursor,
          syncTimestamp: new Date().toISOString(),
          projectId: project.id,
          projectName: project.name,
        },
      } satisfies PullResponse);
    } catch (error) {
      console.error('Error in pull project route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      } satisfies PullResponse);
    }
  });

  /**
   * POST /pull/to-local
   * Holt Tickets aus Postgres UND schreibt sie als lokale feature.json Dateien
   *
   * Dies ist der vollständige Sync-Endpunkt für Phase 4.4:
   * 1. Tickets aus Postgres laden
   * 2. Als lokale Features in .automaker/features/ schreiben
   * 3. Sync-Mapping aktualisieren
   */
  router.post('/to-local', async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;

      // 1. Validierung
      if (!body.projectId || typeof body.projectId !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'projectId is required',
        } satisfies PullToLocalResponse);
      }

      if (!body.localProjectPath || typeof body.localProjectPath !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'localProjectPath is required',
        } satisfies PullToLocalResponse);
      }

      const projectId = body.projectId;
      const localProjectPath = body.localProjectPath;
      const overwriteExisting = body.overwriteExisting === true;
      const limit = typeof body.limit === 'number' ? Math.min(body.limit, 1000) : 100;

      // 2. Lokalen Pfad validieren
      try {
        const stats = await secureFs.stat(localProjectPath);
        if (!stats.isDirectory()) {
          return res.status(400).json({
            success: false,
            error: 'localProjectPath must be a directory',
          } satisfies PullToLocalResponse);
        }
      } catch {
        return res.status(400).json({
          success: false,
          error: 'localProjectPath does not exist or is not accessible',
        } satisfies PullToLocalResponse);
      }

      // 3. Projekt validieren
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        } satisfies PullToLocalResponse);
      }

      // 4. Tickets aus Postgres laden
      const tickets = await findTicketsByProject(projectId, {
        limit,
        orderBy: 'updated',
        order: 'desc',
        includeDeleted: false,
      });

      // 5. Tickets als Remote-Format vorbereiten
      const remoteTickets: RemoteTicket[] = tickets.map(dbTicketToRemote);

      // 6. Als lokale Features schreiben
      const writeResult = await writeMultipleFeaturesFromTickets({
        projectPath: localProjectPath,
        tickets: remoteTickets,
        projectId,
        overwriteExisting,
      });

      // 7. Response senden
      res.json({
        success: writeResult.success,
        data: {
          projectId: project.id,
          projectName: project.name,
          created: writeResult.created,
          updated: writeResult.updated,
          skipped: writeResult.skipped,
          failed: writeResult.failed,
          syncTimestamp: new Date().toISOString(),
        },
      } satisfies PullToLocalResponse);
    } catch (error) {
      console.error('Error in pull to-local route:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      } satisfies PullToLocalResponse);
    }
  });

  return router;
}
