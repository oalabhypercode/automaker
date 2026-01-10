/**
 * 🔄 PG-Sync Status Routes
 *
 * Batch-Update status for synced tickets in remote Postgres database.
 *
 * @see docs/pg-online-sync/tasks/phase-7.0-synced-delete-status.md
 */

import { Router } from 'express';
import {
  findProjectById,
  updateMultipleTicketsStatus,
  type BatchStatusResult,
  type StatusUpdate,
  type TicketStatusType,
} from '@automaker/pg-sync';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Status-Mapping von Local (Kanban) zu Remote (Postgres)
 */
const STATUS_MAP: Record<string, TicketStatusType> = {
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  review: 'review',
  waiting_approval: 'review',
  verified: 'done',
  done: 'done',
  completed: 'archived',
  archived: 'archived',
};

/**
 * Request-Body für Batch-Status-Update
 */
interface BatchStatusRequest {
  updates: Array<{
    ticketId: string;
    status: string;
    localId?: string;
  }>;
}

interface BatchStatusResponse {
  success: boolean;
  data: BatchStatusResult;
}

// =============================================================================
// 🛣️ ROUTES
// =============================================================================

export function createStatusRoutes() {
  const router = Router();

  /**
   * POST /projects/:id/tickets/batch-status
   * Update status of multiple tickets in remote Postgres database.
   *
   * Request Body:
   * {
   *   updates: Array<{
   *     ticketId: string;   // Postgres Ticket-ID (Feature.remoteId)
   *     status: string;     // New status (local format, will be mapped)
   *     localId?: string;   // Optional: Local Feature-ID for audit
   *   }>
   * }
   *
   * Response:
   * {
   *   success: boolean;
   *   data: {
   *     updatedCount: number;
   *     failedIds: string[];
   *   };
   * }
   */
  router.post('/projects/:id/tickets/batch-status', async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const body = req.body as BatchStatusRequest;

      // Validate project exists
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      // Validate request body
      const updates = body.updates;
      if (!Array.isArray(updates)) {
        return res.status(400).json({
          success: false,
          error: 'updates must be an array',
        });
      }

      // Filter and map updates
      const validUpdates: StatusUpdate[] = [];

      for (const update of updates) {
        // Skip invalid entries
        if (typeof update.ticketId !== 'string' || !update.ticketId.trim()) {
          continue;
        }
        if (typeof update.status !== 'string' || !update.status.trim()) {
          continue;
        }

        // Map local status to remote status
        const normalizedStatus = update.status.toLowerCase().trim();
        let remoteStatus: TicketStatusType;

        // Handle pipeline_ prefix (e.g., pipeline_development)
        if (normalizedStatus.startsWith('pipeline_')) {
          remoteStatus = 'in_progress';
        } else {
          remoteStatus = STATUS_MAP[normalizedStatus] ?? 'backlog';
        }

        validUpdates.push({
          ticketId: update.ticketId.trim(),
          status: remoteStatus,
          localId: update.localId?.trim(),
        });
      }

      if (validUpdates.length === 0) {
        return res.json({
          success: true,
          data: {
            updatedCount: 0,
            failedIds: [],
          },
        } satisfies BatchStatusResponse);
      }

      // Perform batch status update
      const result = await updateMultipleTicketsStatus(validUpdates);

      res.json({
        success: true,
        data: result,
      } satisfies BatchStatusResponse);
    } catch (error) {
      console.error('Error in batch status update:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  return router;
}
