# Phase 4.1: Pull Server-Route

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Phase:** 4.1 - Pull Server-Route
> **Stand:** 2026-01-09
> **Status:** ✅ IMPLEMENTIERT

---

## 🎯 Ziel der Phase

Die **fehlende Server-Route** `/api/pg-sync/pull` implementieren, die den existierenden Library-Code aus `libs/pg-sync/src/sync/pull-service.ts` nutzt.

**Problem:** Der Pull-Service existiert als Library-Code, aber es gibt keine HTTP-Route, die ihn aufruft!

---

## 🔗 Abhängigkeiten & Voraussetzungen

### Existierender Code (WIEDERVERWENDEN!)

| Datei                                         | Beschreibung                    | Status       |
| --------------------------------------------- | ------------------------------- | ------------ |
| `libs/pg-sync/src/sync/pull-service.ts`       | Pull-Service Klasse             | ✅ Existiert |
| `libs/pg-sync/src/sync/pull-api.ts`           | HTTP Client (für externe Calls) | ✅ Existiert |
| `libs/pg-sync/src/sync/pull-types.ts`         | TypeScript Types                | ✅ Existiert |
| `libs/pg-sync/src/sync/event-processor.ts`    | Event-Verarbeitung              | ⚠️ Prüfen    |
| `libs/pg-sync/src/sync/sync-state-manager.ts` | Sync-State                      | ⚠️ Prüfen    |

### Fehlende Teile

| Teil              | Beschreibung                                           |
| ----------------- | ------------------------------------------------------ |
| Server-Route      | `apps/server/src/routes/pg-sync/pull.ts`               |
| Route-Integration | In `apps/server/src/routes/pg-sync/index.ts` einbinden |
| Projekt-Mapping   | projectId (Postgres) ↔ lokaler Projekt-Pfad            |

---

## 🚀 Strategie

### Architektur-Übersicht

```
Client (UI)
    │
    │ POST /api/pg-sync/pull
    │ Body: { projectId, localProjectPath }
    ▼
Server (Express Route)
    │
    │ 1. projectId validieren
    │ 2. Tickets aus Postgres holen
    │ 3. Response mit Tickets zurückgeben
    ▼
Client (UI)
    │
    │ Tickets als lokale Features speichern
    │ (Phase 4.4)
    ▼
Lokale .automaker/features/*.json
```

---

## ❓ Edge Cases & Proaktive F&A

### ✅ Was passiert, wenn das Projekt nicht in Postgres existiert?

- 404 Response mit klarer Fehlermeldung
- UI zeigt Toast: "Projekt nicht gefunden"

### ✅ Was passiert bei Netzwerk-Timeout?

- Timeout nach 30 Sekunden (konfigurierbar)
- Retry-Logik in UI (max 3 Versuche)

### ✅ Was passiert bei sehr vielen Tickets (1000+)?

- Pagination mit `cursor` und `limit` Parameter
- UI zeigt Progress-Indikator

### ✅ Was passiert bei gleichzeitigem Push und Pull?

- Server-Side Locking auf Projekt-Ebene
- 409 Conflict Response wenn bereits ein Sync läuft

---

## 📋 Implementierungs-Tasks

### Task 1: Pull-Route erstellen

**Datei:** `apps/server/src/routes/pg-sync/pull.ts` **~150 Zeilen**

**Zweck:** Express-Router für Pull-Operationen

**Endpoints:**

| Method | Path           | Beschreibung                |
| ------ | -------------- | --------------------------- |
| `POST` | `/pull`        | Tickets für Projekt abrufen |
| `GET`  | `/pull/status` | Sync-Status abfragen        |

**Request-Body (POST /pull):**

```typescript
interface PullRequest {
  projectId: string; // Postgres Project ID
  since?: string; // ISO Timestamp (optional)
  limit?: number; // Max Tickets (default 100)
  cursor?: string; // Pagination Cursor
}
```

**Response-Body:**

```typescript
interface PullResponse {
  success: boolean;
  data: {
    tickets: RemoteTicket[]; // Tickets aus Postgres
    hasMore: boolean; // Weitere Tickets vorhanden?
    cursor: string | null; // Cursor für nächste Seite
    syncTimestamp: string; // Für nächsten Pull
  };
  error?: string;
}
```

---

### Task 2: Route in Index einbinden

**Datei:** `apps/server/src/routes/pg-sync/index.ts` **~10 Zeilen Änderung**

**Änderungen:**

- Import der neuen Pull-Route
- Router einbinden: `router.use('/pull', pullRouter)`

---

### Task 3: Ticket-Finder erweitern (falls nötig)

**Datei:** `libs/pg-sync/src/finders/ticket-finder.ts` **~50 Zeilen Änderung**

**Neue Finder-Funktion:**

- `findTicketsForPull(projectId, since, limit, cursor)` - Optimierte Query für Pull

---

## 🔧 Wiederverwendung

### Aus libs/pg-sync wiederverwenden:

| Modul               | Funktion                       | Verwendung         |
| ------------------- | ------------------------------ | ------------------ |
| `ticket-finder.ts`  | `findTicketsByProject()`       | Tickets laden      |
| `project-finder.ts` | `findProjectById()`            | Projekt validieren |
| `pull-types.ts`     | `RemoteTicket`, `PullResponse` | Types              |

### Aus apps/server wiederverwenden:

| Modul              | Funktion                   | Verwendung |
| ------------------ | -------------------------- | ---------- |
| `pg-sync/index.ts` | Router-Pattern             | Struktur   |
| `lib/auth.ts`      | Auth-Middleware (optional) | Schutz     |

---

## 📊 Geschätzte Komplexität

| Task                       | Zeilen   | Komplexität |
| -------------------------- | -------- | ----------- |
| Task 1: Pull-Route         | ~150     | Mittel      |
| Task 2: Index-Integration  | ~10      | Niedrig     |
| Task 3: Finder-Erweiterung | ~50      | Niedrig     |
| **Gesamt**                 | **~210** | **Mittel**  |

---

## ✅ Akzeptanzkriterien

1. [x] `POST /api/pg-sync/pull` gibt Tickets für ein Projekt zurück
2. [x] `GET /api/pg-sync/pull/status` gibt Sync-Status zurück
3. [x] Pagination funktioniert mit cursor/limit
4. [x] Fehlerbehandlung für nicht existierende Projekte
5. [x] TypeScript-Check erfolgreich: `npx tsc --noEmit`

## 📝 Implementierung (2026-01-09)

**Erstellte Dateien:**

- `apps/server/src/routes/pg-sync/pull.ts` (~280 Zeilen)

**Geänderte Dateien:**

- `apps/server/src/routes/pg-sync/index.ts` (Import + Router-Einbindung)

**Endpoints:**

- `POST /api/pg-sync/pull` - Tickets für ein Projekt abrufen
- `GET /api/pg-sync/pull/status` - Sync-Status abfragen
- `GET /api/pg-sync/pull/project/:projectId` - Alternative GET-Methode

---

## 📝 Notizen für Implementierung

- **WICHTIG:** Existierenden Code in `libs/pg-sync/src/sync/` prüfen und wiederverwenden!
- **NICHT** die komplette Pull-Service-Klasse nutzen (zu komplex für erste Version)
- **EINFACHER START:** Direkt Ticket-Finder aufrufen, später Pull-Service integrieren

---

## 🔗 Nächste Phase

Nach Abschluss dieser Phase → **Phase 4.2: Pull UI-Button**
