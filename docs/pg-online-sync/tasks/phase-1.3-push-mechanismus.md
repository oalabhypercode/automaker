# ⬆️ Phase 1.3: Push-Mechanismus (Lokal → Postgres)

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 1.1, 1.2 (Schema, Finder/Actions)
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Lokale Änderungen zuverlässig zur Postgres-DB synchronisieren:

- Outbox-Pattern für zuverlässige Übertragung
- Event-basierte Integration (minimal invasiv)
- Retry-Logik für Netzwerkfehler
- Konflikt-Erkennung

---

## ❓ Proaktive F&A

### Q1: Warum Outbox-Pattern statt direktem Push?

✅ **Vorteile Outbox:**

- Zuverlässig: Keine Datenverluste bei Netzwerkproblemen
- Offline-fähig: Events werden lokal gequeued
- Idempotent: Retry sicher durch Event-IDs
- Nachverfolgbar: Audit-Log der Änderungen

### Q2: Wann wird gepusht?

✅ **Push-Trigger:**

1. **Manuell:** User klickt "Sync" Button
2. **Automatisch:** Bei bestimmten Events (Status-Änderung)
3. **Timer:** Auto-Sync Intervall (konfigurierbar)
4. **App-Close:** Beim Schließen der App

### Q3: Was passiert bei Konflikten?

✅ **Konflikt-Szenarien:**

- Ticket wurde remote bereits geändert (Version mismatch)
- Ticket wurde remote geclaimed (Claim-Konflikt)
- Ticket wurde remote gelöscht (Gone)

**Strategie:** Last-Write-Wins mit UI-Warnung

### Q4: Wie integriert sich das in bestehenden Code?

✅ **Event-Listener Ansatz:**

```
// Bestehender Code emittiert bereits Events
eventEmitter.emit('feature:updated', feature)

// Neuer Listener fängt Events und erstellt Outbox-Items
pgSyncListener.on('feature:updated', async (feature) => {
  await addToOutbox({ type: 'ticket_updated', ... })
})
```

### Q5: Wie wird die Outbox verarbeitet?

✅ **Processing Pipeline:**

```
1. Outbox-Items mit Status 'pending' laden
2. Pro Item: API-Request an Postgres
3. Erfolg: Status → 'completed'
4. Fehler: Retry-Count erhöhen, später erneut versuchen
5. Max Retries erreicht: Status → 'failed', User informieren
```

---

## 🏛️ Push-Architektur

### Flow-Diagramm

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PUSH FLOW                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐                                                   │
│  │  User Action │ (z.B. Ticket erstellen, Status ändern)           │
│  └──────┬───────┘                                                   │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────┐     ┌──────────────┐                             │
│  │ Local Store  │────►│ Event Emit   │                             │
│  │  (feature)   │     │  (existing)  │                             │
│  └──────────────┘     └──────┬───────┘                             │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────┐               │
│  │              SYNC LISTENER                       │               │
│  │         (neuer Code, Event-basiert)             │               │
│  └─────────────────────┬───────────────────────────┘               │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │                  LOCAL OUTBOX                     │              │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │              │
│  │  │Event 1 │ │Event 2 │ │Event 3 │ │Event 4 │    │              │
│  │  │pending │ │pending │ │pending │ │pending │    │              │
│  │  └────────┘ └────────┘ └────────┘ └────────┘    │              │
│  └─────────────────────┬────────────────────────────┘              │
│                        │                                            │
│                        ▼                                            │
│  ┌──────────────────────────────────────────────────┐              │
│  │              PUSH SERVICE                         │              │
│  │  • Process pending items                          │              │
│  │  • Retry failed items                            │              │
│  │  • Handle conflicts                              │              │
│  └─────────────────────┬────────────────────────────┘              │
│                        │                                            │
│                        │ HTTPS                                      │
│                        ▼                                            │
│           ┌──────────────────────┐                                 │
│           │      POSTGRES        │                                 │
│           │     (Supabase)       │                                 │
│           └──────────────────────┘                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Outbox-Struktur

### Lokale Outbox (SQLite/IndexedDB)

**Hinweis:** Die lokale Outbox wird im bestehenden `.automaker/` Ordner gespeichert.

| Feld         | Typ           | Beschreibung                                 |
| ------------ | ------------- | -------------------------------------------- |
| id           | string (UUID) | Eindeutige Event-ID                          |
| eventType    | string        | Event-Typ (created, updated, ...)            |
| entityType   | string        | 'ticket' \| 'project'                        |
| entityId     | string        | Lokale Feature-ID                            |
| payload      | JSON          | Vollständige Entity-Daten                    |
| projectId    | string        | Ziel-Projekt                                 |
| status       | string        | pending \| processing \| completed \| failed |
| retries      | number        | Anzahl Versuche                              |
| errorMessage | string?       | Letzter Fehler                               |
| createdAt    | Date          | Erstellzeitpunkt                             |
| processedAt  | Date?         | Verarbeitungszeitpunkt                       |

---

## 🔄 Push-Events

### Welche Events werden gepusht?

| Event              | Trigger                      | Payload                    |
| ------------------ | ---------------------------- | -------------------------- |
| `ticket_created`   | Neues Ticket lokal erstellt  | Vollständiges Ticket       |
| `ticket_updated`   | Titel, Beschreibung geändert | Geänderte Felder + Version |
| `status_changed`   | Status geändert              | From, To, Timestamp        |
| `ticket_claimed`   | "In Bearbeitung" gesetzt     | User-ID, Timestamp         |
| `ticket_unclaimed` | Claim aufgehoben             | Previous User              |
| `ticket_completed` | Auf "Done" gesetzt           | Completion-Info            |
| `label_added`      | Label hinzugefügt            | Label-Name                 |
| `label_removed`    | Label entfernt               | Label-Name                 |

---

## 📝 Implementierungsdetails

### 1. Sync Listener (`sync/sync-listener.ts`)

**Aufgabe:** Bestehende Events abfangen und Outbox befüllen

```
Registrierte Events:
├── 'feature:created'    → createOutboxItem('ticket_created', ...)
├── 'feature:updated'    → createOutboxItem('ticket_updated', ...)
├── 'feature:statusChanged' → createOutboxItem('status_changed', ...)
└── 'feature:deleted'    → createOutboxItem('ticket_deleted', ...)
```

**Mapping: Feature → Ticket**

```
Feature (lokal)          Ticket (Postgres)
─────────────────        ─────────────────
id                   →   local_id
title               →   title
description         →   description
status              →   status (mapped)
priority            →   priority (mapped)
labels              →   labels
```

**Status-Mapping:**

```
Feature Status       Ticket Status
──────────────       ─────────────
'backlog'        →   'backlog'
'todo'           →   'todo'
'in-progress'    →   'in_progress'
'review'         →   'review'
'done'           →   'done'
'archived'       →   'archived'
```

---

### 2. Push Service (`sync/push-service.ts`)

**Hauptfunktionen:**

| Funktion            | Beschreibung                     |
| ------------------- | -------------------------------- |
| `processOutbox()`   | Alle pending Items verarbeiten   |
| `pushItem(item)`    | Einzelnes Item pushen            |
| `retryFailed()`     | Fehlgeschlagene erneut versuchen |
| `getOutboxStatus()` | Status-Übersicht für UI          |

**Processing Logic:**

```
async processOutbox():
  1. items = findPendingOutbox(clientId, limit: 50)
  2. for item in items:
       a. markAsProcessing(item.id)
       b. try:
            result = await pushToRemote(item)
            markAsCompleted(item.id)
          catch error:
            handlePushError(item, error)
  3. emit('sync:push:complete', { processed, failed })
```

**Push to Remote:**

```
async pushToRemote(item):
  switch item.eventType:
    case 'ticket_created':
      return await createRemoteTicket(item.payload)
    case 'ticket_updated':
      return await updateRemoteTicket(item.entityId, item.payload)
    case 'status_changed':
      return await updateRemoteTicketStatus(item.entityId, item.payload)
    case 'ticket_claimed':
      return await claimRemoteTicket(item.entityId, item.payload)
    ...
```

---

### 3. Error Handling

**Retry-Strategie:**

```
Retry-Intervalle (Exponential Backoff):
├── Retry 1: nach 1 Minute
├── Retry 2: nach 5 Minuten
├── Retry 3: nach 15 Minuten
├── Retry 4: nach 1 Stunde
└── Retry 5: FINAL → Status: 'failed'
```

**Error-Typen:**

| Error         | Aktion                                  |
| ------------- | --------------------------------------- |
| NetworkError  | Retry später                            |
| 409 Conflict  | Conflict-Resolution, dann Retry         |
| 404 Not Found | Ticket remote gelöscht → lokale Warnung |
| 401/403       | Auth-Problem → User informieren         |
| 500 Server    | Retry später                            |

**Conflict Resolution:**

```
handleConflict(item, remoteVersion):
  1. Lokale Version vs Remote Version vergleichen
  2. if configuredStrategy === 'local_wins':
       Force-Update mit lokalen Daten
  3. if configuredStrategy === 'remote_wins':
       Lokales Update mit Remote-Daten
  4. if configuredStrategy === 'manual':
       UI-Dialog zeigen, User entscheidet
```

---

### 4. API Endpoints (Server-seitig)

**Neue Routes in `apps/server/src/routes/pg-sync/`:**

| Route                                            | Method | Beschreibung           |
| ------------------------------------------------ | ------ | ---------------------- |
| `/api/pg-sync/push`                              | POST   | Batch-Push von Events  |
| `/api/pg-sync/push/:projectId/ticket`            | POST   | Neues Ticket erstellen |
| `/api/pg-sync/push/:projectId/ticket/:id`        | PATCH  | Ticket updaten         |
| `/api/pg-sync/push/:projectId/ticket/:id/claim`  | POST   | Ticket claimen         |
| `/api/pg-sync/push/:projectId/ticket/:id/status` | PATCH  | Status ändern          |

**Batch-Push Payload:**

```
POST /api/pg-sync/push
{
  "clientId": "client-123",
  "projectId": "proj-456",
  "events": [
    { "type": "ticket_created", "payload": {...}, "localId": "..." },
    { "type": "status_changed", "payload": {...}, "ticketId": "..." }
  ]
}

Response:
{
  "success": true,
  "results": [
    { "localId": "...", "remoteId": "...", "status": "created" },
    { "ticketId": "...", "status": "updated" }
  ],
  "conflicts": []
}
```

---

## 📱 UI-Integration

### Push-Status Anzeige

```
┌────────────────────────────────────────────┐
│  Sync Status: 🟢 Synced                    │
│  ├── Pending: 0                            │
│  ├── Failed: 0                             │
│  └── Last Push: 10:35 AM                   │
│                                            │
│  [Sync Now]                                │
└────────────────────────────────────────────┘
```

**Bei Pending Items:**

```
┌────────────────────────────────────────────┐
│  Sync Status: 🟡 Pending                   │
│  ├── Pending: 3 items                      │
│  ├── Failed: 0                             │
│  └── Last Push: 10:35 AM                   │
│                                            │
│  [Sync Now (3)]                            │
└────────────────────────────────────────────┘
```

**Bei Fehlern:**

```
┌────────────────────────────────────────────┐
│  Sync Status: 🔴 Error                     │
│  ├── Pending: 1 item                       │
│  ├── Failed: 2 items                       │
│  └── Last Push: 10:35 AM                   │
│                                            │
│  ⚠️ 2 items failed to sync               │
│  [View Details] [Retry All]                │
└────────────────────────────────────────────┘
```

---

## ⚡ Performance

### Batching

- Max 50 Events pro Push-Request
- Parallel-Processing mit Limit (3 concurrent)

### Debouncing

- Schnelle aufeinanderfolgende Änderungen werden gebündelt
- Debounce-Zeit: 500ms

### Compression

- Payload-Compression für große Descriptions (gzip)

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                           | Zweck             | ~Zeilen |
| ----------------------------------------------- | ----------------- | ------- |
| `libs/pg-sync/src/sync/index.ts`                | Re-Export         | ~15     |
| `libs/pg-sync/src/sync/sync-listener.ts`        | Event-Listener    | ~120    |
| `libs/pg-sync/src/sync/push-service.ts`         | Push-Logik        | ~200    |
| `libs/pg-sync/src/sync/outbox-manager.ts`       | Outbox CRUD       | ~100    |
| `libs/pg-sync/src/sync/conflict-resolver.ts`    | Konflikt-Handling | ~80     |
| `libs/pg-sync/src/sync/push-api.ts`             | API-Calls         | ~120    |
| `apps/server/src/routes/pg-sync/push-routes.ts` | Server Routes     | ~150    |

**Gesamt: ~785 Zeilen Code**

### Änderungen an bestehendem Code

```
apps/server/src/index.ts:
  + import { registerPgSyncRoutes } from '@automaker/pg-sync'
  + registerPgSyncRoutes(app)  // 2 Zeilen hinzufügen
```

---

## 🔗 Integration Points

### Minimal-invasive Integration

**Option A: Event-basiert (empfohlen)**

```
// In libs/pg-sync/src/sync/sync-listener.ts
import { eventEmitter } from '@automaker/utils'

export function registerSyncListeners() {
  eventEmitter.on('feature:created', handleFeatureCreated)
  eventEmitter.on('feature:updated', handleFeatureUpdated)
  // ...
}

// Aufruf beim Server-Start (1 Zeile)
registerSyncListeners()
```

**Option B: Hook-basiert**

```
// Falls Events nicht ausreichen
// In bestehenden FeatureLoader hooks hinzufügen
export const featureLoaderHooks = {
  afterCreate: async (feature) => {
    await pgSync.onFeatureCreated(feature)
  }
}
```

---

## ✅ Abschlusskriterien

- [ ] Sync-Listener registriert Events
- [ ] Outbox speichert pending Events
- [ ] Push-Service verarbeitet Outbox
- [ ] Retry-Logik funktioniert
- [ ] Konflikt-Erkennung implementiert
- [ ] API-Endpoints erstellt
- [ ] UI zeigt Sync-Status
- [ ] Nur 2-3 Zeilen am bestehenden Code geändert
- [ ] Tests geschrieben

---

## 🔗 Referenzen

- `phase-1.2-finder-actions.md` - Actions für DB-Mutations
- `phase-0.3-erweiterungsstrategie.md` - Event-Integration
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `apps/server/src/lib/events.ts` - Bestehender EventEmitter

---

**📌 Nächste Phase:** 1.4 - Pull-Mechanismus
