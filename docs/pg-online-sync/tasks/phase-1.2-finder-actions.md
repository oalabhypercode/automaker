# 🔍 Phase 1.2: Finder & Actions für Postgres

ULTRATHINK

> **Status:** ✅ IMPLEMENTIERT (2026-01-07)
> **Abhängigkeiten:** Phase 1.1 (Drizzle Schema)
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Clean Code Datenzugriffs-Layer erstellen:

- **Finder:** Read-Only Queries (SELECT)
- **Actions:** Mutationen (INSERT, UPDATE, DELETE)
- Klare Trennung, testbar, wiederverwendbar
- Typsichere Drizzle-Queries

---

## ❓ Proaktive F&A

### Q1: Warum Finder/Actions statt Repository-Pattern?

✅ **Vorteile Finder/Actions:**

- Expliziter: Read vs Write klar getrennt
- Granularer: Jede Operation einzeln testbar
- Funktional: Keine Klassen-Instanzen nötig
- Clean Code: Einzelne Verantwortlichkeit pro Funktion

### Q2: Wie strukturieren wir die Dateien?

✅ **Empfehlung: Nach Entity + Operation**

```
finders/
├── project-finder.ts    # findProjectById, findProjectBySlug, ...
├── ticket-finder.ts     # findTicketById, findTicketsByProject, ...
├── user-finder.ts       # findUserById, findUserByEmail, ...
└── sync-finder.ts       # findSyncState, findPendingOutbox, ...

actions/
├── project-actions.ts   # createProject, updateProject, ...
├── ticket-actions.ts    # createTicket, updateTicket, claimTicket, ...
├── user-actions.ts      # createUser, updateUser, ...
└── sync-actions.ts      # updateSyncState, addToOutbox, ...
```

### Q3: Wie handhaben wir Transactions?

✅ **Drizzle Transaction API:**

- Finder: Keine Transactions nötig (read-only)
- Actions: Transaction wrapper für multi-step operations
- Dependency Injection des `db` Objekts

### Q4: Wie sieht Error-Handling aus?

✅ **Custom Errors:**

- `NotFoundError` - Entity nicht gefunden
- `ConflictError` - Optimistic Lock fehlgeschlagen
- `ValidationError` - Ungültige Daten
- Alle Errors mit `code` für Frontend-Handling

### Q5: Wie testen wir?

✅ **Test-Strategie:**

- Unit-Tests mit in-memory SQLite (Drizzle kompatibel)
- Integration-Tests mit echtem Postgres (Testcontainers)
- Fixtures für Test-Daten

---

## 🏛️ Architektur-Übersicht

### Schichten-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                           API ROUTES                                 │
│              (apps/server/src/routes/pg-sync/*)                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────┐  ┌──────────────────────────┐        │
│  │        FINDERS           │  │         ACTIONS          │        │
│  │    (Read Operations)     │  │    (Write Operations)    │        │
│  │                          │  │                          │        │
│  │  • findProjectById       │  │  • createProject         │        │
│  │  • findTicketsByProject  │  │  • updateTicket          │        │
│  │  • findEventsSince       │  │  • claimTicket           │        │
│  │  • ...                   │  │  • ...                   │        │
│  └──────────────────────────┘  └──────────────────────────┘        │
│                    │                      │                         │
│                    └──────────┬───────────┘                         │
│                               │                                     │
│                    ┌──────────▼──────────┐                         │
│                    │    DRIZZLE ORM      │                         │
│                    │   (libs/pg-sync)    │                         │
│                    └──────────┬──────────┘                         │
│                               │                                     │
│                    ┌──────────▼──────────┐                         │
│                    │     POSTGRES        │                         │
│                    │    (Supabase)       │                         │
│                    └─────────────────────┘                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Finder-Definitionen

### 1. Project Finder (`finders/project-finder.ts`)

| Funktion                 | Parameter          | Return                     | Beschreibung              |
| ------------------------ | ------------------ | -------------------------- | ------------------------- |
| `findProjectById`        | id: string         | Project \| null            | Nach ID suchen            |
| `findProjectBySlug`      | slug: string       | Project \| null            | Nach Slug (URL)           |
| `findAllProjects`        | opts?: FindOptions | Project[]                  | Alle Projekte (paginated) |
| `findProjectsByUser`     | userId: string     | Project[]                  | Projekte eines Users      |
| `findProjectWithMembers` | id: string         | ProjectWithMembers \| null | Mit Member-Liste          |
| `projectExists`          | id: string         | boolean                    | Existenz prüfen           |

**Beispiel Implementierung:**

```
findProjectBySlug(slug):
  1. SELECT * FROM projects WHERE slug = ? AND deleted_at IS NULL
  2. Return Project oder null
```

---

### 2. User Finder (`finders/user-finder.ts`)

| Funktion             | Parameter         | Return              | Beschreibung             |
| -------------------- | ----------------- | ------------------- | ------------------------ |
| `findUserById`       | id: string        | User \| null        | Nach ID                  |
| `findUserByEmail`    | email: string     | User \| null        | Nach E-Mail              |
| `findUserByClientId` | clientId: string  | User \| null        | Nach Client-ID (Offline) |
| `findUsersByProject` | projectId: string | ProjectMember[]     | Projekt-Mitglieder       |
| `findUserRole`       | userId, projectId | ProjectRole \| null | Rolle im Projekt         |

---

### 3. Ticket Finder (`finders/ticket-finder.ts`)

| Funktion               | Parameter          | Return         | Beschreibung       |
| ---------------------- | ------------------ | -------------- | ------------------ |
| `findTicketById`       | id: string         | Ticket \| null | Nach ID            |
| `findTicketByLocalId`  | projectId, localId | Ticket \| null | Nach lokaler ID    |
| `findTicketsByProject` | projectId, opts?   | Ticket[]       | Projekt-Tickets    |
| `findTicketsByStatus`  | projectId, status  | Ticket[]       | Nach Status        |
| `findTicketsClaimedBy` | userId             | Ticket[]       | Geclaimed von User |
| `findOpenTickets`      | projectId          | Ticket[]       | Nicht-done Tickets |
| `countTicketsByStatus` | projectId          | StatusCounts   | Aggregiert         |

**FindOptions für Tickets:**

```
{
  status?: TicketStatus | TicketStatus[]
  priority?: TicketPriority
  claimedBy?: string
  labels?: string[]
  search?: string          // Titel/Description Suche
  orderBy?: 'created' | 'updated' | 'priority'
  order?: 'asc' | 'desc'
  limit?: number
  offset?: number
}
```

---

### 4. Event Finder (`finders/event-finder.ts`)

| Funktion             | Parameter              | Return              | Beschreibung          |
| -------------------- | ---------------------- | ------------------- | --------------------- |
| `findEventById`      | id: string             | TicketEvent \| null | Nach ID               |
| `findEventsByTicket` | ticketId               | TicketEvent[]       | Ticket-History        |
| `findEventsSince`    | projectId, since: Date | TicketEvent[]       | Seit Timestamp (Pull) |
| `findEventsSinceId`  | projectId, eventId     | TicketEvent[]       | Nach Event-ID (Pull)  |
| `findLatestEvent`    | projectId              | TicketEvent \| null | Letztes Event         |
| `countEventsSince`   | projectId, since       | number              | Count für UI          |

**Wichtig für Pull:**

```
findEventsSince(projectId, since):
  SELECT * FROM ticket_events
  WHERE project_id = ?
    AND created_at > ?
  ORDER BY created_at ASC
  LIMIT 1000  -- Batched für große Datenmengen
```

---

### 5. Sync Finder (`finders/sync-finder.ts`)

| Funktion             | Parameter           | Return            | Beschreibung       |
| -------------------- | ------------------- | ----------------- | ------------------ |
| `findSyncState`      | clientId, projectId | SyncState \| null | Client-Sync-Status |
| `findPendingOutbox`  | clientId, limit?    | OutboxItem[]      | Pending Events     |
| `countPendingOutbox` | clientId            | number            | Anzahl pending     |
| `findFailedOutbox`   | clientId            | OutboxItem[]      | Fehlgeschlagene    |

---

## 📝 Actions-Definitionen

### 1. Project Actions (`actions/project-actions.ts`)

| Funktion                  | Parameter               | Return        | Beschreibung          |
| ------------------------- | ----------------------- | ------------- | --------------------- |
| `createProject`           | data: NewProject        | Project       | Projekt erstellen     |
| `updateProject`           | id, data: Partial       | Project       | Projekt aktualisieren |
| `deleteProject`           | id                      | void          | Soft-Delete           |
| `updateProjectSettings`   | id, settings            | Project       | Settings ändern       |
| `addProjectMember`        | projectId, userId, role | ProjectMember | Mitglied hinzufügen   |
| `removeProjectMember`     | projectId, userId       | void          | Mitglied entfernen    |
| `changeProjectMemberRole` | projectId, userId, role | ProjectMember | Rolle ändern          |

---

### 2. User Actions (`actions/user-actions.ts`)

| Funktion         | Parameter         | Return | Beschreibung              |
| ---------------- | ----------------- | ------ | ------------------------- |
| `createUser`     | data: NewUser     | User   | User erstellen            |
| `updateUser`     | id, data: Partial | User   | User aktualisieren        |
| `deleteUser`     | id                | void   | Soft-Delete               |
| `updateLastSeen` | id                | void   | Activity-Tracking         |
| `linkClientId`   | userId, clientId  | User   | Offline-Client verknüpfen |

---

### 3. Ticket Actions (`actions/ticket-actions.ts`)

| Funktion             | Parameter                | Return | Beschreibung       |
| -------------------- | ------------------------ | ------ | ------------------ |
| `createTicket`       | data: NewTicket          | Ticket | Ticket erstellen   |
| `updateTicket`       | id, data, version        | Ticket | Update mit Lock    |
| `deleteTicket`       | id                       | void   | Soft-Delete        |
| `claimTicket`        | ticketId, userId         | Ticket | Ticket übernehmen  |
| `unclaimTicket`      | ticketId                 | Ticket | Claim aufheben     |
| `changeTicketStatus` | ticketId, status, userId | Ticket | Status ändern      |
| `completeTicket`     | ticketId, userId         | Ticket | Als done markieren |
| `addTicketLabel`     | ticketId, label          | Ticket | Label hinzufügen   |
| `removeTicketLabel`  | ticketId, label          | Ticket | Label entfernen    |

**Wichtig: Optimistic Locking**

```
updateTicket(id, data, expectedVersion):
  1. UPDATE tickets SET ... WHERE id = ? AND version = ?
  2. Wenn affectedRows = 0 → ConflictError werfen
  3. Sonst: Return updated ticket
```

**Wichtig: Event-Generierung**

```
claimTicket(ticketId, userId):
  1. BEGIN TRANSACTION
  2. UPDATE tickets SET claimed_by = ?, claimed_at = NOW(), status = 'in_progress'
  3. INSERT INTO ticket_events (type = 'claimed', ...)
  4. COMMIT
  5. Return updated ticket
```

---

### 4. Event Actions (`actions/event-actions.ts`)

| Funktion           | Parameter          | Return        | Beschreibung    |
| ------------------ | ------------------ | ------------- | --------------- |
| `createEvent`      | data: NewEvent     | TicketEvent   | Event erstellen |
| `createBulkEvents` | events: NewEvent[] | TicketEvent[] | Batch-Insert    |

---

### 5. Sync Actions (`actions/sync-actions.ts`)

| Funktion               | Parameter                      | Return     | Beschreibung       |
| ---------------------- | ------------------------------ | ---------- | ------------------ |
| `upsertSyncState`      | data: SyncState                | SyncState  | Create/Update      |
| `updateLastPulled`     | clientId, projectId, timestamp | void       | Pull-Marker        |
| `updateLastPushed`     | clientId, projectId, timestamp | void       | Push-Marker        |
| `addToOutbox`          | item: NewOutboxItem            | OutboxItem | Event zur Outbox   |
| `markOutboxProcessed`  | id                             | void       | Als verarbeitet    |
| `markOutboxFailed`     | id, error                      | void       | Als fehlgeschlagen |
| `retryOutboxItem`      | id                             | OutboxItem | Retry erhöhen      |
| `clearProcessedOutbox` | clientId, olderThan            | void       | Cleanup            |

---

## 🔄 Transaction Patterns

### Pattern 1: Einfache Mutation

```
createProject(data):
  return db.insert(projects).values(data).returning()
```

### Pattern 2: Multi-Step Transaction

```
claimTicket(ticketId, userId):
  return db.transaction(async (tx) => {
    // 1. Ticket updaten
    const [ticket] = await tx.update(tickets)
      .set({ claimedBy: userId, status: 'in_progress' })
      .where(eq(tickets.id, ticketId))
      .returning()

    // 2. Event erstellen
    await tx.insert(ticketEvents).values({
      ticketId,
      projectId: ticket.projectId,
      type: 'claimed',
      createdBy: userId
    })

    return ticket
  })
```

### Pattern 3: Optimistic Lock

```
updateTicket(id, data, expectedVersion):
  const [updated] = await db.update(tickets)
    .set({ ...data, version: sql`version + 1` })
    .where(and(
      eq(tickets.id, id),
      eq(tickets.version, expectedVersion)
    ))
    .returning()

  if (!updated) {
    throw new ConflictError('Ticket was modified by another user')
  }

  return updated
```

---

## ⚠️ Error Handling

### Custom Error Classes

```
errors/
├── NotFoundError       # Entity nicht gefunden (404)
├── ConflictError       # Version conflict, already claimed (409)
├── ValidationError     # Ungültige Daten (400)
└── PermissionError     # Keine Berechtigung (403)
```

### Error Codes

| Code                        | Error           | Beschreibung                   |
| --------------------------- | --------------- | ------------------------------ |
| `PROJECT_NOT_FOUND`         | NotFoundError   | Projekt existiert nicht        |
| `TICKET_NOT_FOUND`          | NotFoundError   | Ticket existiert nicht         |
| `USER_NOT_FOUND`            | NotFoundError   | User existiert nicht           |
| `VERSION_CONFLICT`          | ConflictError   | Optimistic Lock fehlgeschlagen |
| `ALREADY_CLAIMED`           | ConflictError   | Ticket bereits geclaimed       |
| `INVALID_STATUS_TRANSITION` | ValidationError | Status-Übergang ungültig       |
| `SLUG_TAKEN`                | ValidationError | Projekt-Slug existiert bereits |

---

## 📱 Konkrete Beispiele

### Beispiel: Ticket mit Claim und Event

```
// Route Handler
POST /api/pg-sync/tickets/:id/claim

// Intern
const ticket = await claimTicket(params.id, currentUser.id)

// Was passiert in claimTicket:
1. Transaction starten
2. Ticket auf in_progress setzen, claimed_by = user
3. Event 'claimed' in ticket_events einfügen
4. Transaction commit
5. Return ticket

// Event (wird automatisch erstellt):
{
  type: 'claimed',
  ticketId: 'ticket-123',
  payload: { previousStatus: 'todo' },
  createdBy: 'user-456'
}
```

### Beispiel: Pull-Query mit Pagination

```
// Client fragt Events seit letztem Sync
const lastSync = await findSyncState(clientId, projectId)
const events = await findEventsSince(projectId, lastSync.lastPulledAt)

// Return bis zu 1000 Events, sortiert nach created_at
// Client verarbeitet, dann:
await updateLastPulled(clientId, projectId, events.at(-1).createdAt)
```

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                         | Zweck             | ~Zeilen |
| --------------------------------------------- | ----------------- | ------- |
| `libs/pg-sync/src/finders/index.ts`           | Re-Export         | ~20     |
| `libs/pg-sync/src/finders/project-finder.ts`  | Projekt-Queries   | ~100    |
| `libs/pg-sync/src/finders/user-finder.ts`     | User-Queries      | ~80     |
| `libs/pg-sync/src/finders/ticket-finder.ts`   | Ticket-Queries    | ~150    |
| `libs/pg-sync/src/finders/event-finder.ts`    | Event-Queries     | ~80     |
| `libs/pg-sync/src/finders/sync-finder.ts`     | Sync-Queries      | ~60     |
| `libs/pg-sync/src/actions/index.ts`           | Re-Export         | ~20     |
| `libs/pg-sync/src/actions/project-actions.ts` | Projekt-Mutations | ~120    |
| `libs/pg-sync/src/actions/user-actions.ts`    | User-Mutations    | ~80     |
| `libs/pg-sync/src/actions/ticket-actions.ts`  | Ticket-Mutations  | ~200    |
| `libs/pg-sync/src/actions/event-actions.ts`   | Event-Mutations   | ~40     |
| `libs/pg-sync/src/actions/sync-actions.ts`    | Sync-Mutations    | ~100    |
| `libs/pg-sync/src/errors/index.ts`            | Custom Errors     | ~60     |

**Gesamt: ~1110 Zeilen Code**

---

## ✅ Abschlusskriterien

- [x] Alle Finder implementiert (5 Finder-Dateien)
- [x] Alle Actions implementiert (5 Actions-Dateien)
- [x] Transactions für multi-step Operations (in ticket-actions.ts)
- [x] Optimistic Locking funktioniert (updateTicket mit version check)
- [x] Custom Errors definiert (errors/index.ts)
- [x] TypeScript compiliert ohne Fehler (`npx tsc --noEmit` ✅)
- [ ] Unit-Tests geschrieben (Phase 1.x Tests)
- [ ] Integration-Tests bestanden (Phase 1.x Tests)

---

## 📁 Implementierte Dateien

| Datei                                         | Beschreibung         | Zeilen |
| --------------------------------------------- | -------------------- | ------ |
| `libs/pg-sync/src/errors/index.ts`            | Custom Error-Klassen | ~250   |
| `libs/pg-sync/src/finders/index.ts`           | Re-Exports           | ~95    |
| `libs/pg-sync/src/finders/project-finder.ts`  | Projekt-Queries      | ~220   |
| `libs/pg-sync/src/finders/user-finder.ts`     | User-Queries         | ~170   |
| `libs/pg-sync/src/finders/ticket-finder.ts`   | Ticket-Queries       | ~290   |
| `libs/pg-sync/src/finders/event-finder.ts`    | Event-Queries        | ~180   |
| `libs/pg-sync/src/finders/sync-finder.ts`     | Sync-Queries         | ~210   |
| `libs/pg-sync/src/actions/index.ts`           | Re-Exports           | ~90    |
| `libs/pg-sync/src/actions/project-actions.ts` | Projekt-Mutations    | ~210   |
| `libs/pg-sync/src/actions/user-actions.ts`    | User-Mutations       | ~175   |
| `libs/pg-sync/src/actions/ticket-actions.ts`  | Ticket-Mutations     | ~505   |
| `libs/pg-sync/src/actions/event-actions.ts`   | Event-Mutations      | ~90    |
| `libs/pg-sync/src/actions/sync-actions.ts`    | Sync-Mutations       | ~220   |

**Gesamt: ~2.705 Zeilen Code** (mehr als geplant wegen vollständiger Implementierung)

---

## 🔗 Referenzen

- `phase-1.1-datenmodell.md` - Drizzle Schema
- `phase-0.4-shared-types.md` - Type-Definitionen
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- [Drizzle Queries](https://orm.drizzle.team/docs/select)

---

**📌 Nächste Phase:** 1.3 - Push-Mechanismus
