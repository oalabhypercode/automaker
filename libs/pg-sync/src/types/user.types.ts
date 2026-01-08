/**
 * 👤 User Types
 *
 * Typdefinitionen für Benutzer und Projekt-Mitglieder.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 👤 USER ENTITY
// =============================================================================

/**
 * Ein Benutzer im Sync-System
 */
export interface User {
  /** Eindeutige ID (UUID) */
  id: string;
  /** E-Mail Adresse (unique) */
  email: string;
  /** Anzeigename */
  name: string;
  /** Globale Rolle */
  role: GlobalRole;
  /** Profilbild URL (optional) */
  avatarUrl?: string;
  /** Erstellungsdatum (ISO String) */
  createdAt: string;
  /** Letztes Update (ISO String) */
  updatedAt: string;
}

// =============================================================================
// 🎭 ROLE ENUMS
// =============================================================================

/**
 * Globale Rollen im System
 */
export type GlobalRole =
  | 'admin' // System-Administrator
  | 'member' // Team-Mitglied
  | 'customer'; // Kunde (nur Kunden-Board Zugang)

/**
 * Array aller globalen Rollen (für Validierung)
 */
export const GLOBAL_ROLES: readonly GlobalRole[] = ['admin', 'member', 'customer'] as const;

/**
 * Projekt-spezifische Rollen
 */
export type ProjectRole =
  | 'owner' // Projekt-Besitzer (volle Rechte)
  | 'admin' // Projekt-Admin
  | 'member' // Team-Mitglied
  | 'viewer'; // Nur Lesen

/**
 * Array aller Projekt-Rollen (für Validierung)
 */
export const PROJECT_ROLES: readonly ProjectRole[] = [
  'owner',
  'admin',
  'member',
  'viewer',
] as const;

// =============================================================================
// 👥 PROJECT MEMBER
// =============================================================================

/**
 * Verknüpfung zwischen User und Project
 */
export interface ProjectMember {
  /** Projekt-ID (Fremdschlüssel) */
  projectId: string;
  /** User-ID (Fremdschlüssel) */
  userId: string;
  /** Rolle im Projekt */
  role: ProjectRole;
  /** Beitrittsdatum (ISO String) */
  joinedAt: string;
}

// =============================================================================
// 🔐 PERMISSIONS
// =============================================================================

/**
 * Berechtigungen nach Rolle
 */
export interface RolePermissions {
  /** Kann Tickets erstellen */
  canCreateTickets: boolean;
  /** Kann Tickets bearbeiten */
  canEditTickets: boolean;
  /** Kann Tickets löschen */
  canDeleteTickets: boolean;
  /** Kann Tickets claimen */
  canClaimTickets: boolean;
  /** Kann Projekt-Einstellungen ändern */
  canEditProject: boolean;
  /** Kann Mitglieder verwalten */
  canManageMembers: boolean;
}

/**
 * Standard-Berechtigungen pro Projekt-Rolle
 */
export const ROLE_PERMISSIONS: Record<ProjectRole, RolePermissions> = {
  owner: {
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: true,
    canClaimTickets: true,
    canEditProject: true,
    canManageMembers: true,
  },
  admin: {
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: true,
    canClaimTickets: true,
    canEditProject: true,
    canManageMembers: false,
  },
  member: {
    canCreateTickets: true,
    canEditTickets: true,
    canDeleteTickets: false,
    canClaimTickets: true,
    canEditProject: false,
    canManageMembers: false,
  },
  viewer: {
    canCreateTickets: false,
    canEditTickets: false,
    canDeleteTickets: false,
    canClaimTickets: false,
    canEditProject: false,
    canManageMembers: false,
  },
} as const;

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen User mit Standard-Werten
 */
export function createUser(partial: Partial<User> & Pick<User, 'email' | 'name'>): User {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? crypto.randomUUID(),
    email: partial.email,
    name: partial.name,
    role: partial.role ?? 'member',
    avatarUrl: partial.avatarUrl,
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

/**
 * Prüft, ob ein User eine bestimmte Berechtigung hat
 */
export function hasPermission(role: ProjectRole, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

// =============================================================================
// 📦 INSERT/UPDATE TYPES
// =============================================================================

/**
 * Daten für neuen User
 */
export type NewUser = Omit<User, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Daten für User-Update
 */
export type UpdateUser = Partial<Omit<User, 'id' | 'email' | 'createdAt'>> & { id: string };

/**
 * Daten für neues ProjectMember
 */
export type NewProjectMember = Omit<ProjectMember, 'joinedAt'>;
