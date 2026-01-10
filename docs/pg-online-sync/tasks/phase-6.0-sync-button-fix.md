# Phase 6.0: Sync-Button UX-Korrektur - Übersicht & Problem-Analyse

ULTRATHINK

> **Status:** 📋 Erstellt
> **Priorität:** 🔴 KRITISCH
> **Datum:** 2026-01-09

---

## 🚨 Problem-Analyse

### Was ist FALSCH?

Die Sync-Buttons wurden an der **falschen Stelle** implementiert und haben eine **verwirrende Struktur**:

#### 1. Falsche Platzierung

```
❌ AKTUELL:
┌─────────────────────────────────────────────────────────┐
│  /online-sync (online-sync-view.tsx)                    │
│  ├── ProjectCard                                        │
│  │   └── ProjectSyncButtons (Zeile 249-443)             │
│  │       ├── [Sync from Remote]                         │
│  │       ├── [Sync to Local Board]                      │
│  │       └── [Push to Remote]                           │
└─────────────────────────────────────────────────────────┘

✅ GEWÜNSCHT:
┌─────────────────────────────────────────────────────────┐
│  /board (board-view.tsx)                                │
│  ├── BoardHeader                                        │
│  │   └── SyncButtons (NEUE Komponente)                  │
│  │       ├── [Pull from Database]                       │
│  │       └── [Push to Database]                         │
└─────────────────────────────────────────────────────────┘
```

#### 2. Zu viele Buttons (3 statt 2)

| Aktueller Button    | Was er tut                                       | Problem                    |
| ------------------- | ------------------------------------------------ | -------------------------- |
| Sync from Remote    | Holt Tickets von Postgres in lokalen Cache       | Verwirrende Namensgebung   |
| Sync to Local Board | Schreibt Cache-Tickets in `.automaker/features/` | Unnötiger Zwischenschritt  |
| Push to Remote      | Sendet `.automaker/features/` zur Postgres DB    | Funktioniert nur mit Local |

#### 3. Workflow-Problem

```
❌ AKTUELLER WORKFLOW (zu kompliziert):
1. User öffnet /online-sync
2. User sucht sein Projekt
3. User klickt "Sync from Remote"
4. User klickt "Sync to Local Board"
5. User wechselt zu /board
6. User sieht die Tickets

✅ GEWÜNSCHTER WORKFLOW (einfach):
1. User öffnet /board
2. User klickt "Pull from Database"
3. User sieht die Tickets
```

---

## 🎯 Ziel

### 2 klare Buttons im Kanban-Board

```
┌─────────────────────────────────────────────────────────┐
│  KANBAN BOARD (/board)                                   │
├─────────────────────────────────────────────────────────┤
│  Header: [Auto Mode] [Concurrency] [+ Add]              │
│          [Pull from Database] [Push to Database]        │
├─────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────────┐  ┌────────┐  ┌─────────┐ │
│  │ BACKLOG │  │ IN PROGRESS │  │ REVIEW │  │  DONE   │ │
│  └─────────┘  └─────────────┘  └────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Button-Funktionalität

#### Pull from Database

```
Trigger: User klickt "Pull from Database"

Ablauf:
1. Finde das passende Online-Projekt (by name/slug matching)
2. Hole alle Tickets aus Postgres DB (API: /api/pg-sync/pull)
3. Konvertiere Postgres-Tickets zu lokalen Features
4. Schreibe Features in .automaker/features/
5. Aktualisiere den Zustand im Store (useAppStore)
6. Zeige Toast: "X Ticket(s) aus Datenbank geladen"

Edge Cases:
├── Kein passendes Online-Projekt gefunden → Toast: "Projekt nicht in Datenbank"
├── Keine neuen Tickets → Toast: "Keine neuen Tickets"
└── Fehler bei der Verbindung → Toast: "Verbindung fehlgeschlagen"
```

#### Push to Database

```
Trigger: User klickt "Push to Database"

Ablauf:
1. Finde das passende Online-Projekt (by name/slug matching)
2. Sammle alle lokalen Features aus .automaker/features/
3. Sende Features zur Postgres DB (API: /api/pg-sync/push)
4. Zeige Toast: "X Ticket(s) zur Datenbank gesendet"

Edge Cases:
├── Kein passendes Online-Projekt → Toast: "Projekt nicht in Datenbank"
├── Projekt noch nicht importiert → Biete Import an
├── Keine lokalen Features → Toast: "Keine Tickets zum Pushen"
└── Konflikt (gleiches Ticket geändert) → Letzte Änderung gewinnt
```

---

## 📋 Phasen-Übersicht

| Phase | Beschreibung                                | Geschätzte Zeilen | Abhängigkeiten |
| ----- | ------------------------------------------- | ----------------- | -------------- |
| 6.1   | Alte Buttons aus online-sync-view entfernen | ~200 (entfernt)   | Keine          |
| 6.2   | Sync-Buttons in board-view integrieren      | ~150              | 6.1            |
| 6.3   | Vereinfachte Pull/Push Logik                | ~250              | 6.2            |

**Gesamt: ~400 neue Zeilen, ~200 entfernte Zeilen**

---

## 🔗 Betroffene Dateien

### Zu ändern:

| Datei                                                      | Änderung                      |
| ---------------------------------------------------------- | ----------------------------- |
| `apps/ui/src/components/views/online-sync-view.tsx`        | Entferne `ProjectSyncButtons` |
| `apps/ui/src/components/views/board-view.tsx`              | Füge neue Sync-Buttons hinzu  |
| `apps/ui/src/components/views/board-view/board-header.tsx` | Integration der Buttons       |

### Wiederverwendbar (bereits existierend):

| Datei                                      | Verwendung                          |
| ------------------------------------------ | ----------------------------------- |
| `apps/ui/src/hooks/use-online-projects.ts` | `usePullToLocal`, `usePushToRemote` |
| `apps/server/src/routes/pg-sync/pull.ts`   | Pull API Route                      |
| `apps/server/src/routes/pg-sync/push.ts`   | Push API Route                      |

---

## ❓ Proaktive F&A

### Q1: Was passiert, wenn das Projekt nicht in der Datenbank existiert?

✅ **Antwort:** Button zeigt Warnung "Projekt nicht verbunden" und bietet an, zur `/online-sync` Seite zu navigieren um das Projekt zu importieren.

### Q2: Wie werden Duplikate vermieden?

✅ **Antwort:** Die existierende `sync-id-mapper.ts` mappt Postgres-Ticket-IDs zu lokalen Feature-IDs. Bereits synchronisierte Tickets werden erkannt und nur aktualisiert statt neu erstellt.

### Q3: Was ist mit der online-sync Seite?

✅ **Antwort:** Die `/online-sync` Seite bleibt bestehen für:

- Initiales Importieren von Projekten
- Projekt-Einstellungen (Public Access, Passwort, etc.)
- Übersicht aller Online-Projekte

Nur die Sync-Buttons werden entfernt, da sie im Board sein sollen.

### Q4: Was passiert bei Offline-Nutzung?

✅ **Antwort:** Buttons zeigen "Offline" Status und sind deaktiviert wenn keine Postgres-Verbindung besteht.

---

## 📚 Referenzen

- `docs/pg-online-sync/GLOBAL-TASKLIST.md` - Gesamt-Projektübersicht
- `shared-docs/CODING-RULES.md` - Coding-Richtlinien
- `apps/ui/src/components/views/online-sync-view.tsx` - Aktuelle (falsche) Implementation
- `apps/ui/src/components/views/board-view.tsx` - Ziel für neue Buttons

---

## 🚀 Nächster Schritt

Beginne mit **Phase 6.1**: Entfernen der alten `ProjectSyncButtons` aus `online-sync-view.tsx`

```
Referenziere: docs/pg-online-sync/tasks/phase-6.1-remove-old-buttons.md
```
