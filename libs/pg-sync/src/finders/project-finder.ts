/**
 * 🔍 Project Finder
 *
 * Read-Only Queries für Projekte.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, isNull, ilike, desc, asc, count } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { getDefaultPublicBoardSettings } from '../db/schema/projects.js';
import { projects, projectMembers, users } from '../db/schema/index.js';
import type { DbProject, DbProjectMember, PublicBoardSettings } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Optionen für findAllProjects
 */
export interface FindProjectsOptions {
  /** Suchtext für Name */
  search?: string;
  /** Sortierung */
  orderBy?: 'name' | 'created' | 'updated';
  /** Sortierrichtung */
  order?: 'asc' | 'desc';
  /** Limit */
  limit?: number;
  /** Offset für Pagination */
  offset?: number;
  /** Gelöschte einschließen? */
  includeDeleted?: boolean;
}

/**
 * Projekt mit Mitgliedern
 */
export interface ProjectWithMembers extends DbProject {
  members: Array<DbProjectMember & { user: typeof users.$inferSelect }>;
}

// =============================================================================
// 🔍 FINDER FUNCTIONS
// =============================================================================

/**
 * Findet ein Projekt nach ID
 */
export async function findProjectById(id: string): Promise<DbProject | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet ein Projekt nach Slug (URL-freundlicher Identifier)
 */
export async function findProjectBySlug(slug: string): Promise<DbProject | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(projects)
    .where(and(eq(projects.slug, slug.toLowerCase()), isNull(projects.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet alle Projekte mit Filterung und Pagination
 */
export async function findAllProjects(options: FindProjectsOptions = {}): Promise<DbProject[]> {
  const db = getDb();
  const {
    search,
    orderBy = 'name',
    order = 'asc',
    limit = 50,
    offset = 0,
    includeDeleted = false,
  } = options;

  // Base Query
  let query = db.select().from(projects);

  // Filter: Nicht gelöscht
  const conditions = includeDeleted ? [] : [isNull(projects.deletedAt)];

  // Filter: Suche
  if (search) {
    conditions.push(ilike(projects.name, `%${search}%`));
  }

  // Conditions anwenden
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Sortierung bestimmen
  const orderColumn = {
    name: projects.name,
    created: projects.createdAt,
    updated: projects.updatedAt,
  }[orderBy];

  const orderFn = order === 'asc' ? asc : desc;

  // Query ausführen
  const result = await query.orderBy(orderFn(orderColumn)).limit(limit).offset(offset);

  return result;
}

/**
 * Findet alle Projekte eines Users
 */
export async function findProjectsByUser(userId: string): Promise<DbProject[]> {
  const db = getDb();

  const result = await db
    .select({
      project: projects,
    })
    .from(projects)
    .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projectMembers.userId, userId), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name));

  return result.map((r) => r.project);
}

/**
 * Findet ein Projekt mit allen Mitgliedern
 */
export async function findProjectWithMembers(
  projectId: string
): Promise<ProjectWithMembers | null> {
  const db = getDb();

  // Erst Projekt laden
  const project = await findProjectById(projectId);
  if (!project) return null;

  // Dann Mitglieder laden
  const members = await db
    .select({
      projectMember: projectMembers,
      user: users,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId));

  return {
    ...project,
    members: members.map((m) => ({
      ...m.projectMember,
      user: m.user,
    })),
  };
}

/**
 * Prüft ob ein Projekt existiert
 */
export async function projectExists(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(projects)
    .where(and(eq(projects.id, id), isNull(projects.deletedAt)));

  return result[0].count > 0;
}

/**
 * Prüft ob ein Slug verfügbar ist
 */
export async function isSlugAvailable(slug: string, excludeProjectId?: string): Promise<boolean> {
  const db = getDb();

  const conditions = [eq(projects.slug, slug.toLowerCase()), isNull(projects.deletedAt)];

  if (excludeProjectId) {
    // Bei Update: Eigenes Projekt ausschließen
    const result = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.slug, slug.toLowerCase()), isNull(projects.deletedAt)))
      .limit(1);

    if (result.length === 0) return true;
    return result[0].id === excludeProjectId;
  }

  const result = await db
    .select({ count: count() })
    .from(projects)
    .where(and(...conditions));

  return result[0].count === 0;
}

/**
 * Zählt alle Projekte (für Pagination)
 */
export async function countProjects(
  options: Pick<FindProjectsOptions, 'search' | 'includeDeleted'> = {}
): Promise<number> {
  const db = getDb();
  const { search, includeDeleted = false } = options;

  const conditions = includeDeleted ? [] : [isNull(projects.deletedAt)];

  if (search) {
    conditions.push(ilike(projects.name, `%${search}%`));
  }

  const result = await db
    .select({ count: count() })
    .from(projects)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return result[0].count;
}

// =============================================================================
// 🌐 PUBLIC PROJECT FINDERS (Phase 3.1 + 3.5)
// =============================================================================

/**
 * Public Board Settings für Kunden-Ansicht
 * @see phase-3.5-kunden-permissions.md
 */
export type PublicBoardSettingsData = PublicBoardSettings;

/**
 * Öffentlich sichtbare Projekt-Daten
 * (reduzierte Felder für Kunden-Ansicht)
 */
export interface PublicProjectData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  /** Ob Passwort-Schutz aktiv ist */
  hasPassword: boolean;
  /** Logo URL (falls vorhanden) */
  logoUrl?: string;
  /** Public Board Settings (Phase 3.5) */
  publicSettings: PublicBoardSettingsData;
}

/**
 * Findet ein öffentliches Projekt nach Slug
 *
 * Wichtig: Gibt NUR Projekte zurück, die:
 * - `customerAccessEnabled = true` haben
 * - Nicht gelöscht sind
 *
 * @returns Reduzierte Projekt-Daten für öffentliche Anzeige inkl. Settings
 */
export async function findPublicProjectBySlug(slug: string): Promise<PublicProjectData | null> {
  const db = getDb();

  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      customerPasswordHash: projects.customerPasswordHash,
      settings: projects.settings,
    })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug.toLowerCase()),
        eq(projects.customerAccessEnabled, true),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  const project = result[0];
  const settingsObj = project.settings as Record<string, unknown> | null;
  const publicSettingsRaw = settingsObj?.publicSettings as
    | Partial<PublicBoardSettingsData>
    | undefined;
  const defaults = getDefaultPublicBoardSettings();

  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    description: project.description,
    hasPassword: !!project.customerPasswordHash,
    logoUrl: settingsObj?.logoUrl as string | undefined,
    publicSettings: {
      allowTicketCreation: publicSettingsRaw?.allowTicketCreation ?? defaults.allowTicketCreation,
      showComments: publicSettingsRaw?.showComments ?? defaults.showComments,
      visibleStatuses: publicSettingsRaw?.visibleStatuses ?? defaults.visibleStatuses,
      introMessage: publicSettingsRaw?.introMessage,
      theme: (publicSettingsRaw?.theme as 'dark' | 'light') ?? defaults.theme,
    },
  };
}

/**
 * Findet alle öffentlich zugänglichen Projekte
 * (für Admin-Übersicht oder Showcase)
 */
export async function findAllPublicProjects(): Promise<PublicProjectData[]> {
  const db = getDb();
  const defaults = getDefaultPublicBoardSettings();

  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      slug: projects.slug,
      description: projects.description,
      customerPasswordHash: projects.customerPasswordHash,
      settings: projects.settings,
    })
    .from(projects)
    .where(and(eq(projects.customerAccessEnabled, true), isNull(projects.deletedAt)))
    .orderBy(asc(projects.name));

  return result.map((project) => {
    const settingsObj = project.settings as Record<string, unknown> | null;
    const publicSettingsRaw = settingsObj?.publicSettings as
      | Partial<PublicBoardSettingsData>
      | undefined;

    return {
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description,
      hasPassword: !!project.customerPasswordHash,
      logoUrl: settingsObj?.logoUrl as string | undefined,
      publicSettings: {
        allowTicketCreation: publicSettingsRaw?.allowTicketCreation ?? defaults.allowTicketCreation,
        showComments: publicSettingsRaw?.showComments ?? defaults.showComments,
        visibleStatuses: publicSettingsRaw?.visibleStatuses ?? defaults.visibleStatuses,
        introMessage: publicSettingsRaw?.introMessage,
        theme: (publicSettingsRaw?.theme as 'dark' | 'light') ?? defaults.theme,
      },
    };
  });
}

/**
 * Prüft ob ein Projekt-Slug existiert und öffentlich zugänglich ist
 */
export async function isPublicSlugAccessible(slug: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug.toLowerCase()),
        eq(projects.customerAccessEnabled, true),
        isNull(projects.deletedAt)
      )
    );

  return result[0].count > 0;
}

/**
 * Prüft ob ein Projekt Passwort-Schutz hat
 *
 * @returns
 * - `null` wenn Projekt nicht existiert oder nicht öffentlich
 * - `true` wenn Passwort-Schutz aktiv
 * - `false` wenn öffentlich ohne Passwort
 */
export async function hasProjectPassword(slug: string): Promise<boolean | null> {
  const db = getDb();

  const result = await db
    .select({
      customerPasswordHash: projects.customerPasswordHash,
    })
    .from(projects)
    .where(
      and(
        eq(projects.slug, slug.toLowerCase()),
        eq(projects.customerAccessEnabled, true),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  return !!result[0].customerPasswordHash;
}
