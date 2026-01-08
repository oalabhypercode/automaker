/**
 * 🔍 User Finder
 *
 * Read-Only Queries für Benutzer.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq, and, isNull, count } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users, projectMembers } from '../db/schema/index.js';
import type { DbUser, DbProjectMember } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Projekt-Mitglied mit erweiterter Rolle
 */
export interface ProjectMemberWithUser extends DbProjectMember {
  user: DbUser;
}

/**
 * Projekt-Rolle (aus DB-Enum)
 */
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer';

// =============================================================================
// 🔍 FINDER FUNCTIONS
// =============================================================================

/**
 * Findet einen User nach ID
 */
export async function findUserById(id: string): Promise<DbUser | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet einen User nach E-Mail
 */
export async function findUserByEmail(email: string): Promise<DbUser | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet einen User nach Client-ID (Offline-Client Verknüpfung)
 */
export async function findUserByClientId(clientId: string): Promise<DbUser | null> {
  const db = getDb();

  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.clientId, clientId), isNull(users.deletedAt)))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Findet alle Mitglieder eines Projekts
 */
export async function findUsersByProject(projectId: string): Promise<ProjectMemberWithUser[]> {
  const db = getDb();

  const result = await db
    .select({
      projectMember: projectMembers,
      user: users,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(and(eq(projectMembers.projectId, projectId), isNull(users.deletedAt)));

  return result.map((r) => ({
    ...r.projectMember,
    user: r.user,
  }));
}

/**
 * Findet die Rolle eines Users in einem Projekt
 */
export async function findUserRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  const db = getDb();

  const result = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)))
    .limit(1);

  return (result[0]?.role as ProjectRole) ?? null;
}

/**
 * Prüft ob ein User Mitglied eines Projekts ist
 */
export async function isProjectMember(userId: string, projectId: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, userId), eq(projectMembers.projectId, projectId)));

  return result[0].count > 0;
}

/**
 * Prüft ob ein User existiert
 */
export async function userExists(id: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)));

  return result[0].count > 0;
}

/**
 * Prüft ob eine E-Mail verfügbar ist
 */
export async function isEmailAvailable(email: string, excludeUserId?: string): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, email.toLowerCase()), isNull(users.deletedAt)))
    .limit(1);

  if (result.length === 0) return true;
  if (excludeUserId) return result[0].id === excludeUserId;
  return false;
}

/**
 * Zählt alle Mitglieder eines Projekts
 */
export async function countProjectMembers(projectId: string): Promise<number> {
  const db = getDb();

  const result = await db
    .select({ count: count() })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(and(eq(projectMembers.projectId, projectId), isNull(users.deletedAt)));

  return result[0].count;
}
