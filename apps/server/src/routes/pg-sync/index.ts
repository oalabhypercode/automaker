/**
 * 🔄 PG-Sync Routes (Internal)
 *
 * Internal API endpoints for managing Online-Sync projects and their public settings.
 * These routes are protected by authentication.
 *
 * @see docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
 */

import { Router } from 'express';
import {
  findAllProjects,
  findProjectById,
  updateProjectPublicSettings,
  enableCustomerAccess,
  disableCustomerAccess,
  setProjectCustomerPassword,
  removeProjectCustomerPassword,
  updateProjectSlug,
  type UpdatePublicBoardSettingsData,
} from '@automaker/pg-sync';

export function createPgSyncRoutes() {
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

  return router;
}
