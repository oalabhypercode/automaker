/**
 * ⚡ User Actions
 *
 * Mutations für Benutzer (INSERT, UPDATE, DELETE).
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

import { eq } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { users } from '../db/schema/index.js';
import type { DbUser, DbNewUser } from '../db/schema/index.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { findUserById, isEmailAvailable } from '../finders/user-finder.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Globale Benutzer-Rolle
 */
export type UserRoleType = 'admin' | 'member' | 'customer';

/**
 * Daten für User-Erstellung
 */
export interface CreateUserData {
  email: string;
  name: string;
  role?: UserRoleType;
  avatarUrl?: string;
  clientId?: string;
}

/**
 * Daten für User-Update
 */
export interface UpdateUserData {
  name?: string;
  role?: UserRoleType;
  avatarUrl?: string;
}

// =============================================================================
// ⚡ ACTION FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen User
 *
 * @throws ValidationError - Wenn E-Mail bereits vergeben
 */
export async function createUser(data: CreateUserData): Promise<DbUser> {
  const db = getDb();

  // E-Mail normalisieren und validieren
  const normalizedEmail = data.email.toLowerCase().trim();

  if (!(await isEmailAvailable(normalizedEmail))) {
    throw ValidationError.emailTaken(normalizedEmail);
  }

  const insertData: DbNewUser = {
    email: normalizedEmail,
    name: data.name.trim(),
    role: data.role ?? 'member',
    avatarUrl: data.avatarUrl,
    clientId: data.clientId,
  };

  const [user] = await db.insert(users).values(insertData).returning();

  return user;
}

/**
 * Aktualisiert einen User
 *
 * @throws NotFoundError - Wenn User nicht gefunden
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<DbUser> {
  const db = getDb();

  const existing = await findUserById(id);
  if (!existing) {
    throw new NotFoundError('user', id);
  }

  const updateData = {
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.role !== undefined && { role: data.role }),
    ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
  };

  const [user] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();

  return user;
}

/**
 * Soft-Delete eines Users
 *
 * @throws NotFoundError - Wenn User nicht gefunden
 */
export async function deleteUser(id: string): Promise<void> {
  const db = getDb();

  const existing = await findUserById(id);
  if (!existing) {
    throw new NotFoundError('user', id);
  }

  await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
}

/**
 * Aktualisiert den lastSeenAt Timestamp (Activity-Tracking)
 */
export async function updateLastSeen(id: string): Promise<void> {
  const db = getDb();

  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, id));
}

/**
 * Verknüpft einen Offline-Client mit einem User
 *
 * @throws NotFoundError - Wenn User nicht gefunden
 */
export async function linkClientId(userId: string, clientId: string): Promise<DbUser> {
  const db = getDb();

  const existing = await findUserById(userId);
  if (!existing) {
    throw new NotFoundError('user', userId);
  }

  const [user] = await db.update(users).set({ clientId }).where(eq(users.id, userId)).returning();

  return user;
}

/**
 * Entfernt die Client-Verknüpfung eines Users
 */
export async function unlinkClientId(userId: string): Promise<DbUser> {
  const db = getDb();

  const [user] = await db
    .update(users)
    .set({ clientId: null })
    .where(eq(users.id, userId))
    .returning();

  if (!user) {
    throw new NotFoundError('user', userId);
  }

  return user;
}

/**
 * Restauriert einen gelöschten User
 */
export async function restoreUser(id: string): Promise<DbUser> {
  const db = getDb();

  const [user] = await db
    .update(users)
    .set({ deletedAt: null })
    .where(eq(users.id, id))
    .returning();

  if (!user) {
    throw new NotFoundError('user', id);
  }

  return user;
}

/**
 * Aktualisiert die E-Mail eines Users
 *
 * @throws NotFoundError - Wenn User nicht gefunden
 * @throws ValidationError - Wenn E-Mail bereits vergeben
 */
export async function updateUserEmail(id: string, email: string): Promise<DbUser> {
  const db = getDb();

  const existing = await findUserById(id);
  if (!existing) {
    throw new NotFoundError('user', id);
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (normalizedEmail !== existing.email && !(await isEmailAvailable(normalizedEmail, id))) {
    throw ValidationError.emailTaken(normalizedEmail);
  }

  const [user] = await db
    .update(users)
    .set({ email: normalizedEmail })
    .where(eq(users.id, id))
    .returning();

  return user;
}
