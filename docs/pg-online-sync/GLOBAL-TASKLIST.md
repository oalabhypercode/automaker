# 🌐 GLOBAL-TASKLIST: Automaker → Postgres Online-Sync

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Stand:** 2026-01-09
> **Status:** ✅ Phase 6 ABGESCHLOSSEN - Sync-Buttons im Kanban-Board

---

## 📋 Referenz-Dateien (für jeden neuen Chat)

Bei jedem neuen Chat diese 3 Dateien mitgeben:

1. `temp-pg-online-supabase.md` - Original-Anforderungen
2. `docs/pg-online-sync/GLOBAL-TASKLIST.md` - Diese Datei (aktueller Stand)
3. Die aktuelle Phase-Datei (z.B. `phase-0.1-architektur-entscheidung.md`)

---

## 🎯 Projektziel

Das bestehende **Offline-First Kanban-System** erweitern um:

- Zentrale Postgres-DB (Supabase/Coolify) als gemeinsamer Datenaustausch
- 3 Board-Ansichten: Lokal, Intern-Online, Kunden-Public
- Push/Pull Sync-Mechanismus
- Minimale Merge-Konflikte zum Public Automaker Repo

---

## 🏗️ Architektur-Übersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTOMAKER (Fork)                            │
├─────────────────────────────────────────────────────────────────┤
│  apps/ui          │  apps/server        │  libs/*               │
│  (Electron/Web)   │  (Express/WS)       │  (Shared Packages)    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  libs/pg-sync/ (NEU - Erweiterung ohne Änderung)        │   │
│  │  ├── types/        # Postgres-spezifische Types         │   │
│  │  ├── finders/      # DB-Queries                         │   │
│  │  ├── actions/      # DB-Mutations                       │   │
│  │  ├── sync/         # Push/Pull Engine                   │   │
│  │  └── hooks/        # Integration-Hooks                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Push/Pull
                              ▼
                    ┌─────────────────────┐
                    │   POSTGRES (Supabase)│
                    │   Zentrale Datenbank │
                    └─────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌───────────┐   ┌───────────┐   ┌───────────┐
       │  Intern   │   │  Kunden   │   │  Kunden   │
       │  Web-UI   │   │  Board A  │   │  Board B  │
       └───────────┘   └───────────┘   └───────────┘
```

---

## 📊 Phasen-Übersicht

### Phase 0: Architektur & Setup (Vorbereitung) ✅ ABGESCHLOSSEN

| #   | Planung                   | Status           | Datei                                         |
| --- | ------------------------- | ---------------- | --------------------------------------------- |
| 0.1 | Architektur-Entscheidung  | ✅ Implementiert | `tasks/phase-0.1-architektur-entscheidung.md` |
| 0.2 | Postgres/Drizzle Setup    | ✅ Implementiert | `tasks/phase-0.2-postgres-setup.md`           |
| 0.3 | Erweiterungsstrategie     | ✅ Implementiert | `tasks/phase-0.3-erweiterungsstrategie.md`    |
| 0.4 | Shared Types & Interfaces | ✅ Implementiert | `tasks/phase-0.4-shared-types.md`             |

### Phase 1: Zentrale Datenbasis + Sync ✅ ABGESCHLOSSEN

| #   | Planung                       | Status           | Datei                                 |
| --- | ----------------------------- | ---------------- | ------------------------------------- |
| 1.1 | Datenmodell Design            | ✅ Implementiert | `tasks/phase-1.1-datenmodell.md`      |
| 1.2 | Finder & Actions für Postgres | ✅ Implementiert | `tasks/phase-1.2-finder-actions.md`   |
| 1.3 | Push-Mechanismus              | ✅ Implementiert | `tasks/phase-1.3-push-mechanismus.md` |
| 1.4 | Pull-Mechanismus              | ✅ Implementiert | `tasks/phase-1.4-pull-mechanismus.md` |
| 1.5 | Auto-Sync & Konfiguration     | ✅ Implementiert | `tasks/phase-1.5-auto-sync.md`        |

### Phase 2: Interne Web-UI ✅ ABGESCHLOSSEN

| #   | Planung                       | Status                          | Datei                             |
| --- | ----------------------------- | ------------------------------- | --------------------------------- |
| 2.1 | Online Ticket-Erstellung      | ✅ Implementiert                | `phase-2.1-ticket-creation.md`    |
| 2.2 | Claim/Lock-Mechanismus        | ✅ Implementiert                | `phase-2.2-claim-lock.md`         |
| 2.3 | Projekt-Dropdown & Navigation | ✅ Implementiert                | `phase-2.3-projekt-navigation.md` |
| 2.4 | Status-Updates & Real-time    | ⏭️ ÜBERSPRUNGEN (kein Supabase) | `phase-2.4-realtime-updates.md`   |
| 2.5 | Dependency-Graph Ansicht      | ✅ Implementiert                | `phase-2.5-dependency-graph.md`   |

### Phase 3: Kunden-Board ✅ ABGESCHLOSSEN

| #   | Planung                                | Status           | Datei                             |
| --- | -------------------------------------- | ---------------- | --------------------------------- |
| 3.1 | Öffentliche Projekt-URLs               | ✅ Implementiert | `phase-3.1-projekt-urls.md`       |
| 3.2 | Kunden-Auth (Passwort)                 | ✅ Implementiert | `phase-3.2-kunden-auth.md`        |
| 3.3 | Abgespeckte Kanban-UI                  | ✅ Implementiert | `phase-3.3-kunden-kanban.md`      |
| 3.4 | Kunden-Ticket-Eingang                  | ✅ Implementiert | `phase-3.4-kunden-tickets.md`     |
| 3.5 | Kunden-Permissions & Views             | ✅ Implementiert | `phase-3.5-kunden-permissions.md` |
| 3.6 | Kunden-Bild-Uploads (Supabase Storage) | ✅ Implementiert | `phase-3.6-kunden-attachments.md` |

### Phase 4: 🚨 Sync-Integration (KRITISCH - Fehlende Teile) 🟡 IN ARBEIT

> **⚠️ PROBLEM:** Phase 1.3/1.4 wurden als "implementiert" markiert, aber nur Library-Code existiert!
> Die tatsächliche Server-Integration und UI fehlen komplett.

| #   | Planung                           | Status           | Datei                                  |
| --- | --------------------------------- | ---------------- | -------------------------------------- |
| 4.1 | Pull Server-Route                 | ✅ Implementiert | `tasks/phase-4.1-pull-server-route.md` |
| 4.2 | Pull UI-Button (Sync from Remote) | ✅ Implementiert | `tasks/phase-4.2-pull-ui-button.md`    |
| 4.3 | Push Button Enhancement           | ✅ Implementiert | `tasks/phase-4.3-push-button.md`       |
| 4.4 | Local Feature Integration         | ✅ Implementiert | `tasks/phase-4.4-local-integration.md` |

**Was fehlt konkret:**

```
✅ Server-Route: /api/pg-sync/pull              → Phase 4.1 (ERLEDIGT)
✅ UI: "Sync from Remote" Button                → Phase 4.2 (ERLEDIGT)
✅ UI: "Push to Remote" Button (Verbesserung)   → Phase 4.3 (ERLEDIGT)
✅ Integration: Postgres → .automaker/features/ → Phase 4.4 (ERLEDIGT)
```

**🎉 PHASE 4 KOMPLETT - Sync-Zyklus vollständig implementiert!**

### Phase 5: 🎨 Public Board UI/UX Redesign 🟡 IN PLANUNG

> **Problem:** Das Kunden-Dashboard sieht unprofessionell aus und hat mehrere UX-Probleme.
> **Ziel:** Premium-Look mit Glasmorphism, funktionierende Attachments, saubere Datenstruktur.

| #   | Planung               | Status           | Datei                                               |
| --- | --------------------- | ---------------- | --------------------------------------------------- |
| 5.0 | Übersicht & Analyse   | ✅ Erstellt      | `tasks/phase-5.0-public-board-redesign-overview.md` |
| 5.1 | Attachment URL Fix    | ✅ Implementiert | `tasks/phase-5.1-attachment-url-fix.md`             |
| 5.2 | Ticket Card Redesign  | ✅ Implementiert | `tasks/phase-5.2-ticket-card-redesign.md`           |
| 5.3 | Category System       | ✅ Implementiert | `tasks/phase-5.3-category-system.md`                |
| 5.4 | Ticket Detail Dialog  | ✅ Implementiert | `tasks/phase-5.4-ticket-detail-dialog.md`           |
| 5.5 | Board Column Redesign | ✅ Implementiert | `tasks/phase-5.5-board-column-redesign.md`          |

**Identifizierte Probleme (Screenshots):**

```
🔴 KRITISCH:
├── Attachments nicht sichtbar (Signed URL abgelaufen)
├── Markdown-Syntax in UI sichtbar (** 📄 Erstellt von:** etc.)
└── Keine strukturierte Kategorie/Creator-Anzeige

🟡 HOCH:
├── Kein Premium-Design (Basic Cards)
├── Keine Glasmorphism-Effekte
└── Langweiliger Ticket-Detail-Dialog

🟢 NIEDRIG:
├── Englisch/Deutsch Mix
└── Datum-Format könnte relativer sein
```

**Geschätzte Zeilen insgesamt: ~700-900**

---

## 🔄 Sync-Strategie (Kernkonzept)

### Push (Lokal → Postgres)

```
Trigger:
├── Ticket erstellt (lokal)
├── Status geändert (Todo → In Progress → Done)
├── Ticket claimed ("In Bearbeitung")
└── Ticket abgeschlossen

Ablauf:
1. Lokale Änderung → Event erstellen
2. Event in Outbox-Queue
3. Sync-Service pusht zur zentralen DB
4. Bestätigung → Event aus Queue entfernen
```

### Pull (Postgres → Lokal)

```
Trigger:
├── Manuell (Button)
├── Auto-Timer (z.B. stündlich)
└── App-Start

Ablauf:
1. lastSyncTimestamp senden
2. Alle Events seit Timestamp abrufen
3. Lokale DB aktualisieren
4. Konflikte auflösen (letzte Änderung gewinnt)
5. lastSyncTimestamp aktualisieren
```

---

## 🌐 URL-Struktur

### Intern (alle Projekte, Dropdown)

```
https://app.domain.com/board
→ Dropdown zeigt alle Projekte
→ Vollständige Kanban-Ansicht
→ Auth: Mitarbeiter-Login
```

### Kunden (pro Projekt, abgespeckt)

```
https://app.domain.com/p/{projectSlug}
→ Beispiel: /p/finance-dashboard
→ Vereinfachte Kanban-Ansicht
→ Auth: Projekt-Passwort
```

---

## 📁 Neue Ordner-Struktur (Erweiterung)

```
libs/
└── pg-sync/                    # NEUES PACKAGE
    ├── package.json
    ├── src/
    │   ├── index.ts
    │   ├── types/
    │   │   ├── project.types.ts
    │   │   ├── ticket.types.ts
    │   │   ├── user.types.ts
    │   │   └── sync.types.ts
    │   ├── db/
    │   │   ├── schema.ts       # Drizzle Schema
    │   │   └── client.ts       # Supabase Client
    │   ├── finders/
    │   │   ├── project-finder.ts
    │   │   ├── ticket-finder.ts
    │   │   └── sync-finder.ts
    │   ├── actions/
    │   │   ├── project-actions.ts
    │   │   ├── ticket-actions.ts
    │   │   └── sync-actions.ts
    │   ├── sync/
    │   │   ├── push-service.ts
    │   │   ├── pull-service.ts
    │   │   └── conflict-resolver.ts
    │   └── hooks/
    │       └── use-sync.ts
    └── tests/
```

---

## ⚠️ Wichtige Regeln

1. **Keine Änderungen am Kern-Automaker-Code** - Nur Erweiterungen
2. **Neue Funktionalität in neuen Dateien/Packages**
3. **Integration über Hooks/Events** - Nicht direkt in bestehenden Code
4. **Jede Datei max 700 Zeilen**
5. **Clean Code** - Aussagekräftige Namen für Finder/Actions

---

## 📝 Changelog

| Datum      | Phase | Änderung                                                                                                                                                                 |
| ---------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-01-06 | Setup | GLOBAL-TASKLIST.md erstellt                                                                                                                                              |
| 2026-01-06 | 0.1   | Architektur-Entscheidung Planung erstellt                                                                                                                                |
| 2026-01-06 | 0.2   | Postgres Setup Planung erstellt                                                                                                                                          |
| 2026-01-06 | 0.3   | Erweiterungsstrategie Planung erstellt                                                                                                                                   |
| 2026-01-06 | 0.4   | Shared Types Planung erstellt                                                                                                                                            |
| 2026-01-06 | 1.1   | Datenmodell Design Planung erstellt                                                                                                                                      |
| 2026-01-06 | 1.2   | Finder & Actions Planung erstellt                                                                                                                                        |
| 2026-01-06 | 1.3   | Push-Mechanismus Planung erstellt                                                                                                                                        |
| 2026-01-06 | 1.4   | Pull-Mechanismus Planung erstellt                                                                                                                                        |
| 2026-01-06 | 1.5   | Auto-Sync & Konfiguration Planung erstellt                                                                                                                               |
| 2026-01-06 | 2.1   | Online Ticket-Erstellung Planung erstellt                                                                                                                                |
| 2026-01-06 | 2.2   | Claim/Lock-Mechanismus Planung erstellt                                                                                                                                  |
| 2026-01-06 | 2.3   | Projekt-Navigation Planung erstellt                                                                                                                                      |
| 2026-01-06 | 2.4   | Realtime-Updates Planung erstellt                                                                                                                                        |
| 2026-01-06 | 2.5   | Dependency-Graph Planung erstellt                                                                                                                                        |
| 2026-01-06 | 3.1   | Öffentliche URLs Planung erstellt                                                                                                                                        |
| 2026-01-06 | 3.2   | Kunden-Auth Planung erstellt                                                                                                                                             |
| 2026-01-06 | 3.3   | Kunden-Kanban Planung erstellt                                                                                                                                           |
| 2026-01-06 | 3.4   | Kunden-Tickets Planung erstellt                                                                                                                                          |
| 2026-01-06 | 3.5   | Kunden-Permissions Planung erstellt                                                                                                                                      |
| 2026-01-07 | 0.1   | **IMPLEMENTIERT:** Architektur-Entscheidung                                                                                                                              |
| 2026-01-07 | 0.2   | **IMPLEMENTIERT:** libs/pg-sync Package mit Drizzle ORM                                                                                                                  |
| 2026-01-07 | 0.3   | **IMPLEMENTIERT:** Feature-Flags, Integration-Guide, Merge-Strategy                                                                                                      |
| 2026-01-07 | 0.4   | **IMPLEMENTIERT:** Alle Shared Types (~1.500 Zeilen)                                                                                                                     |
| 2026-01-07 | 1.1   | **IMPLEMENTIERT:** Drizzle Schema (~890 Zeilen)                                                                                                                          |
| 2026-01-07 | 1.2   | **IMPLEMENTIERT:** Finders & Actions (~2.700 Zeilen)                                                                                                                     |
| 2026-01-07 | 1.3   | **IMPLEMENTIERT:** Push-Mechanismus (~2.600 Zeilen)                                                                                                                      |
| 2026-01-07 | 1.4   | **IMPLEMENTIERT:** Pull-Mechanismus (~1.900 Zeilen)                                                                                                                      |
| 2026-01-07 | 1.5   | **IMPLEMENTIERT:** Auto-Sync & Konfiguration (~600 Zeilen)                                                                                                               |
| 2026-01-07 | 2.1   | **IMPLEMENTIERT:** Ticket Validierung, Hooks & Query Factories (~450 Zeilen)                                                                                             |
| 2026-01-07 | 2.2   | **IMPLEMENTIERT:** Optimistic Locking in claimTicket, Presence Types (~90 Zeilen)                                                                                        |
| 2026-01-07 | 2.3   | **IMPLEMENTIERT:** Project Hooks, Query Factories, Navigation-Ready (~320 Zeilen)                                                                                        |
| 2026-01-07 | 2.4   | **ÜBERSPRUNGEN:** Kein Supabase Realtime - nutzen Drizzle/postgres.js                                                                                                    |
| 2026-01-07 | 2.5   | **IMPLEMENTIERT:** Dependency Schema, Actions, Finders, Hooks (~750 Zeilen)                                                                                              |
| 2026-01-07 | 3.1   | **IMPLEMENTIERT:** Public URLs, Slugs, Customer Access Actions & Finders (~800 Zeilen)                                                                                   |
| 2026-01-07 | 3.2   | **IMPLEMENTIERT:** Customer Auth, Backend Routes, Login UI (~500 Zeilen)                                                                                                 |
| 2026-01-07 | 3.3   | **IMPLEMENTIERT:** Read-Only Kanban, Public Ticket Card, Detail Dialog (~400 Zeilen)                                                                                     |
| 2026-01-07 | 3.2   | **SECURITY:** JWT_SECRET Fail-Fast in Production, Rate-Limit TODO dokumentiert                                                                                           |
| 2026-01-07 | 3.4   | **IMPLEMENTIERT:** Kunden-Ticket-Eingang UI + API (~200 Zeilen)                                                                                                          |
| 2026-01-07 | 3.5   | **TEIL-IMPLEMENTIERT:** Public Settings (Schema/Actions/Finders), Enforcement, Public View (~200 Zeilen)                                                                 |
| 2026-01-07 | 3.6   | **IMPLEMENTIERT:** Supabase Storage Attachments (Schema, API, UI)                                                                                                        |
| 2026-01-09 | 4.0   | 🚨 **KRITISCH:** Phase 4 erstellt - Fehlende Sync-Integration identifiziert                                                                                              |
| 2026-01-09 | 4.1   | Planung erstellt: Pull Server-Route                                                                                                                                      |
| 2026-01-09 | 4.2   | Planung erstellt: Pull UI-Button (Sync from Remote)                                                                                                                      |
| 2026-01-09 | 4.3   | Planung erstellt: Push Button Enhancement                                                                                                                                |
| 2026-01-09 | 4.4   | Planung erstellt: Local Feature Integration                                                                                                                              |
| 2026-01-09 | 4.1   | **IMPLEMENTIERT:** Pull Server-Route (~280 Zeilen)                                                                                                                       |
| 2026-01-09 | 4.2   | **IMPLEMENTIERT:** Pull UI-Button (~230 Zeilen) - usePullFromRemote Hook + ProjectSyncButtons Component                                                                  |
| 2026-01-09 | 4.3   | **IMPLEMENTIERT:** Push Button Enhancement (~280 Zeilen) - push.ts Route + usePushToRemote Hook + Push Button                                                            |
| 2026-01-09 | 4.4   | **IMPLEMENTIERT:** Local Feature Integration (~450 Zeilen) - sync-id-mapper.ts + feature-writer.ts + pull.ts to-local Route + usePullToLocal Hook + Sync to Local Button |
| 2026-01-09 | 5.0   | 🎨 **PHASE 5 PLANUNG:** Public Board UI/UX Redesign - Übersicht erstellt                                                                                                 |
| 2026-01-09 | 5.1   | Planung erstellt: Attachment URL Fix                                                                                                                                     |
| 2026-01-09 | 5.2   | Planung erstellt: Ticket Card Redesign                                                                                                                                   |
| 2026-01-09 | 5.3   | Planung erstellt: Category System                                                                                                                                        |
| 2026-01-09 | 5.4   | Planung erstellt: Ticket Detail Dialog Redesign                                                                                                                          |
| 2026-01-09 | 5.5   | Planung erstellt: Board Column Redesign                                                                                                                                  |
| 2026-01-09 | 5.1   | **IMPLEMENTIERT:** Attachment URL Fix - TTL von 1h auf 1 Jahr erhöht (~1 Zeile)                                                                                          |
| 2026-01-09 | 5.3   | **IMPLEMENTIERT:** Category System - Server-Side Parsing für creatorName/category (~65 Zeilen)                                                                           |
| 2026-01-09 | 5.2   | **IMPLEMENTIERT:** Ticket Card Redesign - Glasmorphism Cards, Meta-Zeile, CategoryBadge, relative-time.ts (~330 Zeilen)                                                  |
| 2026-01-09 | 5.4   | **IMPLEMENTIERT:** Ticket Detail Dialog - Premium Glasmorphism, Status-Glow, Meta-Box, formatFullDate (~120 Zeilen)                                                      |
| 2026-01-09 | 5.5   | **IMPLEMENTIERT:** Board Column Redesign - Glasmorphism Columns, Status-Glow, EmptyState, Snap-Scrolling (~90 Zeilen)                                                    |
| 2026-01-09 | 6.0   | 🔴 **KRITISCH:** Phase 6 erstellt - Sync-Buttons an falscher Stelle identifiziert                                                                                        |
| 2026-01-09 | 6.0   | Planung erstellt: Übersicht & Problem-Analyse                                                                                                                            |
| 2026-01-09 | 6.1   | Planung erstellt: Sync-Buttons aus online-sync-view.tsx entfernen                                                                                                        |
| 2026-01-09 | 6.2   | Planung erstellt: Sync-Buttons in board-view.tsx integrieren                                                                                                             |
| 2026-01-09 | 6.3   | Planung erstellt: Vereinfachte Pull/Push Logik (2 Buttons)                                                                                                               |
| 2026-01-09 | 6.1   | **IMPLEMENTIERT:** ProjectSyncButtons aus online-sync-view.tsx entfernt (~208 Zeilen)                                                                                    |
| 2026-01-09 | 6.2   | **IMPLEMENTIERT:** DatabaseSyncButtons in board-view.tsx integriert (~195 Zeilen) - Neue Komponente + BoardHeader Props                                                  |
| 2026-01-09 | 6.3   | **IMPLEMENTIERT:** use-database-sync.ts Hook (~200 Zeilen) - Refactoring der Sync-Logik in dedizierten Hook, Komponente auf 133 Zeilen reduziert                         |

---

## 🚀 Nächste Schritte

1. ✅ GLOBAL-TASKLIST.md erstellen
2. ✅ Phase 0.1-0.4 Planungen erstellt (4 Dateien)
3. ✅ Phase 1.1-1.5 Planungen erstellt (5 Dateien)
4. ✅ Phase 2.1-2.5 Planungen erstellt (5 Dateien)
5. ✅ Phase 3.1-3.6 Planungen erstellt (6 Dateien)
6. ✅ Phase 0 KOMPLETT implementiert
7. ✅ Phase 1.1 (Datenmodell) implementiert
8. ✅ Phase 1.2 (Finder & Actions) implementiert
9. ⚠️ Phase 1.3 (Push-Mechanismus) - NUR LIBRARY-CODE, Server-Integration fehlt!
10. ⚠️ Phase 1.4 (Pull-Mechanismus) - NUR LIBRARY-CODE, Server-Integration fehlt!
11. ✅ Phase 1.5 (Auto-Sync & Konfiguration) implementiert
12. ✅ Phase 2.1-2.5 implementiert
13. ✅ Phase 3.1-3.6 implementiert (Kunden-Board)
14. ✅ **Phase 4.1 (Pull Server-Route) - IMPLEMENTIERT**
15. ✅ **Phase 4.2 (Pull UI-Button) - IMPLEMENTIERT**
16. ✅ **Phase 4.3 (Push Button Enhancement) - IMPLEMENTIERT**
17. ✅ **Phase 4.4 (Local Feature Integration) - IMPLEMENTIERT**

**🎉 Phase 0-4 ABGESCHLOSSEN - Der vollständige Sync-Zyklus ist implementiert!**

18. ✅ **Phase 5 (Public Board Redesign) - KOMPLETT IMPLEMENTIERT** (6 Dateien)
    - ✅ 5.0: Übersicht & Analyse
    - ✅ 5.1: Attachment URL Fix
    - ✅ 5.2: Ticket Card Redesign
    - ✅ 5.3: Category System
    - ✅ 5.4: Ticket Detail Dialog
    - ✅ 5.5: Board Column Redesign

**🎉 Phase 5 ABGESCHLOSSEN - Public Board hat jetzt Premium Glasmorphism-Design!**

### Phase 6: ✅ Sync-Button UX-Korrektur ABGESCHLOSSEN

> **🎉 GELÖST:** Die Sync-Buttons wurden erfolgreich korrigiert!
>
> - Buttons sind jetzt im Kanban-Board `/board` (board-header.tsx)
> - 2 klare Buttons: Pull und Push
> - Dedizierter Hook `use-database-sync.ts` für wiederverwendbare Sync-Logik

| #   | Planung                                         | Status           | Datei                                   |
| --- | ----------------------------------------------- | ---------------- | --------------------------------------- |
| 6.0 | Übersicht & Problem-Analyse                     | 📋 Erstellt      | `tasks/phase-6.0-sync-button-fix.md`    |
| 6.1 | Sync-Buttons aus online-sync-view.tsx entfernen | ✅ Implementiert | `tasks/phase-6.1-remove-old-buttons.md` |
| 6.2 | Sync-Buttons in board-view.tsx integrieren      | ✅ Implementiert | `tasks/phase-6.2-board-integration.md`  |
| 6.3 | Vereinfachte Pull/Push Logik (2 Buttons)        | ✅ Implementiert | `tasks/phase-6.3-simplified-sync.md`    |

**🎯 Ziel:** 2 klare Buttons im Kanban-Board (`/board`)

```
┌─────────────────────────────────────────────────────────┐
│  KANBAN BOARD (/board)                                   │
├─────────────────────────────────────────────────────────┤
│  [Pull from Database]  [Push to Database]               │
│                                                         │
│  ┌─────────┐  ┌─────────────┐  ┌────────┐  ┌─────────┐ │
│  │ BACKLOG │  │ IN PROGRESS │  │ REVIEW │  │  DONE   │ │
│  └─────────┘  └─────────────┘  └────────┘  └─────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Was die Buttons machen sollen:**

1. **Pull from Database** → Holt Tickets aus Postgres DB → Zeigt sie im Kanban-Board
2. **Push to Database** → Sendet lokale Tickets zur Postgres DB

---

## 📌 Anleitung für nächsten Chat

**🎉 Phase 0-6 VOLLSTÄNDIG ABGESCHLOSSEN!**

Das Postgres Online-Sync Feature ist komplett implementiert:

- ✅ Datenbank-Schema & Sync-Engine (Phase 0-1)
- ✅ Interne Web-UI (Phase 2)
- ✅ Kunden-Board mit Passwortschutz (Phase 3)
- ✅ Server-Routen & UI-Integration (Phase 4)
- ✅ Premium Glasmorphism-Design für Public Board (Phase 5)
- ✅ Sync-Buttons im Kanban-Board (Phase 6)

**Referenz-Dateien für Wartung/Erweiterung:**

1. `docs/pg-online-sync/GLOBAL-TASKLIST.md` - Diese Datei (Gesamtübersicht)
2. `apps/ui/src/hooks/use-database-sync.ts` - Sync-Hook
3. `apps/ui/src/components/views/board-view/database-sync-buttons.tsx` - Sync-Buttons
4. `libs/pg-sync/` - Postgres Sync Library

---

**📌 WICHTIG:** Diese Datei bei jedem neuen Chat mitgeben!
