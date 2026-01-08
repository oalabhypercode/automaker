# 🌐 GLOBAL-TASKLIST: Automaker → Postgres Online-Sync

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Stand:** 2026-01-06
> **Status:** 🟡 In Planung

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

| Datum      | Phase | Änderung                                                                                                 |
| ---------- | ----- | -------------------------------------------------------------------------------------------------------- |
| 2026-01-06 | Setup | GLOBAL-TASKLIST.md erstellt                                                                              |
| 2026-01-06 | 0.1   | Architektur-Entscheidung Planung erstellt                                                                |
| 2026-01-06 | 0.2   | Postgres Setup Planung erstellt                                                                          |
| 2026-01-06 | 0.3   | Erweiterungsstrategie Planung erstellt                                                                   |
| 2026-01-06 | 0.4   | Shared Types Planung erstellt                                                                            |
| 2026-01-06 | 1.1   | Datenmodell Design Planung erstellt                                                                      |
| 2026-01-06 | 1.2   | Finder & Actions Planung erstellt                                                                        |
| 2026-01-06 | 1.3   | Push-Mechanismus Planung erstellt                                                                        |
| 2026-01-06 | 1.4   | Pull-Mechanismus Planung erstellt                                                                        |
| 2026-01-06 | 1.5   | Auto-Sync & Konfiguration Planung erstellt                                                               |
| 2026-01-06 | 2.1   | Online Ticket-Erstellung Planung erstellt                                                                |
| 2026-01-06 | 2.2   | Claim/Lock-Mechanismus Planung erstellt                                                                  |
| 2026-01-06 | 2.3   | Projekt-Navigation Planung erstellt                                                                      |
| 2026-01-06 | 2.4   | Realtime-Updates Planung erstellt                                                                        |
| 2026-01-06 | 2.5   | Dependency-Graph Planung erstellt                                                                        |
| 2026-01-06 | 3.1   | Öffentliche URLs Planung erstellt                                                                        |
| 2026-01-06 | 3.2   | Kunden-Auth Planung erstellt                                                                             |
| 2026-01-06 | 3.3   | Kunden-Kanban Planung erstellt                                                                           |
| 2026-01-06 | 3.4   | Kunden-Tickets Planung erstellt                                                                          |
| 2026-01-06 | 3.5   | Kunden-Permissions Planung erstellt                                                                      |
| 2026-01-07 | 0.1   | **IMPLEMENTIERT:** Architektur-Entscheidung                                                              |
| 2026-01-07 | 0.2   | **IMPLEMENTIERT:** libs/pg-sync Package mit Drizzle ORM                                                  |
| 2026-01-07 | 0.3   | **IMPLEMENTIERT:** Feature-Flags, Integration-Guide, Merge-Strategy                                      |
| 2026-01-07 | 0.4   | **IMPLEMENTIERT:** Alle Shared Types (~1.500 Zeilen)                                                     |
| 2026-01-07 | 1.1   | **IMPLEMENTIERT:** Drizzle Schema (~890 Zeilen)                                                          |
| 2026-01-07 | 1.2   | **IMPLEMENTIERT:** Finders & Actions (~2.700 Zeilen)                                                     |
| 2026-01-07 | 1.3   | **IMPLEMENTIERT:** Push-Mechanismus (~2.600 Zeilen)                                                      |
| 2026-01-07 | 1.4   | **IMPLEMENTIERT:** Pull-Mechanismus (~1.900 Zeilen)                                                      |
| 2026-01-07 | 1.5   | **IMPLEMENTIERT:** Auto-Sync & Konfiguration (~600 Zeilen)                                               |
| 2026-01-07 | 2.1   | **IMPLEMENTIERT:** Ticket Validierung, Hooks & Query Factories (~450 Zeilen)                             |
| 2026-01-07 | 2.2   | **IMPLEMENTIERT:** Optimistic Locking in claimTicket, Presence Types (~90 Zeilen)                        |
| 2026-01-07 | 2.3   | **IMPLEMENTIERT:** Project Hooks, Query Factories, Navigation-Ready (~320 Zeilen)                        |
| 2026-01-07 | 2.4   | **ÜBERSPRUNGEN:** Kein Supabase Realtime - nutzen Drizzle/postgres.js                                    |
| 2026-01-07 | 2.5   | **IMPLEMENTIERT:** Dependency Schema, Actions, Finders, Hooks (~750 Zeilen)                              |
| 2026-01-07 | 3.1   | **IMPLEMENTIERT:** Public URLs, Slugs, Customer Access Actions & Finders (~800 Zeilen)                   |
| 2026-01-07 | 3.2   | **IMPLEMENTIERT:** Customer Auth, Backend Routes, Login UI (~500 Zeilen)                                 |
| 2026-01-07 | 3.3   | **IMPLEMENTIERT:** Read-Only Kanban, Public Ticket Card, Detail Dialog (~400 Zeilen)                     |
| 2026-01-07 | 3.2   | **SECURITY:** JWT_SECRET Fail-Fast in Production, Rate-Limit TODO dokumentiert                           |
| 2026-01-07 | 3.4   | **IMPLEMENTIERT:** Kunden-Ticket-Eingang UI + API (~200 Zeilen)                                          |
| 2026-01-07 | 3.5   | **TEIL-IMPLEMENTIERT:** Public Settings (Schema/Actions/Finders), Enforcement, Public View (~200 Zeilen) |
| 2026-01-07 | 3.6   | **IMPLEMENTIERT:** Supabase Storage Attachments (Schema, API, UI)                                        |

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
9. ✅ Phase 1.3 (Push-Mechanismus) implementiert
10. ✅ Phase 1.4 (Pull-Mechanismus) implementiert
11. ✅ Phase 1.5 (Auto-Sync & Konfiguration) implementiert
12. ✅ Phase 2.1 (Online Ticket-Erstellung) implementiert
13. ✅ Phase 2.2 (Claim/Lock-Mechanismus) implementiert
14. ✅ Phase 2.3 (Projekt-Navigation) implementiert
15. ⏭️ Phase 2.4 (Status-Updates & Real-time) - ÜBERSPRUNGEN (kein Supabase)
16. ✅ **Phase 2.5 (Dependency-Graph Ansicht) implementiert**
17. ✅ **Phase 3.1 (Öffentliche Projekt-URLs) implementiert**
18. ✅ **Phase 3.2 (Kunden-Auth & Passwort-Schutz) implementiert** + Security-Fixes
19. ✅ **Phase 3.3 (Abgespeckte Kanban-UI) implementiert**
20. ✅ **Phase 3.4 (Kunden-Ticket-Eingang) implementiert**
21. ✅ **Phase 3.6 (Kunden-Bild-Uploads via Supabase Storage) implementiert**
22. 🟡 **Phase 3.5 (Kunden-Permissions & Views) Backend + Public View implementiert**
23. ⏳ **Phase 3.5 UI intern: Public Access Settings Panel + Projekt-Settings Integration**

---

## 📌 Anleitung für nächsten Chat (Phase 3.5 UI intern)

1. `docs/pg-online-sync/GLOBAL-TASKLIST.md`
2. `docs/pg-online-sync/TUTORIAL.md` (Setup-Anleitung + Q&A)
3. `docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md`
4. `temp-pg-online-supabase.md` (Original-Anforderungen)

**Prompt für nächsten Chat:**

```
ULTRATHINK

🟡 Phase 3.5 Backend + Public View ist umgesetzt.
Offen: internes Public-Access Settings UI (Panel + Integration in Projekt-Settings).
Halte dich strikt an die Planungs-Dateien.

Referenziere:
- docs/pg-online-sync/GLOBAL-TASKLIST.md
- docs/pg-online-sync/tasks/phase-3.5-kunden-permissions.md
- temp-pg-online-supabase.md

Vergiss nicht:
- Clean Code, DRY, SOLID, KISS
- npx tsc --noEmit für TypeScript-Check (in libs/pg-sync und apps/server)
```

---

**📌 WICHTIG:** Diese Datei bei jedem neuen Chat mitgeben!
