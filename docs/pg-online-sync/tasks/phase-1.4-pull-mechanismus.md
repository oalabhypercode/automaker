# ⬇️ Phase 1.4: Pull-Mechanismus (Postgres → Lokal)

ULTRATHINK

> **Status:** ✅ Implementiert
> **Abhängigkeiten:** Phase 1.1, 1.2 (Schema, Finder/Actions)
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Remote-Änderungen in die lokale Datenbank synchronisieren:

- Inkrementeller Pull (nur neue Events seit letztem Sync)
- Neue Tickets von Online-UI oder Kunden empfangen
- Status-Updates anderer Mitarbeiter sehen
- Konflikt-freie Merge-Strategie

---

## ❓ Proaktive F&A

### Q1: Wie funktioniert inkrementeller Pull?

✅ **Event-basierter Ansatz:**

- Client speichert `lastPulledAt` Timestamp
- Server liefert alle Events seit diesem Timestamp
- Client wendet Events der Reihe nach an
- Effizient: Nur Deltas übertragen

### Q2: Wann wird gepullt?

✅ **Pull-Trigger:**

1. **Manuell:** User klickt "Sync" Button
2. **App-Start:** Beim Öffnen der App
3. **Timer:** Auto-Pull Intervall (z.B. stündlich)
4. **Nach Push:** Automatischer Pull nach erfolgreichem Push

### Q3: Was passiert bei lokalen Änderungen während Pull?

✅ **Strategie: Push-before-Pull**

- Lokale Änderungen zuerst pushen
- Dann Pull durchführen
- Lokale ungesyncte Änderungen werden nie überschrieben

### Q4: Wie werden neue Tickets lokal erstellt?

✅ **Feature-Generierung:**

```
Remote Ticket → Lokale Feature-Datei erstellen
├── .automaker/features/{newId}/feature.json
├── Lokale ID = Remote ID (für Mapping)
└── Status: synced
```

### Q5: Was wenn Pull zu viele Daten hat?

✅ **Batched Pull:**

- Max 1000 Events pro Request
- Pagination mit Cursor (letztes Event-ID)
- Mehrere Requests bis alle Events geholt

---

## 🏛️ Pull-Architektur

### Flow-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PULL FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │  Trigger     │ (Manual, App-Start, Timer)                        │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────────────┐              │
│  │              PULL SERVICE                         │              │
│  │  • Check local pending pushes first              │              │
│  │  • Get lastPulledAt from SyncState               │              │
│  │  • Request events from server                    │              │
│  └─────────────────────┬────────────────────────────┘              │
│                        │                                            │
│                        │ HTTPS                                      │
│                        ▼                                            │
│           ┌──────────────────────┐                                 │
│           │      POSTGRES        │                                 │
│           │     (Supabase)       │                                 │
│           └──────────┬───────────┘                                 │
│                      │                                              │
│                      ▼                                              │
│  ┌──────────────────────────────────────────────────┐              │
│  │              RESPONSE                             │              │
│  │  {                                               │              │
│  │    events: [...],                                │              │
│  │    tickets: [...],    // new tickets             │              │
│  │    hasMore: false,                               │              │
│  │    cursor: "..."                                 │              │
│  │  }                                               │              │
│  └─────────────────────┬────────────────────────────┘              │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │              EVENT PROCESSOR                      │              │
│  │  • Apply events in order                         │              │
│  │  • Create new local features                     │              │
│  │  • Update existing features                      │              │
│  │  • Resolve conflicts                             │              │
│  └─────────────────────┬────────────────────────────┘              │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │              LOCAL STORE                          │              │
│  │  .automaker/features/                            │              │
│  │  ├── {existing}/feature.json  (updated)          │              │
│  │  └── {new}/feature.json       (created)          │              │
│  └──────────────────────────────────────────────────┘              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Pull-Response Struktur

### API Response

```
GET /api/pg-sync/pull?projectId=...&since=2026-01-05T10:00:00Z

Response:
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "evt-001",
        "type": "ticket_created",
        "ticketId": "ticket-123",
        "projectId": "proj-456",
        "payload": { ... },
        "createdBy": "user-789",
        "createdAt": "2026-01-06T09:00:00Z"
      },
      {
        "id": "evt-002",
        "type": "status_changed",
        "ticketId": "ticket-124",
        "payload": { "from": "todo", "to": "in_progress" },
        "createdAt": "2026-01-06T09:05:00Z"
      }
    ],
    "newTickets": [
      {
        "id": "ticket-123",
        "localId": null,
        "title": "Neues Feature vom Kunden",
        "description": "...",
        "status": "backlog",
        "priority": "medium",
        "createdBy": "customer-001",
        "createdAt": "2026-01-06T09:00:00Z"
      }
    ],
    "hasMore": false,
    "cursor": "evt-002",
    "serverTime": "2026-01-06T10:00:00Z"
  }
}
```

---

## 🔄 Event-Processing

### Event-Typen und Handler

| Event-Typ          | Handler                 | Lokale Aktion                |
| ------------------ | ----------------------- | ---------------------------- |
| `ticket_created`   | `handleTicketCreated`   | Neue Feature-Datei erstellen |
| `ticket_updated`   | `handleTicketUpdated`   | Feature-Datei aktualisieren  |
| `status_changed`   | `handleStatusChanged`   | Status-Feld updaten          |
| `ticket_claimed`   | `handleTicketClaimed`   | Claimed-Info speichern       |
| `ticket_unclaimed` | `handleTicketUnclaimed` | Claimed-Info entfernen       |
| `ticket_completed` | `handleTicketCompleted` | Status auf 'done' setzen     |
| `ticket_deleted`   | `handleTicketDeleted`   | Feature archivieren          |
| `label_added`      | `handleLabelAdded`      | Label hinzufügen             |
| `label_removed`    | `handleLabelRemoved`    | Label entfernen              |

### Handler-Implementierung

**handleTicketCreated:**

```
1. Check: Existiert lokal bereits? (by remote ID)
2. Wenn nein:
   a. Generiere lokale Feature-ID
   b. Erstelle .automaker/features/{id}/feature.json
   c. Speichere Remote-ID Mapping
   d. Emit 'feature:synced:created'
3. Wenn ja:
   Skip (Duplikat)
```

**handleTicketUpdated:**

```
1. Finde lokales Feature by remote ID
2. Wenn gefunden:
   a. Vergleiche Versionen
   b. Wenn remote neuer: Update lokale Daten
   c. Wenn lokal neuer: Skip (wird beim nächsten Push gesynced)
3. Wenn nicht gefunden:
   Wie 'ticket_created' behandeln
```

**handleStatusChanged:**

```
1. Finde lokales Feature by remote ID
2. Status-Mapping anwenden:
   remote 'in_progress' → lokal 'in-progress'
3. Feature-Datei updaten
4. Emit 'feature:synced:statusChanged'
```

---

## 📝 Implementierungsdetails

### 1. Pull Service (`sync/pull-service.ts`)

**Hauptfunktionen:**

| Funktion                                 | Beschreibung                      |
| ---------------------------------------- | --------------------------------- |
| `pullChanges(projectId)`                 | Haupt-Pull Funktion               |
| `fetchRemoteEvents(since)`               | API-Call für Events               |
| `processEvents(events)`                  | Events der Reihe nach verarbeiten |
| `createLocalFeature(ticket)`             | Neues Feature aus Ticket          |
| `updateLocalFeature(featureId, changes)` | Feature aktualisieren             |
| `getPullStatus()`                        | Status für UI                     |

**Pull Logic:**

```
async pullChanges(projectId):
  1. syncState = getSyncState(clientId, projectId)

  2. // Pending pushes zuerst
     if hasPendingOutbox():
       await processOutbox()

  3. // Events abrufen
     since = syncState?.lastPulledAt ?? new Date(0)
     response = await fetchRemoteEvents(projectId, since)

  4. // Events verarbeiten
     for event in response.events:
       await processEvent(event)

  5. // Neue Tickets erstellen
     for ticket in response.newTickets:
       if not existsLocally(ticket.id):
         await createLocalFeature(ticket)

  6. // Sync-State aktualisieren
     await updateSyncState({
       lastPulledAt: response.serverTime,
       lastEventId: response.cursor
     })

  7. emit('sync:pull:complete', { eventsProcessed, ticketsCreated })
```

---

### 2. Feature Mapper (`sync/feature-mapper.ts`)

**Aufgabe:** Konvertierung zwischen Remote-Ticket und lokalem Feature

**Ticket → Feature:**

```
mapTicketToFeature(ticket):
  return {
    id: generateLocalId(),
    title: ticket.title,
    description: ticket.description,
    status: mapStatus(ticket.status),
    priority: mapPriority(ticket.priority),
    labels: ticket.labels,
    syncId: ticket.id,        // Remote-ID für Mapping
    syncStatus: 'synced',
    lastSyncedAt: new Date(),
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt
  }
```

**Feature → Ticket (für Push):**

```
mapFeatureToTicket(feature):
  return {
    localId: feature.id,
    title: feature.title,
    description: feature.description,
    status: mapStatusReverse(feature.status),
    priority: mapPriorityReverse(feature.priority),
    labels: feature.labels
  }
```

**Status-Mapping (bidirektional):**

```
const STATUS_MAP = {
  'backlog': 'backlog',
  'todo': 'todo',
  'in_progress': 'in-progress',    // DB → Lokal
  'in-progress': 'in_progress',    // Lokal → DB
  'review': 'review',
  'done': 'done',
  'archived': 'archived'
}
```

---

### 3. Sync State Manager (`sync/sync-state-manager.ts`)

**Lokale Speicherung in `.automaker/sync-state.json`:**

```
{
  "clientId": "client-abc-123",
  "projects": {
    "proj-456": {
      "lastPulledAt": "2026-01-06T10:00:00Z",
      "lastPushedAt": "2026-01-06T09:55:00Z",
      "lastEventId": "evt-002"
    }
  }
}
```

**Funktionen:**

```
getSyncState(projectId): SyncState | null
updateSyncState(projectId, data: Partial<SyncState>): void
getClientId(): string
resetSyncState(projectId): void
```

---

### 4. Remote-ID Mapping (`sync/id-mapper.ts`)

**Speicherung: `.automaker/sync-mappings.json`**

```
{
  "remoteToLocal": {
    "ticket-123": "feature-abc",
    "ticket-124": "feature-def"
  },
  "localToRemote": {
    "feature-abc": "ticket-123",
    "feature-def": "ticket-124"
  }
}
```

**Funktionen:**

```
getLocalId(remoteId): string | null
getRemoteId(localId): string | null
setMapping(localId, remoteId): void
removeMapping(id): void
```

---

### 5. API Endpoints (Server-seitig)

**Neue Routes in `apps/server/src/routes/pg-sync/`:**

| Route                       | Method | Beschreibung                |
| --------------------------- | ------ | --------------------------- |
| `/api/pg-sync/pull`         | GET    | Events seit Timestamp       |
| `/api/pg-sync/pull/tickets` | GET    | Neue Tickets seit Timestamp |
| `/api/pg-sync/pull/status`  | GET    | Sync-Status                 |

**Pull Endpoint:**

```
GET /api/pg-sync/pull
Query:
  - projectId: string (required)
  - since: ISO timestamp (required)
  - limit: number (default: 1000)
  - cursor: string (optional, für Pagination)

Response: Siehe oben
```

---

## 🔄 Konflikt-Handling beim Pull

### Szenarien

| Situation         | Remote-Status | Lokal-Status | Aktion                       |
| ----------------- | ------------- | ------------ | ---------------------------- |
| Beide unverändert | gleich        | gleich       | Skip                         |
| Remote geändert   | neuer         | älter        | Remote übernehmen            |
| Lokal geändert    | älter         | neuer        | Lokal behalten, Push pending |
| Beide geändert    | neuer         | neuer        | Conflict Resolution          |

### Conflict Resolution

```
resolveConflict(localFeature, remoteTicket, strategy):
  switch strategy:
    case 'remote_wins':
      // Remote-Daten übernehmen
      updateLocalFeature(localFeature.id, remoteTicket)
      markAsSynced(localFeature.id)

    case 'local_wins':
      // Lokale Daten behalten, Push erzwingen
      addToOutbox('ticket_updated', localFeature, force: true)

    case 'manual':
      // UI zeigt Konflikt-Dialog
      emit('sync:conflict', { local: localFeature, remote: remoteTicket })
```

---

## 📱 UI-Integration

### Pull-Status Anzeige

```
┌────────────────────────────────────────────┐
│  Sync Status: 🔄 Pulling...               │
│  ├── Events: 45/120                        │
│  ├── New Tickets: 3                        │
│  └── Progress: 37%                         │
│                                            │
│  [Cancel]                                  │
└────────────────────────────────────────────┘
```

**Nach Pull:**

```
┌────────────────────────────────────────────┐
│  Sync Complete: ✅                         │
│  ├── Events processed: 120                 │
│  ├── New tickets: 3                        │
│  ├── Updated tickets: 15                   │
│  └── Time: 2.3s                            │
│                                            │
│  [View Changes]                            │
└────────────────────────────────────────────┘
```

### Neue Tickets Notification

```
┌────────────────────────────────────────────┐
│  📥 3 neue Tickets vom Server              │
│                                            │
│  • "Login-Button funktioniert nicht"       │
│  • "Neue Farbe für Header"                 │
│  • "Performance-Problem auf Mobile"        │
│                                            │
│  [Alle anzeigen]                           │
└────────────────────────────────────────────┘
```

---

## ⚡ Performance

### Optimierungen

1. **Batched Processing**
   - Events in Chunks von 100 verarbeiten
   - Zwischen Chunks: UI-Update + yield

2. **Parallel Feature-Creation**
   - Neue Features parallel erstellen (max 5 concurrent)
   - Schreib-Operationen sind unabhängig

3. **Incremental UI-Update**
   - Board nicht komplett neu rendern
   - Einzelne Karten updaten via Events

4. **Background Pull**
   - Pull in Web Worker (wenn möglich)
   - UI bleibt responsiv

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                           | Zweck            | ~Zeilen |
| ----------------------------------------------- | ---------------- | ------- |
| `libs/pg-sync/src/sync/pull-service.ts`         | Pull-Logik       | ~180    |
| `libs/pg-sync/src/sync/event-processor.ts`      | Event-Handler    | ~200    |
| `libs/pg-sync/src/sync/feature-mapper.ts`       | Ticket ↔ Feature | ~100    |
| `libs/pg-sync/src/sync/sync-state-manager.ts`   | State-Management | ~80     |
| `libs/pg-sync/src/sync/id-mapper.ts`            | ID-Mapping       | ~60     |
| `libs/pg-sync/src/sync/pull-api.ts`             | API-Calls        | ~80     |
| `apps/server/src/routes/pg-sync/pull-routes.ts` | Server Routes    | ~120    |

**Gesamt: ~820 Zeilen Code**

---

## ✅ Abschlusskriterien

- [x] Pull-Service implementiert
- [x] Event-Processing funktioniert
- [x] Neue Tickets werden lokal erstellt
- [x] Bestehende Features werden aktualisiert
- [x] Sync-State wird korrekt gespeichert
- [x] ID-Mapping funktioniert bidirektional
- [x] Konflikt-Handling implementiert
- [x] API-Endpoints erstellt (Client-seitig)
- [ ] UI zeigt Pull-Status (Phase 1.5)
- [ ] Tests geschrieben (Future)

---

## 🔗 Referenzen

- `phase-1.3-push-mechanismus.md` - Push für Gegenrichtung
- `phase-1.2-finder-actions.md` - Finder für DB-Queries
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `apps/server/src/services/feature-loader.ts` - Lokale Feature-Speicherung

---

**📌 Nächste Phase:** 1.5 - Auto-Sync & Konfiguration
