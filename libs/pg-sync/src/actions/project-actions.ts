/**
 * ⚡ Project Actions
 *
 * Mutations für Projekte (INSERT, UPDATE, DELETE).
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, isNull } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { projects, projectMembers } from '../db/schema/index.js';
import type {
  DbProject,
  DbNewProject,
  DbProjectMember,
  DbNewProjectMember,
  ProjectSettingsJson,
} from '../db/schema/index.js';
import { NotFoundError, ConflictError, ValidationError } from '../errors/index.js';
import { isSlugAvailable, findProjectById } from '../finders/project-finder.js';
import { isProjectMember as checkProjectMember } from '../finders/user-finder.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Daten für Projekt-Erstellung
 */
export interface CreateProjectData {
  name: string;
  slug: string;
  description?: string;
  customerPasswordHash?: string;
  customerAccessEnabled?: boolean;
  syncEnabled?: boolean;
  settings?: ProjectSettingsJson;
}

/**
 * Daten für Projekt-Update
 */
export interface UpdateProjectData {
  name?: string;
  slug?: string;
  description?: string;
  customerPasswordHash?: string;
  customerAccessEnabled?: boolean;
  syncEnabled?: boolean;
}

/**
 * Projekt-Rolle für Mitgliedschaft
 */
export type ProjectRoleType = 'owner' | 'admin' | 'member' | 'viewer';

// =============================================================================
// ⚡ ACTION FUNCTIONS
// =============================================================================

/**
 * Erstellt ein neues Projekt
 *
 * @throws ValidationError - Wenn Slug bereits vergeben
 */
export async function createProject(data: CreateProjectData): Promise<DbProject> {
  const db = getDb();

  // Slug normalisieren und validieren
  const normalizedSlug = data.slug.toLowerCase().trim();

  if (!(await isSlugAvailable(normalizedSlug))) {
    throw ValidationError.slugTaken(normalizedSlug);
  }

  const insertData: DbNewProject = {
    name: data.name.trim(),
    slug: normalizedSlug,
    description: data.description?.trim(),
    customerPasswordHash: data.customerPasswordHash,
    customerAccessEnabled: data.customerAccessEnabled ?? false,
    syncEnabled: data.syncEnabled ?? true,
    settings: data.settings ?? {},
  };

  const [project] = await db.insert(projects).values(insertData).returning();

  return project;
}

/**
 * Aktualisiert ein Projekt
 *
 * @throws NotFoundError - Wenn Projekt nicht gefunden
 * @throws ValidationError - Wenn neuer Slug bereits vergeben
 */
export async function updateProject(id: string, data: UpdateProjectData): Promise<DbProject> {
  const db = getDb();

  // Projekt prüfen
  const existing = await findProjectById(id);
  if (!existing) {
    throw new NotFoundError('project', id);
  }

  // Slug-Validierung (falls geändert)
  if (data.slug && data.slug !== existing.slug) {
    const normalizedSlug = data.slug.toLowerCase().trim();
    if (!(await isSlugAvailable(normalizedSlug, id))) {
      throw ValidationError.slugTaken(normalizedSlug);
    }
    data.slug = normalizedSlug;
  }

  const updateData = {
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.slug !== undefined && { slug: data.slug }),
    ...(data.description !== undefined && { description: data.description?.trim() }),
    ...(data.customerPasswordHash !== undefined && {
      customerPasswordHash: data.customerPasswordHash,
    }),
    ...(data.customerAccessEnabled !== undefined && {
      customerAccessEnabled: data.customerAccessEnabled,
    }),
    ...(data.syncEnabled !== undefined && { syncEnabled: data.syncEnabled }),
    updatedAt: new Date(),
  };

  const [project] = await db
    .update(projects)
    .set(updateData)
    .where(eq(projects.id, id))
    .returning();

  return project;
}

/**
 * Soft-Delete eines Projekts
 *
 * @throws NotFoundError - Wenn Projekt nicht gefunden
 */
export async function deleteProject(id: string): Promise<void> {
  const db = getDb();

  const existing = await findProjectById(id);
  if (!existing) {
    throw new NotFoundError('project', id);
  }

  await db
    .update(projects)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id));
}

/**
 * Aktualisiert die Settings eines Projekts
 */
export async function updateProjectSettings(
  id: string,
  settings: Partial<ProjectSettingsJson>
): Promise<DbProject> {
  const db = getDb();

  const existing = await findProjectById(id);
  if (!existing) {
    throw new NotFoundError('project', id);
  }

  const mergedSettings: ProjectSettingsJson = {
    ...existing.settings,
    ...settings,
  };

  const [project] = await db
    .update(projects)
    .set({
      settings: mergedSettings,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  return project;
}

/**
 * Fügt einen User als Projekt-Mitglied hinzu
 *
 * @throws ConflictError - Wenn User bereits Mitglied ist
 */
export async function addProjectMember(
  projectId: string,
  userId: string,
  role: ProjectRoleType = 'member'
): Promise<DbProjectMember> {
  const db = getDb();

  // Prüfen ob bereits Mitglied
  if (await checkProjectMember(userId, projectId)) {
    throw ConflictError.alreadyExists('ProjectMember', 'userId', userId);
  }

  const [member] = await db
    .insert(projectMembers)
    .values({
      projectId,
      userId,
      role,
    })
    .returning();

  return member;
}

/**
 * Entfernt einen User aus einem Projekt
 */
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  const db = getDb();

  await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
}

/**
 * Ändert die Rolle eines Projekt-Mitglieds
 *
 * @throws NotFoundError - Wenn User kein Mitglied ist
 */
export async function changeProjectMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRoleType
): Promise<DbProjectMember> {
  const db = getDb();

  if (!(await checkProjectMember(userId, projectId))) {
    throw new NotFoundError('user', userId, { projectId });
  }

  const [member] = await db
    .update(projectMembers)
    .set({ role })
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning();

  return member;
}

/**
 * Restauriert ein gelöschtes Projekt
 */
export async function restoreProject(id: string): Promise<DbProject> {
  const db = getDb();

  const [project] = await db
    .update(projects)
    .set({
      deletedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  if (!project) {
    throw new NotFoundError('project', id);
  }

  return project;
}

// =============================================================================
// 🌐 CUSTOMER ACCESS ACTIONS (Phase 3.1)
// =============================================================================

/**
 * Daten für Projekt-Erstellung mit Auto-Slug
 * (Slug wird automatisch aus dem Namen generiert)
 */
export interface CreateProjectAutoSlugData {
  name: string;
  description?: string;
  customerAccessEnabled?: boolean;
  syncEnabled?: boolean;
  settings?: ProjectSettingsJson;
}

/**
 * Erstellt ein Projekt mit automatisch generiertem Slug
 *
 * Der Slug wird aus dem Namen generiert:
 * - "Website Relaunch 2025" → "website-relaunch-2025"
 * - Falls Slug bereits existiert, wird ein Zähler angehängt
 *
 * @see libs/pg-sync/src/utils/slug-generator.ts
 */
export async function createProjectWithAutoSlug(
  data: CreateProjectAutoSlugData
): Promise<DbProject> {
  // Dynamischer Import um zirkuläre Abhängigkeiten zu vermeiden
  const { generateUniqueSlug } = await import('../utils/slug-generator.js');

  // Einzigartigen Slug generieren
  const slug = await generateUniqueSlug(data.name, isSlugAvailable);

  // Projekt mit generiertem Slug erstellen
  return createProject({
    ...data,
    slug,
  });
}

/**
 * Aktiviert den Kunden-Zugang für ein Projekt
 *
 * Nach Aktivierung ist das Projekt unter /p/{slug} erreichbar.
 * Optional kann ein Passwort-Schutz eingerichtet werden.
 *
 * @param projectId - Die Projekt-ID
 * @param passwordHash - Optional: Gehashtes Passwort für Zugangsschutz
 */
export async function enableCustomerAccess(
  projectId: string,
  passwordHash?: string
): Promise<DbProject> {
  const db = getDb();

  const existing = await findProjectById(projectId);
  if (!existing) {
    throw new NotFoundError('project', projectId);
  }

  const [project] = await db
    .update(projects)
    .set({
      customerAccessEnabled: true,
      ...(passwordHash !== undefined && { customerPasswordHash: passwordHash }),
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

/**
 * Deaktiviert den Kunden-Zugang für ein Projekt
 *
 * Das Projekt ist danach nicht mehr unter /p/{slug} erreichbar.
 * Das Passwort wird beibehalten (für spätere Reaktivierung).
 */
export async function disableCustomerAccess(projectId: string): Promise<DbProject> {
  const db = getDb();

  const existing = await findProjectById(projectId);
  if (!existing) {
    throw new NotFoundError('project', projectId);
  }

  const [project] = await db
    .update(projects)
    .set({
      customerAccessEnabled: false,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

/**
 * Setzt oder aktualisiert das Kunden-Passwort
 *
 * WICHTIG: Das Passwort muss VOR dem Aufruf gehasht werden!
 * Diese Funktion speichert den Hash direkt.
 *
 * @param projectId - Die Projekt-ID
 * @param passwordHash - Der Passwort-Hash (z.B. bcrypt)
 */
export async function setProjectPassword(
  projectId: string,
  passwordHash: string
): Promise<DbProject> {
  const db = getDb();

  const existing = await findProjectById(projectId);
  if (!existing) {
    throw new NotFoundError('project', projectId);
  }

  if (!passwordHash || passwordHash.trim() === '') {
    throw new ValidationError('PASSWORD_REQUIRED', 'Password hash cannot be empty');
  }

  const [project] = await db
    .update(projects)
    .set({
      customerPasswordHash: passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

/**
 * Entfernt den Passwort-Schutz eines Projekts
 *
 * Das Projekt ist danach öffentlich ohne Login erreichbar
 * (sofern customerAccessEnabled = true).
 */
export async function removeProjectPassword(projectId: string): Promise<DbProject> {
  const db = getDb();

  const existing = await findProjectById(projectId);
  if (!existing) {
    throw new NotFoundError('project', projectId);
  }

  const [project] = await db
    .update(projects)
    .set({
      customerPasswordHash: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

/**
 * Aktualisiert den Slug eines Projekts
 *
 * WARNUNG: Dies ändert die öffentliche URL!
 * Alte Links werden danach nicht mehr funktionieren.
 *
 * @param projectId - Die Projekt-ID
 * @param newSlug - Der neue Slug (wird validiert und normalisiert)
 */
export async function updateProjectSlug(projectId: string, newSlug: string): Promise<DbProject> {
  // Dynamischer Import
  const { isValidSlug, normalizeSlug } = await import('../utils/slug-generator.js');

  // Slug validieren
  const validation = isValidSlug(newSlug);
  if (!validation.valid) {
    throw new ValidationError('INVALID_SLUG', validation.error || 'Invalid slug');
  }

  const normalized = normalizeSlug(newSlug);

  // Verfügbarkeit prüfen
  if (!(await isSlugAvailable(normalized, projectId))) {
    throw ValidationError.slugTaken(normalized);
  }

  return updateProject(projectId, { slug: normalized });
}

// =============================================================================
// 🛡️ PUBLIC BOARD SETTINGS ACTIONS (Phase 3.5)
// =============================================================================

/**
 * Daten für Public Board Settings Update
 */
export interface UpdatePublicBoardSettingsData {
  /** Dürfen Kunden Tickets erstellen? */
  allowTicketCreation?: boolean;
  /** Öffentliche Kommentare anzeigen? */
  showComments?: boolean;
  /** Welche Status-Spalten werden angezeigt? */
  visibleStatuses?: string[];
  /** Willkommensnachricht für Kunden */
  introMessage?: string;
  /** Theme für das Kunden-Board */
  theme?: 'dark' | 'light';
}

/**
 * Aktualisiert die Public Board Settings eines Projekts
 *
 * Diese Einstellungen steuern, was Kunden auf dem öffentlichen Board
 * sehen und tun dürfen.
 *
 * @param projectId - Die Projekt-ID
 * @param data - Die neuen Settings (werden gemerged)
 *
 * @example
 * ```ts
 * // Ticket-Erstellung deaktivieren
 * await updateProjectPublicSettings(projectId, { allowTicketCreation: false });
 *
 * // Nur bestimmte Status-Spalten zeigen
 * await updateProjectPublicSettings(projectId, {
 *   visibleStatuses: ['todo', 'done']
 * });
 * ```
 */
export async function updateProjectPublicSettings(
  projectId: string,
  data: UpdatePublicBoardSettingsData
): Promise<DbProject> {
  const db = getDb();

  // Import for default settings
  const { getDefaultPublicBoardSettings } = await import('../db/schema/projects.js');

  const existing = await findProjectById(projectId);
  if (!existing) {
    throw new NotFoundError('project', projectId);
  }

  // Get current public settings or defaults
  const currentPublicSettings =
    (existing.settings as ProjectSettingsJson)?.publicSettings ?? getDefaultPublicBoardSettings();

  // Merge new settings with existing ones
  const newPublicSettings = {
    ...currentPublicSettings,
    ...(data.allowTicketCreation !== undefined && {
      allowTicketCreation: data.allowTicketCreation,
    }),
    ...(data.showComments !== undefined && { showComments: data.showComments }),
    ...(data.visibleStatuses !== undefined && { visibleStatuses: data.visibleStatuses }),
    ...(data.introMessage !== undefined && { introMessage: data.introMessage }),
    ...(data.theme !== undefined && { theme: data.theme }),
  };

  // Merge into full settings
  const mergedSettings: ProjectSettingsJson = {
    ...existing.settings,
    publicSettings: newPublicSettings,
  };

  const [project] = await db
    .update(projects)
    .set({
      settings: mergedSettings,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId))
    .returning();

  return project;
}

/**
 * Gibt die Public Board Settings eines Projekts zurück
 *
 * Falls keine Settings gesetzt sind, werden Defaults zurückgegeben.
 */
export async function getProjectPublicSettings(projectId: string): Promise<{
  allowTicketCreation: boolean;
  showComments: boolean;
  visibleStatuses: string[];
  introMessage?: string;
  theme: 'dark' | 'light';
}> {
  const { getDefaultPublicBoardSettings } = await import('../db/schema/projects.js');

  const project = await findProjectById(projectId);
  if (!project) {
    throw new NotFoundError('project', projectId);
  }

  const publicSettings = (project.settings as ProjectSettingsJson)?.publicSettings;

  if (!publicSettings) {
    return getDefaultPublicBoardSettings();
  }

  // Ensure all required fields exist (for backwards compatibility)
  const defaults = getDefaultPublicBoardSettings();
  return {
    allowTicketCreation: publicSettings.allowTicketCreation ?? defaults.allowTicketCreation,
    showComments: publicSettings.showComments ?? defaults.showComments,
    visibleStatuses: publicSettings.visibleStatuses ?? defaults.visibleStatuses,
    introMessage: publicSettings.introMessage,
    theme: publicSettings.theme ?? defaults.theme,
  };
}
