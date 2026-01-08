# Automaker Monorepo Guide

> **Zielgruppe:** Entwickler, die verstehen wollen wie Automaker aufgebaut ist

---

## Was ist ein Monorepo?

Ein **Monorepo** = **Ein** Repository mit **mehreren** Projekten drin.

```
automaker/                    <-- Das ist EINE Codebasis
├── apps/
│   ├── ui/                   <-- Frontend (React App)
│   └── server/               <-- Backend (Express API)
└── libs/
    ├── pg-sync/              <-- Datenbank-Bibliothek
    ├── types/                <-- Geteilte TypeScript-Typen
    └── ...                   <-- Weitere Helfer-Pakete
```

**Vorteil:** Alle Teile können sich Code teilen, ohne separate npm-Pakete zu veröffentlichen.

---

## Projekt-Struktur

| Ordner           | Typ     | Beschreibung                      |
| ---------------- | ------- | --------------------------------- |
| `apps/ui`        | App     | React Frontend mit Vite           |
| `apps/server`    | App     | Express Backend mit WebSocket     |
| `libs/pg-sync`   | Library | Datenbank-Schema und Sync-Logik   |
| `libs/types`     | Library | Geteilte TypeScript-Definitionen  |
| `libs/utils`     | Library | Logging, Fehlerbehandlung, Helfer |
| `libs/prompts`   | Library | AI Prompt-Templates               |
| `libs/platform`  | Library | Pfad-Management, Sicherheit       |
| `libs/git-utils` | Library | Git-Operationen                   |

---

## Development Commands

### Haupt-Commands

| Command                      | Was passiert?                           |
| ---------------------------- | --------------------------------------- |
| `npm run dev:web`            | Startet Frontend + Backend gleichzeitig |
| `npm run dev:electron`       | Startet als Desktop-App (wie VS Code)   |
| `npm run dev:electron:debug` | Desktop-App mit DevTools offen          |

### Was startet `npm run dev:web` genau?

```
┌─────────────────────────────────────────────────────────┐
│                    npm run dev:web                      │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          ▼                               ▼
   ┌─────────────┐                 ┌─────────────┐
   │  Frontend   │                 │   Backend   │
   │  (apps/ui)  │                 │(apps/server)│
   └─────────────┘                 └─────────────┘
   Port: 3007                      Port: 3008

   Techstack:                      Techstack:
   - React 19                      - Express 5
   - Vite (Dev Server)             - WebSocket
   - TanStack Router               - Claude Agent SDK
   - Tailwind CSS                  - node-pty (Terminal)
```

### Build Commands

| Command                  | Was passiert?                                        |
| ------------------------ | ---------------------------------------------------- |
| `npm run build`          | Baut die Web-Anwendung                               |
| `npm run build:packages` | Baut alle Libraries (muss vor anderen Builds laufen) |
| `npm run build:electron` | Baut Desktop-App für aktuelles OS                    |
| `npm run build:server`   | Baut nur den Server                                  |

### Test Commands

| Command                 | Was passiert?                    |
| ----------------------- | -------------------------------- |
| `npm run test`          | E2E Tests (Playwright, headless) |
| `npm run test:headed`   | E2E Tests mit sichtbarem Browser |
| `npm run test:server`   | Server Unit-Tests (Vitest)       |
| `npm run test:packages` | Tests für alle Libraries         |
| `npm run test:all`      | Alle Tests zusammen              |

### Code-Qualität

| Command                | Was passiert?                     |
| ---------------------- | --------------------------------- |
| `npm run lint`         | ESLint Prüfung                    |
| `npm run format`       | Prettier formatiert Code          |
| `npm run format:check` | Prüft Formatierung ohne zu ändern |

---

## Wie hängt alles zusammen?

```
Browser (localhost:3007)
    │
    │ HTTP/WebSocket
    ▼
┌─────────────────────────────┐
│  Frontend (apps/ui)         │  <-- React App
└─────────────────────────────┘
    │
    │ API Calls
    ▼
┌─────────────────────────────┐
│  Backend (apps/server)      │  <-- Express Server
│                             │
│  verwendet:                 │
│  └── @automaker/pg-sync     │  <-- Datenbank-Helfer
│  └── @automaker/types       │  <-- TypeScript-Typen
│  └── @automaker/utils       │  <-- Logging, Fehler, etc.
└─────────────────────────────┘
    │
    │ SQL über DATABASE_URL
    ▼
┌─────────────────────────────┐
│  Supabase (PostgreSQL)      │  <-- Cloud-Datenbank
└─────────────────────────────┘
```

---

## Was ist pg-sync?

**pg-sync wird NICHT als Server gestartet** - es ist eine **Bibliothek** (Library).

```
pg-sync = Helfer-Code für Datenbankoperationen
```

- Der **Backend-Server** (`apps/server`) **importiert** pg-sync
- pg-sync selbst läuft nicht eigenständig
- Es stellt Funktionen bereit wie:
  - Datenbank-Schema (Tabellen-Definitionen)
  - Finder (Daten lesen)
  - Actions (Daten schreiben)
  - Sync-Logik (Push/Pull zur DB)

**Vereinfacht:**

```
Backend startet -> lädt pg-sync -> nutzt dessen Funktionen -> spricht mit Supabase
```

### pg-sync Struktur

```
libs/pg-sync/
├── src/
│   ├── db/
│   │   ├── schema/           <-- Drizzle Tabellen-Definitionen
│   │   │   ├── projects.ts
│   │   │   ├── tickets.ts
│   │   │   ├── users.ts
│   │   │   └── sync.ts
│   │   └── client.ts         <-- Datenbank-Verbindung
│   ├── finders/              <-- Lese-Operationen (SELECT)
│   ├── actions/              <-- Schreib-Operationen (INSERT/UPDATE)
│   └── sync/                 <-- Push/Pull Logik
└── drizzle.config.ts         <-- Drizzle-Kit Konfiguration
```

### pg-sync Commands

| Command                    | Was passiert?                                   |
| -------------------------- | ----------------------------------------------- |
| `npx drizzle-kit push`     | Schema zur Datenbank pushen (im pg-sync Ordner) |
| `npx drizzle-kit studio`   | Drizzle Studio öffnen (DB Browser)              |
| `npx drizzle-kit generate` | Migration-Dateien generieren                    |

---

## Apps vs Libraries

| Typ         | Beschreibung                         | Beispiel                     |
| ----------- | ------------------------------------ | ---------------------------- |
| **App**     | Läuft eigenständig, hat eigenen Port | `apps/ui`, `apps/server`     |
| **Library** | Wird importiert, läuft nicht alleine | `libs/pg-sync`, `libs/types` |

### Wichtig zu verstehen:

- `npm run dev:web` startet **nur Apps** (ui + server)
- **Libraries werden automatisch geladen** wenn Apps sie importieren
- Du musst Libraries nicht separat starten

---

## Package Dependencies

Libraries können nur von Paketen abhängen, die "über" ihnen sind:

```
@automaker/types (keine Dependencies)
    │
    ▼
@automaker/utils, @automaker/prompts, @automaker/platform
    │
    ▼
@automaker/git-utils
    │
    ▼
@automaker/server, @automaker/ui
```

---

## Schnellreferenz

| Begriff       | Bedeutung                                                       |
| ------------- | --------------------------------------------------------------- |
| **Monorepo**  | Mehrere Projekte in einem Git-Repo                              |
| **apps/**     | Ausführbare Anwendungen (Frontend, Backend)                     |
| **libs/**     | Geteilte Bibliotheken (werden importiert, laufen nicht alleine) |
| **pg-sync**   | Datenbank-Bibliothek - wird vom Backend genutzt                 |
| **dev:web**   | Startet Frontend (React) + Backend (Express) parallel           |
| **Workspace** | npm-Feature das Monorepos ermöglicht                            |
