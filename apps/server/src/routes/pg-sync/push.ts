/**
 * 🔼 PG-Sync Push Routes
 *
 * Push local tickets to remote Postgres database for a single project.
 *
 * @see docs/pg-online-sync/tasks/phase-4.3-push-button.md
 */

import path from 'path';
import { Router } from 'express';
import * as secureFs from '../../lib/secure-fs.js';
import {
  findProjectById,
  findTicketByLocalId,
  createTicketAction,
  updateTicket,
} from '@automaker/pg-sync';

// =============================================================================
// 📐 TYPES
// =============================================================================

type LocalFeatureInput = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: number | string;
  labels?: string[];
};

type PushResult = {
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsSkipped: number;
};

type RemoteStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';
type RemotePriority = 'low' | 'medium' | 'high' | 'urgent';

// =============================================================================
// 🔧 HELPERS
// =============================================================================

const STATUS_MAP: Record<string, RemoteStatus> = {
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  review: 'review',
  waiting_approval: 'review',
  verified: 'done',
  done: 'done',
  archived: 'archived',
};

const PRIORITY_MAP: Record<string, RemotePriority> = {
  low: 'low',
  medium: 'medium',
  high: 'high',
  urgent: 'urgent',
  critical: 'urgent',
};

function mapStatus(value: unknown): RemoteStatus {
  if (typeof value !== 'string') {
    return 'backlog';
  }

  const normalized = value.toLowerCase().trim();
  if (normalized.startsWith('pipeline_')) {
    return 'in_progress';
  }

  return STATUS_MAP[normalized] ?? 'backlog';
}

function mapPriority(value: unknown): RemotePriority {
  if (typeof value === 'number') {
    if (value <= 1) return 'high';
    if (value === 2) return 'medium';
    return 'low';
  }

  if (typeof value === 'string') {
    return PRIORITY_MAP[value.toLowerCase().trim()] ?? 'medium';
  }

  return 'medium';
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await secureFs.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = (await secureFs.readFile(filePath, 'utf-8')) as string;
    return JSON.parse(content) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

async function loadLocalFeatures(projectPath: string): Promise<LocalFeatureInput[]> {
  const featuresDir = path.join(projectPath, '.automaker', 'features');

  if (!(await directoryExists(featuresDir))) {
    return [];
  }

  const entries = (await secureFs.readdir(featuresDir, { withFileTypes: true })) as Array<{
    name: string;
    isDirectory: () => boolean;
  }>;
  const featureDirs = entries.filter((entry) => entry.isDirectory());

  const features: LocalFeatureInput[] = [];

  for (const dir of featureDirs) {
    const featureJsonPath = path.join(featuresDir, dir.name, 'feature.json');
    const feature = await readJsonFile<LocalFeatureInput>(featureJsonPath);

    if (feature?.id) {
      features.push(feature);
    }
  }

  return features;
}

// =============================================================================
// 🔼 PUSH LOGIC
// =============================================================================

async function pushLocalTickets(
  projectId: string,
  localProjectPath: string,
  updateExisting: boolean
): Promise<PushResult> {
  const result: PushResult = {
    ticketsCreated: 0,
    ticketsUpdated: 0,
    ticketsSkipped: 0,
  };

  const features = await loadLocalFeatures(localProjectPath);

  for (const feature of features) {
    if (!feature.id) {
      result.ticketsSkipped += 1;
      continue;
    }

    const existingTicket = await findTicketByLocalId(projectId, feature.id);

    const ticketData = {
      title:
        typeof feature.title === 'string' && feature.title.trim()
          ? feature.title.trim()
          : 'Untitled',
      description:
        typeof feature.description === 'string' && feature.description.trim()
          ? feature.description.trim()
          : '',
      status: mapStatus(feature.status),
      priority: mapPriority(feature.priority),
      labels: Array.isArray(feature.labels) ? feature.labels : [],
    };

    if (existingTicket) {
      if (updateExisting) {
        // Update with optimistic locking (using current version)
        await updateTicket(existingTicket.id, ticketData, existingTicket.version);
        result.ticketsUpdated += 1;
      } else {
        result.ticketsSkipped += 1;
      }
    } else {
      await createTicketAction({
        projectId,
        ...ticketData,
        localId: feature.id,
      });
      result.ticketsCreated += 1;
    }
  }

  return result;
}

// =============================================================================
// 🛣️ ROUTES
// =============================================================================

export function createPushRoutes() {
  const router = Router();

  /**
   * POST /projects/:id/push
   * Push local tickets to remote for a single project.
   *
   * Request Body:
   * {
   *   localProjectPath: string;     // Path to local project
   *   includeTickets?: boolean;     // Default: true
   *   updateExisting?: boolean;     // Update existing tickets (default: false)
   * }
   *
   * Response:
   * {
   *   success: boolean;
   *   data: {
   *     ticketsCreated: number;
   *     ticketsUpdated: number;
   *     ticketsSkipped: number;
   *   };
   * }
   */
  router.post('/projects/:id/push', async (req, res) => {
    try {
      const { id: projectId } = req.params;
      const body = req.body as {
        localProjectPath?: string;
        includeTickets?: boolean;
        updateExisting?: boolean;
      };

      // Validate project exists
      const project = await findProjectById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Validate local project path
      const localProjectPath = body.localProjectPath;
      if (!localProjectPath || typeof localProjectPath !== 'string') {
        return res.status(400).json({ error: 'localProjectPath is required' });
      }

      if (!(await directoryExists(localProjectPath))) {
        return res.status(400).json({ error: 'Local project path does not exist' });
      }

      const includeTickets = body.includeTickets !== false;
      const updateExisting = body.updateExisting === true;

      let result: PushResult = {
        ticketsCreated: 0,
        ticketsUpdated: 0,
        ticketsSkipped: 0,
      };

      if (includeTickets) {
        result = await pushLocalTickets(projectId, localProjectPath, updateExisting);
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Error pushing to remote:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
