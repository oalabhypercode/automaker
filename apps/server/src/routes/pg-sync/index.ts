/**
 * 🔄 PG-Sync Routes (Internal)
 *
 * Internal API endpoints for managing Online-Sync projects and their public settings.
 * These routes are protected by authentication.
 *
 * @see docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
 */

import path from 'path';
import { Router } from 'express';
import type { SettingsService } from '../../services/settings-service.js';
import * as secureFs from '../../lib/secure-fs.js';
import {
  findAllProjects,
  findProjectById,
  updateProjectPublicSettings,
  enableCustomerAccess,
  disableCustomerAccess,
  setProjectCustomerPassword,
  removeProjectCustomerPassword,
  updateProjectSlug,
  findProjectBySlug,
  findTicketByLocalId,
  createProjectAction,
  createTicketAction,
  type UpdatePublicBoardSettingsData,
} from '@automaker/pg-sync';
import { createPullRoutes } from './pull.js';
import { createPushRoutes } from './push.js';

type LocalProjectInput = {
  name: string;
  path: string;
};

type LocalFeatureInput = {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: number | string;
  labels?: string[];
};

type SeedSummary = {
  projectsProcessed: number;
  projectsCreated: number;
  projectsSkipped: number;
  ticketsCreated: number;
  ticketsSkipped: number;
};

type RemoteStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';
type RemotePriority = 'low' | 'medium' | 'high' | 'urgent';

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

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

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

async function ensureProjectInDb(project: LocalProjectInput) {
  const name = project.name?.trim() || path.basename(project.path);
  const baseSlug = slugifyName(name) || slugifyName(path.basename(project.path)) || 'project';

  const existing = await findProjectBySlug(baseSlug);
  if (existing) {
    return { project: existing, created: false };
  }

  const created = await createProjectAction({
    name,
    slug: baseSlug,
    description: 'Imported from local project',
    syncEnabled: true,
  });

  return { project: created, created: true };
}

async function seedLocalProject(project: LocalProjectInput, includeTickets: boolean) {
  if (!project.path || !(await directoryExists(project.path))) {
    return { skipped: true, createdProject: false, ticketsCreated: 0, ticketsSkipped: 0 };
  }

  const { project: dbProject, created } = await ensureProjectInDb(project);

  let ticketsCreated = 0;
  let ticketsSkipped = 0;

  if (includeTickets) {
    const features = await loadLocalFeatures(project.path);

    for (const feature of features) {
      if (!feature.id) continue;

      const existingTicket = await findTicketByLocalId(dbProject.id, feature.id);
      if (existingTicket) {
        ticketsSkipped += 1;
        continue;
      }

      await createTicketAction({
        projectId: dbProject.id,
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
        localId: feature.id,
      });

      ticketsCreated += 1;
    }
  }

  return { skipped: false, createdProject: created, ticketsCreated, ticketsSkipped };
}

export function createPgSyncRoutes(settingsService?: SettingsService) {
  const router = Router();

  /**
   * GET /projects
   * Returns all projects with their public settings for management.
   */
  router.get('/projects', async (_req, res) => {
    try {
      const projects = await findAllProjects({ includeDeleted: false });

      const projectsWithSettings = projects.map((project) => {
        const settings = project.settings as Record<string, unknown> | null;
        const publicSettings = settings?.publicSettings as Record<string, unknown> | undefined;

        return {
          id: project.id,
          name: project.name,
          slug: project.slug,
          description: project.description,
          customerAccessEnabled: project.customerAccessEnabled,
          hasPassword: !!project.customerPasswordHash,
          syncEnabled: project.syncEnabled,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          publicSettings: {
            allowTicketCreation: publicSettings?.allowTicketCreation ?? true,
            showComments: publicSettings?.showComments ?? false,
            visibleStatuses: publicSettings?.visibleStatuses ?? ['todo', 'in_progress', 'done'],
            introMessage: publicSettings?.introMessage ?? '',
            theme: publicSettings?.theme ?? 'dark',
          },
        };
      });

      res.json({ projects: projectsWithSettings });
    } catch (error) {
      console.error('Error fetching pg-sync projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /projects/seed-local
   * Creates missing online projects (and tickets) from local projects.
   */
  router.post('/projects/seed-local', async (req, res) => {
    try {
      const body = (req.body ?? {}) as {
        projects?: LocalProjectInput[];
        includeTickets?: boolean;
      };

      let projects = body.projects ?? [];

      if (projects.length === 0 && settingsService) {
        const settings = await settingsService.getGlobalSettings();
        projects = (settings.projects as LocalProjectInput[]) ?? [];
      }

      const summary: SeedSummary = {
        projectsProcessed: 0,
        projectsCreated: 0,
        projectsSkipped: 0,
        ticketsCreated: 0,
        ticketsSkipped: 0,
      };

      if (projects.length === 0) {
        res.json({ success: true, summary });
        return;
      }

      const includeTickets = body.includeTickets !== false;

      for (const project of projects) {
        summary.projectsProcessed += 1;

        try {
          const result = await seedLocalProject(project, includeTickets);
          if (result.skipped) {
            summary.projectsSkipped += 1;
            continue;
          }

          if (result.createdProject) {
            summary.projectsCreated += 1;
          }

          summary.ticketsCreated += result.ticketsCreated;
          summary.ticketsSkipped += result.ticketsSkipped;
        } catch (error) {
          console.error('Error seeding project:', project.path, error);
          summary.projectsSkipped += 1;
        }
      }

      res.json({ success: true, summary });
    } catch (error) {
      console.error('Error seeding local projects:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /projects/:id
   * Returns a single project with its public settings.
   */
  router.get('/projects/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const project = await findProjectById(id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const settings = project.settings as Record<string, unknown> | null;
      const publicSettings = settings?.publicSettings as Record<string, unknown> | undefined;

      res.json({
        id: project.id,
        name: project.name,
        slug: project.slug,
        description: project.description,
        customerAccessEnabled: project.customerAccessEnabled,
        hasPassword: !!project.customerPasswordHash,
        syncEnabled: project.syncEnabled,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        publicSettings: {
          allowTicketCreation: publicSettings?.allowTicketCreation ?? true,
          showComments: publicSettings?.showComments ?? false,
          visibleStatuses: publicSettings?.visibleStatuses ?? ['todo', 'in_progress', 'done'],
          introMessage: publicSettings?.introMessage ?? '',
          theme: publicSettings?.theme ?? 'dark',
        },
      });
    } catch (error) {
      console.error('Error fetching pg-sync project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PATCH /projects/:id/public-settings
   * Updates public board settings for a project.
   */
  router.patch('/projects/:id/public-settings', async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body as UpdatePublicBoardSettingsData;

      const project = await updateProjectPublicSettings(id, data);

      res.json({ success: true, project });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.error('Error updating public settings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /projects/:id/enable-access
   * Enables customer access for a project.
   */
  router.post('/projects/:id/enable-access', async (req, res) => {
    try {
      const { id } = req.params;
      const project = await enableCustomerAccess(id);

      res.json({ success: true, customerAccessEnabled: project.customerAccessEnabled });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.error('Error enabling customer access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /projects/:id/disable-access
   * Disables customer access for a project.
   */
  router.post('/projects/:id/disable-access', async (req, res) => {
    try {
      const { id } = req.params;
      const project = await disableCustomerAccess(id);

      res.json({ success: true, customerAccessEnabled: project.customerAccessEnabled });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.error('Error disabling customer access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /projects/:id/set-password
   * Sets or updates the customer password for a project.
   */
  router.post('/projects/:id/set-password', async (req, res) => {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || typeof password !== 'string' || password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters' });
      }

      // setProjectCustomerPassword handles hashing internally
      await setProjectCustomerPassword(id, password);

      res.json({ success: true, hasPassword: true });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.error('Error setting password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /projects/:id/remove-password
   * Removes the customer password from a project.
   */
  router.post('/projects/:id/remove-password', async (req, res) => {
    try {
      const { id } = req.params;
      await removeProjectCustomerPassword(id);

      res.json({ success: true, hasPassword: false });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      console.error('Error removing password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * PATCH /projects/:id/slug
   * Updates the slug (public URL) of a project.
   */
  router.patch('/projects/:id/slug', async (req, res) => {
    try {
      const { id } = req.params;
      const { slug } = req.body;

      if (!slug || typeof slug !== 'string') {
        return res.status(400).json({ error: 'Slug is required' });
      }

      const project = await updateProjectSlug(id, slug);

      res.json({ success: true, slug: project.slug });
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Project not found' });
      }
      if (err.code === 'SLUG_TAKEN') {
        return res.status(409).json({ error: 'Slug is already in use' });
      }
      if (err.code === 'INVALID_SLUG') {
        return res.status(400).json({ error: err.message || 'Invalid slug format' });
      }
      console.error('Error updating slug:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ==========================================================================
  // 🔄 Pull Routes (Phase 4.1)
  // ==========================================================================
  router.use('/pull', createPullRoutes());

  // ==========================================================================
  // 🔼 Push Routes (Phase 4.3)
  // ==========================================================================
  router.use('/', createPushRoutes());

  return router;
}
