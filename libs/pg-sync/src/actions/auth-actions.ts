import { getDb } from '../db/client.js';
import { projects } from '../db/schema/index.js';
import { eq } from 'drizzle-orm';
import { compare, hash } from 'bcryptjs';

/**
 * Validates a project password for customer access.
 *
 * @param projectId - The internal ID of the project
 * @param plainPassword - The plain text password entered by the user
 * @returns boolean indicating validity
 */
export async function validateProjectPassword(
  projectId: string,
  plainPassword: string
): Promise<boolean> {
  const db = getDb();

  const result = await db
    .select({
      customerPasswordHash: projects.customerPasswordHash,
      customerAccessEnabled: projects.customerAccessEnabled,
    })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);

  const project = result[0];

  // If project doesn't exist or customer access is disabled, deny
  if (!project || !project.customerAccessEnabled) {
    return false;
  }

  // If no password is set, deny (security by default)
  if (!project.customerPasswordHash) {
    return false;
  }

  return await compare(plainPassword, project.customerPasswordHash);
}

/**
 * Sets a new password for customer access and enables it.
 *
 * @param projectId - The project ID
 * @param plainPassword - The new password
 */
export async function setProjectCustomerPassword(
  projectId: string,
  plainPassword: string
): Promise<void> {
  const db = getDb();
  const hashedPassword = await hash(plainPassword, 10);

  await db
    .update(projects)
    .set({
      customerPasswordHash: hashedPassword,
      customerAccessEnabled: true,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}

/**
 * Disables customer password protection.
 * This specific function removes the password requirement.
 */
export async function removeProjectCustomerPassword(projectId: string): Promise<void> {
  const db = getDb();

  await db
    .update(projects)
    .set({
      customerPasswordHash: null,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));
}
