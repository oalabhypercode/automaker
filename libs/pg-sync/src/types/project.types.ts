/**
 * 🏢 Project Types
 *
 * Typdefinitionen für Projekte und deren Einstellungen.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 🏢 PROJECT ENTITY
// =============================================================================

/**
 * Ein Projekt im Sync-System
 *
 * Projekte sind die oberste Organisationsebene und enthalten Tickets.
 */
export interface Project {
  /** Eindeutige ID (UUID) */
  id: string;
  /** Projektname */
  name: string;
  /** URL-freundlicher Identifier (für Kunden-URLs) */
  slug: string;
  /** Optionale Beschreibung */
  description?: string;
  /** Projekt-Einstellungen */
  settings: ProjectSettings;
  /** Erstellungsdatum (ISO String) */
  createdAt: string;
  /** Letztes Update (ISO String) */
  updatedAt: string;
}

/**
 * Projekt-Einstellungen
 */
export interface ProjectSettings {
  /** Kunden-Board aktiviert? */
  customerAccessEnabled: boolean;
  /** Passwort für Kunden-Zugang (gehasht) */
  customerPassword?: string;
  /** Standard-Status für neue Tickets */
  defaultTicketStatus: TicketStatus;
  /** Sync für dieses Projekt aktiviert? */
  syncEnabled: boolean;
  /** Automatischer Sync aktiviert? */
  autoSyncEnabled: boolean;
  /** Sync-Intervall in Millisekunden */
  syncIntervalMs: number;
}

// =============================================================================
// 📋 TICKET STATUS ENUM
// =============================================================================

/**
 * Mögliche Status eines Tickets
 */
export type TicketStatus =
  | 'backlog' // Im Backlog
  | 'todo' // Zu erledigen
  | 'in_progress' // In Bearbeitung (geclaimed)
  | 'review' // Im Review
  | 'done' // Abgeschlossen
  | 'archived'; // Archiviert

/**
 * Array aller möglichen Ticket-Status (für Validierung)
 */
export const TICKET_STATUSES: readonly TicketStatus[] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'archived',
] as const;

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Standard-Werte für Projekt-Einstellungen
 */
export function getDefaultProjectSettings(): ProjectSettings {
  return {
    customerAccessEnabled: false,
    defaultTicketStatus: 'backlog',
    syncEnabled: true,
    autoSyncEnabled: true,
    syncIntervalMs: 60_000, // 1 Minute
  };
}

/**
 * Erstellt ein neues Projekt-Objekt mit Standard-Werten
 *
 * @param partial - Teilweise ausgefüllte Projekt-Daten
 * @returns Vollständiges Projekt-Objekt
 */
export function createProject(partial: Partial<Project> & Pick<Project, 'name' | 'slug'>): Project {
  const now = new Date().toISOString();
  return {
    id: partial.id ?? crypto.randomUUID(),
    name: partial.name,
    slug: partial.slug,
    description: partial.description,
    settings: partial.settings ?? getDefaultProjectSettings(),
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
  };
}

// =============================================================================
// 📦 INSERT/UPDATE TYPES
// =============================================================================

/**
 * Daten für neues Projekt (ohne ID und Timestamps)
 */
export type NewProject = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Daten für Projekt-Update (alles optional außer ID)
 */
export type UpdateProject = Partial<Omit<Project, 'id' | 'createdAt'>> & { id: string };
