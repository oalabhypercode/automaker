# 🗃️ Phase 1.1: Datenmodell Design (Drizzle Schema)

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 0.1-0.4 (Architektur, Setup, Types)
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Vollständiges Drizzle ORM Schema für Postgres erstellen:

- Alle Entitäten aus Phase 0.4 als DB-Tabellen
- Relations und Constraints definieren
- Migrations vorbereiten
- Type-Inference für TypeScript

---

## ❓ Proaktive F&A

### Q1: Warum Drizzle statt Prisma?

✅ **Drizzle Vorteile:**

- Leichtgewichtiger (~30KB vs ~2MB)
- Bessere TypeScript-Inference
- SQL-nahe Syntax (kein Query-Builder Overhead)
- Edge-Runtime kompatibel (Supabase Edge Functions)
- Keine Code-Generation nötig

### Q2: Wie strukturieren wir die Schema-Dateien?

✅ **Empfehlung: Eine Datei pro Entity-Gruppe**

```
libs/pg-sync/src/db/schema/
├── index.ts           # Re-exports alles
├── projects.ts        # Project + ProjectSettings
├── users.ts           # User + ProjectMember
├── tickets.ts         # Ticket + TicketEvent
└── sync.ts            # SyncState + Outbox
```

### Q3: UUID vs Auto-Increment IDs?

✅ **Entscheidung: UUIDs**

- Offline-Generierung möglich (kein Server-Roundtrip)
- Merge-freundlich (keine ID-Kollisionen)
- Supabase Standard

### Q4: Wie handhaben wir soft-deletes?

✅ **Strategie: deletedAt Timestamp**

- Kein harter Delete
- Archivierung statt Löschung
- Wiederherstellung möglich
- Sync-freundlich

### Q5: Wie halten wir Schema und Types synchron?

✅ **Drizzle Inference:**

```
// Schema definiert DB-Struktur
const projects = pgTable('projects', { ... })

// Types automatisch inferiert
type Project = InferSelectModel<typeof projects>
type NewProject = InferInsertModel<typeof projects>
```

---

## 🏛️ Schema-Übersicht

### Tabellen-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                        POSTGRES SCHEMA                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐       ┌──────────────────┐       ┌─────────────┐  │
│  │  projects   │◄─────►│ project_members  │◄─────►│   users     │  │
│  └─────────────┘       └──────────────────┘       └─────────────┘  │
│         │                                                │          │
│         │ 1:N                                           │ 1:N      │
│         ▼                                               ▼          │
│  ┌─────────────┐                               ┌─────────────────┐ │
│  │   tickets   │──────────────────────────────►│  ticket_events  │ │
│  └─────────────┘                               └─────────────────┘ │
│                                                                      │
│  ┌─────────────┐       ┌──────────────────┐                        │
│  │ sync_states │       │   outbox_items   │                        │
│  └─────────────┘       └──────────────────┘                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Schema-Definitionen

### 1. Projects (`schema/projects.ts`)

**Tabelle: projects**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primärschlüssel |
| name | varchar(100) | NOT NULL | Projektname |
| slug | varchar(50) | NOT NULL, UNIQUE | URL-Slug |
| description | text | NULL | Beschreibung |
| customer_password_hash | varchar(255) | NULL | Kunden-Auth |
| customer_access_enabled | boolean | DEFAULT false | Kunden-Board aktiv |
| sync_enabled | boolean | DEFAULT true | Sync aktiv |
| settings | jsonb | DEFAULT '{}' | Erweiterte Settings |
| created_at | timestamptz | DEFAULT now() | Erstelldatum |
| updated_at | timestamptz | DEFAULT now() | Änderungsdatum |
| deleted_at | timestamptz | NULL | Soft-Delete |

**Indizes:**

- `idx_projects_slug` auf `slug` (häufige Lookups)
- `idx_projects_deleted` auf `deleted_at` (Filter)

---

### 2. Users (`schema/users.ts`)

**Tabelle: users**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primärschlüssel |
| email | varchar(255) | NOT NULL, UNIQUE | E-Mail |
| name | varchar(100) | NOT NULL | Anzeigename |
| role | user_role_enum | DEFAULT 'member' | Globale Rolle |
| avatar_url | varchar(500) | NULL | Profilbild |
| client_id | varchar(100) | NULL, UNIQUE | Offline-Client ID |
| last_seen_at | timestamptz | NULL | Letzte Aktivität |
| created_at | timestamptz | DEFAULT now() | Erstelldatum |
| deleted_at | timestamptz | NULL | Soft-Delete |

**Enum: user_role_enum**

- `admin`, `member`, `customer`

**Tabelle: project_members**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| project_id | uuid | FK → projects.id | Projekt |
| user_id | uuid | FK → users.id | User |
| role | project_role_enum | DEFAULT 'member' | Rolle im Projekt |
| joined_at | timestamptz | DEFAULT now() | Beitrittsdatum |
| PRIMARY KEY | (project_id, user_id) | | Composite PK |

**Enum: project_role_enum**

- `owner`, `admin`, `member`, `viewer`

---

### 3. Tickets (`schema/tickets.ts`)

**Tabelle: tickets**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primärschlüssel |
| project_id | uuid | FK → projects.id, NOT NULL | Projekt |
| local_id | varchar(100) | NULL | Lokale Feature-ID |
| title | varchar(200) | NOT NULL | Titel |
| description | text | NULL | Beschreibung (MD) |
| status | ticket_status_enum | DEFAULT 'backlog' | Status |
| priority | ticket_priority_enum | DEFAULT 'medium' | Priorität |
| labels | text[] | DEFAULT '{}' | Labels Array |
| created_by | uuid | FK → users.id | Ersteller |
| claimed_by | uuid | FK → users.id, NULL | Bearbeiter |
| claimed_at | timestamptz | NULL | Claim-Zeitpunkt |
| completed_at | timestamptz | NULL | Abschluss-Zeit |
| version | integer | DEFAULT 1 | Optimistic Locking |
| created_at | timestamptz | DEFAULT now() | Erstelldatum |
| updated_at | timestamptz | DEFAULT now() | Änderungsdatum |
| deleted_at | timestamptz | NULL | Soft-Delete |

**Enum: ticket_status_enum**

- `backlog`, `todo`, `in_progress`, `review`, `done`, `archived`

**Enum: ticket_priority_enum**

- `low`, `medium`, `high`, `urgent`

**Indizes:**

- `idx_tickets_project` auf `project_id`
- `idx_tickets_status` auf `status`
- `idx_tickets_claimed` auf `claimed_by`
- `idx_tickets_local_id` auf `(project_id, local_id)` UNIQUE

---

### 4. Ticket Events (`schema/tickets.ts` Fortsetzung)

**Tabelle: ticket_events**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primärschlüssel |
| ticket_id | uuid | FK → tickets.id, NOT NULL | Ticket |
| project_id | uuid | FK → projects.id, NOT NULL | Projekt (Denormalisiert) |
| type | event_type_enum | NOT NULL | Event-Typ |
| payload | jsonb | DEFAULT '{}' | Event-Daten |
| created_by | uuid | FK → users.id | Auslöser |
| created_at | timestamptz | DEFAULT now() | Timestamp |

**Enum: event_type_enum**

- `created`, `updated`, `status_changed`, `claimed`, `unclaimed`, `completed`, `comment_added`, `label_added`, `label_removed`

**Indizes:**

- `idx_events_ticket` auf `ticket_id`
- `idx_events_project_time` auf `(project_id, created_at DESC)` — Pull-Query
- `idx_events_created_at` auf `created_at`

---

### 5. Sync State (`schema/sync.ts`)

**Tabelle: sync_states**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| client_id | varchar(100) | PK | Client-Identifier |
| project_id | uuid | FK → projects.id, PK | Projekt |
| user_id | uuid | FK → users.id | Zugehöriger User |
| last_pulled_at | timestamptz | NULL | Letzter Pull |
| last_pushed_at | timestamptz | NULL | Letzter Push |
| last_event_id | uuid | NULL | Letztes Event |
| PRIMARY KEY | (client_id, project_id) | | Composite PK |

**Tabelle: outbox_items**
| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| id | uuid | PK, DEFAULT gen_random_uuid() | Primärschlüssel |
| client_id | varchar(100) | NOT NULL | Client |
| event_type | varchar(50) | NOT NULL | Event-Typ |
| entity_type | varchar(50) | NOT NULL | Entitäts-Typ |
| entity_id | uuid | NOT NULL | Entitäts-ID |
| payload | jsonb | NOT NULL | Event-Daten |
| status | outbox_status_enum | DEFAULT 'pending' | Status |
| retries | integer | DEFAULT 0 | Retry-Count |
| error_message | text | NULL | Letzter Fehler |
| created_at | timestamptz | DEFAULT now() | Erstelldatum |
| processed_at | timestamptz | NULL | Verarbeitet |

**Enum: outbox_status_enum**

- `pending`, `processing`, `completed`, `failed`

**Indizes:**

- `idx_outbox_pending` auf `(status, created_at)` WHERE status = 'pending'

---

## 🔄 Relations

### Drizzle Relations Definition

```
projects ←→ project_members ←→ users
  1:N                            N:1

projects ←→ tickets ←→ ticket_events
  1:N          1:N

tickets ←→ users (createdBy, claimedBy)
  N:1

sync_states ←→ projects ←→ users
  N:1                      N:1
```

### Cascading Rules

| Parent   | Child                | On Delete | On Update |
| -------- | -------------------- | --------- | --------- |
| projects | project_members      | CASCADE   | CASCADE   |
| projects | tickets              | RESTRICT  | CASCADE   |
| users    | project_members      | CASCADE   | CASCADE   |
| users    | tickets (created_by) | SET NULL  | CASCADE   |
| tickets  | ticket_events        | CASCADE   | CASCADE   |

---

## 📱 Konkrete Beispiele

### Beispiel: Neues Projekt anlegen

```
INSERT INTO projects (name, slug)
VALUES ('Finance Dashboard', 'finance-dashboard')
RETURNING *

→ id: "proj-123-abc"
→ slug: "finance-dashboard"
→ sync_enabled: true
```

### Beispiel: Ticket mit Claim

```
UPDATE tickets
SET
  status = 'in_progress',
  claimed_by = 'user-456',
  claimed_at = NOW(),
  version = version + 1
WHERE id = 'ticket-789'
  AND version = 3  -- Optimistic Lock

INSERT INTO ticket_events (ticket_id, project_id, type, payload, created_by)
VALUES (
  'ticket-789',
  'proj-123-abc',
  'claimed',
  '{"previousStatus": "todo"}',
  'user-456'
)
```

### Beispiel: Pull-Query (Events seit Timestamp)

```
SELECT * FROM ticket_events
WHERE project_id = 'proj-123-abc'
  AND created_at > '2026-01-05T10:00:00Z'
ORDER BY created_at ASC
```

---

## ⚡ Performance-Überlegungen

### Partitioning (optional für große Daten)

- `ticket_events` nach `created_at` (monthly)
- Ältere Events archivieren

### Materialized Views (optional)

- `project_stats`: Ticket-Counts pro Status
- Refresh bei Sync

### Connection Pooling

- Supabase: Built-in
- Coolify: PgBouncer empfohlen

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                          | Zweck             | ~Zeilen |
| ---------------------------------------------- | ----------------- | ------- |
| `libs/pg-sync/src/db/schema/index.ts`          | Schema-Export     | ~20     |
| `libs/pg-sync/src/db/schema/projects.ts`       | Project-Schema    | ~80     |
| `libs/pg-sync/src/db/schema/users.ts`          | User-Schema       | ~100    |
| `libs/pg-sync/src/db/schema/tickets.ts`        | Ticket-Schema     | ~150    |
| `libs/pg-sync/src/db/schema/sync.ts`           | Sync-Schema       | ~80     |
| `libs/pg-sync/src/db/client.ts`                | Drizzle Client    | ~40     |
| `libs/pg-sync/src/db/migrations/0000_init.sql` | Initial Migration | ~150    |

**Gesamt: ~620 Zeilen Schema-Definition**

---

## ✅ Abschlusskriterien

- [ ] Alle Tabellen definiert in Drizzle
- [ ] Enums erstellt
- [ ] Relations konfiguriert
- [ ] Initial Migration generiert
- [ ] Migration auf Dev-DB ausgeführt
- [ ] Type-Inference funktioniert
- [ ] Keine Konflikte mit bestehenden Types

---

## 🔗 Referenzen

- `temp-pg-online-supabase.md` - Original-Datenmodell
- `phase-0.4-shared-types.md` - Type-Definitionen
- `phase-0.2-postgres-setup.md` - Supabase Config
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview)

---

**📌 Nächste Phase:** 1.2 - Finder & Actions für Postgres
