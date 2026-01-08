-- =============================================================================
-- 🗃️ Initial Migration: Postgres Online-Sync Schema
-- 
-- Erstellt alle Tabellen für das Sync-System.
-- 
-- @see docs/pg-online-sync/tasks/phase-1.1-datenmodell.md
-- =============================================================================

-- =============================================================================
-- 🎭 ENUMS
-- =============================================================================

-- Globale Benutzer-Rollen
CREATE TYPE user_role_enum AS ENUM (
  'admin',    -- System-Administrator
  'member',   -- Team-Mitglied
  'customer'  -- Kunde
);

-- Projekt-spezifische Rollen
CREATE TYPE project_role_enum AS ENUM (
  'owner',  -- Projekt-Besitzer
  'admin',  -- Projekt-Admin
  'member', -- Team-Mitglied
  'viewer'  -- Nur Lesen
);

-- Ticket-Status
CREATE TYPE ticket_status_enum AS ENUM (
  'backlog',     -- Backlog
  'todo',        -- Zu erledigen
  'in_progress', -- In Bearbeitung
  'review',      -- Review
  'done',        -- Erledigt
  'archived'     -- Archiviert
);

-- Ticket-Priorität
CREATE TYPE ticket_priority_enum AS ENUM (
  'low',    -- Niedrig
  'medium', -- Mittel
  'high',   -- Hoch
  'urgent'  -- Dringend
);

-- Event-Typen
CREATE TYPE event_type_enum AS ENUM (
  'created',        -- Ticket erstellt
  'updated',        -- Ticket aktualisiert
  'status_changed', -- Status geändert
  'claimed',        -- Ticket übernommen
  'unclaimed',      -- Claim aufgehoben
  'completed',      -- Ticket abgeschlossen
  'comment_added',  -- Kommentar hinzugefügt
  'label_added',    -- Label hinzugefügt
  'label_removed'   -- Label entfernt
);

-- Outbox-Status
CREATE TYPE outbox_status_enum AS ENUM (
  'pending',    -- Wartet auf Verarbeitung
  'processing', -- Wird gerade verarbeitet
  'completed',  -- Erfolgreich verarbeitet
  'failed'      -- Fehlgeschlagen
);

-- =============================================================================
-- 🏢 PROJECTS TABLE
-- =============================================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  customer_password_hash VARCHAR(255),
  customer_access_enabled BOOLEAN NOT NULL DEFAULT false,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX idx_projects_slug ON projects(slug);
CREATE INDEX idx_projects_deleted ON projects(deleted_at);

-- =============================================================================
-- 👤 USERS TABLE
-- =============================================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  role user_role_enum NOT NULL DEFAULT 'member',
  avatar_url VARCHAR(500),
  client_id VARCHAR(100) UNIQUE,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_client_id ON users(client_id);

-- =============================================================================
-- 👥 PROJECT MEMBERS TABLE
-- =============================================================================

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  role project_role_enum NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- =============================================================================
-- 🎫 TICKETS TABLE
-- =============================================================================

CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  local_id VARCHAR(100),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ticket_status_enum NOT NULL DEFAULT 'backlog',
  priority ticket_priority_enum NOT NULL DEFAULT 'medium',
  labels TEXT[] NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  claimed_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_claimed_by ON tickets(claimed_by);
CREATE UNIQUE INDEX idx_tickets_local_id ON tickets(project_id, local_id);

-- =============================================================================
-- 📡 TICKET EVENTS TABLE
-- =============================================================================

CREATE TABLE ticket_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE ON UPDATE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  type event_type_enum NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indizes
CREATE INDEX idx_events_ticket ON ticket_events(ticket_id);
CREATE INDEX idx_events_project_time ON ticket_events(project_id, created_at DESC);
CREATE INDEX idx_events_created_at ON ticket_events(created_at);

-- =============================================================================
-- 🔄 SYNC STATES TABLE
-- =============================================================================

CREATE TABLE sync_states (
  client_id VARCHAR(100) NOT NULL,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE ON UPDATE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  last_pulled_at TIMESTAMPTZ,
  last_pushed_at TIMESTAMPTZ,
  last_event_id UUID,
  PRIMARY KEY (client_id, project_id)
);

-- =============================================================================
-- 📤 OUTBOX ITEMS TABLE
-- =============================================================================

CREATE TABLE outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id VARCHAR(100) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status outbox_status_enum NOT NULL DEFAULT 'pending',
  retries INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

-- Indizes
CREATE INDEX idx_outbox_pending ON outbox_items(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_outbox_client ON outbox_items(client_id);

-- =============================================================================
-- 🔧 HELPER FUNCTIONS
-- =============================================================================

-- Auto-Update updated_at bei Änderungen
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger für projects
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger für tickets
CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ✅ MIGRATION COMPLETE
-- =============================================================================

COMMENT ON TABLE projects IS 'Projekte mit Kunden-Zugang und Sync-Konfiguration';
COMMENT ON TABLE users IS 'Benutzer des Systems (Mitarbeiter und Kunden)';
COMMENT ON TABLE project_members IS 'Verknüpfung zwischen Benutzern und Projekten';
COMMENT ON TABLE tickets IS 'Tickets/Tasks mit Optimistic Locking';
COMMENT ON TABLE ticket_events IS 'Event-Log für Sync und Audit-Trail';
COMMENT ON TABLE sync_states IS 'Sync-Status pro Client und Projekt';
COMMENT ON TABLE outbox_items IS 'Transactional Outbox für zuverlässigen Event-Transport';
