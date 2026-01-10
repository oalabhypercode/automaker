/**
 * 🗑️ PG-Sync Delete Routes
 *
 * Batch-Delete synced tickets from remote Postgres database.
 *
 * @see docs/pg-online-sync/tasks/phase-7.0-synced-delete-status.md
 */

import { Router } from 'express';
import { findProjectById, deleteMultipleTickets, type BatchDeleteResult } from '@automaker/pg-sync';

// =============================================================================
// 📐 TYPES
// =============================================================================

interface BatchDeleteRequest {
  /** Postgres Ticket-IDs (remoteId from local Features) */
  ticketIds: string[];
}

interface BatchDeleteResponse {
  success: boolean;
  data: BatchDeleteResult;
}

// =============================================================================
// 🛣️ ROUTES
// =============================================================================

export function createDeleteRoutes() {
  const router = Router();

  /**
   * POST /projects/:id/tickets/batch-delete
   * Soft-delete multiple tickets from remote Postgres database.
   *
   * Request Body:
   * {
   *   ticketIds: string[];  // Array of Postgres Ticket-IDs (Feature.remoteId)
   * }
   *
   * Response:
   * {
   *   success: boolean;
   *   data: {
   *     deletedCount: number;
   *     notFoundIds: string[];
   *     failedIds: string[];
   *   };
   * }
   */
  router.post('/projects/:id/tickets/batch-delete', async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const body = req.body as BatchDeleteRequest;

      // Validate project exists
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Project not found',
        });
      }

      // Validate request body
      const ticketIds = body.ticketIds;
      if (!Array.isArray(ticketIds)) {
        return res.status(400).json({
          success: false,
          error: 'ticketIds must be an array',
        });
      }

      // Filter out empty strings and validate
      const validTicketIds = ticketIds.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0
      );

      if (validTicketIds.length === 0) {
        return res.json({
          success: true,
          data: {
            deletedCount: 0,
            notFoundIds: [],
            failedIds: [],
          },
        } satisfies BatchDeleteResponse);
      }

      // Perform batch delete (soft-delete)
      const result = await deleteMultipleTickets(validTicketIds);

      res.json({
        success: true,
        data: result,
      } satisfies BatchDeleteResponse);
    } catch (error) {
      console.error('Error in batch delete:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  });

  return router;
}
