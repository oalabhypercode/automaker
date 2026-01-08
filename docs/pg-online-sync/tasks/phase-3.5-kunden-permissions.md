# 🛡️ Phase 3.5: Kunden-Permissions & Views

ULTRATHINK

> **Status:** ✅ Implementiert
> **Abhängigkeiten:** Phase 3.1 - 3.4
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Fein-granulare **Konfiguration der Kunden-Sichtbarkeit**.
Nicht jedes Projekt soll gleich offen sein. Wir brauchen Settings, um zu steuern, was Kunden sehen und tun dürfen.

Wichtige Aspekte:

- Projekt-Einstellungen UI (Intern)
- Permissions Flags (`allow_create`, `show_done_column` etc.)
- View-Logik im Backend (damit unsichtbare Dinge gar nicht erst geladen werden)

---

## ❓ Proaktive F&A

### Q1: Was sind typische Einstellungen?

- **Public Visibility:** Ein/Aus
- **Password Protection:** Ein/Aus
- **Allow Ticket Creation:** Dürfen Kunden Tickets schreiben?
- **Show Comments:** Sind Kommentare (die nicht intern markiert sind) sichtbar?

### Q2: Wo wird das konfiguriert?

✅ **Im Internen Board:**
Ein neuer Settings-Reiter "Kunden-Zugang" im Projekt-Dashboard.

---

## 🏛️ Architektur & Datenmodell

### `projects.settings.publicSettings` (JSONB)

Wir nutzen das bestehende JSONB Feld `projects.settings` und hängen dort `publicSettings` an.

```json
// projects.settings.publicSettings (JSONB)
{
  "theme": "dark",
  "allowTicketCreation": true,
  "showComments": false,
  "visibleStatuses": ["todo", "in_progress", "done"],
  "introMessage": "Willkommen im Roadmap Board!"
}
```

### Filtering Strategy

Die Finder-Funktionen (aus Phase 3.3) müssen dieses JSONB lesen und filtern.

```typescript
// Pseudocode
if (!settings.showComments) {
  // lade keine Kommentare
}
```

---

## 📋 Anforderungen

### Konfigurierbare Optionen

| Option                | Default                         | Beschreibung                     |
| --------------------- | ------------------------------- | -------------------------------- |
| `allowTicketCreation` | true                            | Button "Neues Ticket" anzeigen?  |
| `showComments`        | false                           | Öffentliche Kommentare anzeigen? |
| `visibleStatuses`     | ['todo', 'in_progress', 'done'] | Welche Spalten werden gezeigt?   |
| `introMessage`        | -                               | Willkommensnachricht (optional)  |
| `theme`               | 'dark'                          | Theme für das Kunden-Board       |

Hinweis: Public-Board Aktivierung läuft über `projects.customerAccessEnabled` (Phase 3.1).

### Settings UI (Intern)

- Toggle Switches für die Optionen.
- Textfeld für "Willkommensnachricht".
- Passwort-Reset Button.
- Link zum Board (Copy to Clipboard).

---

## 💻 Implementation Details

### 1. DB Schema Update

Datei: `libs/pg-sync/src/db/schema/projects.ts`

```typescript
export interface PublicBoardSettings {
  allowTicketCreation: boolean;
  showComments: boolean;
  visibleStatuses: string[];
  introMessage?: string;
  theme: 'dark' | 'light';
}

export interface ProjectSettingsJson {
  // ...
  publicSettings?: PublicBoardSettings;
}
```

### 2. Action: `updateProjectPublicSettings`

Datei: `libs/pg-sync/src/actions/project-actions.ts`
Implementiert `PATCH` Logic für das JSON.

### 3. Public Board View

Datei: `apps/ui/src/components/public-board/public-board-view.tsx`
Spalten/Intro-Text reagieren auf `publicSettings` (visibleStatuses, introMessage).

### 4. Enforcement in Views

Backend-Route respektiert `allowTicketCreation` + `visibleStatuses` (Phase 3.5).

---

## 🧩 Modifizierte Dateien

### Neue Dateien

Keine neuen Dateien.

### Updates

| Datei                                                       | Zweck                                 | ~Zeilen |
| ----------------------------------------------------------- | ------------------------------------- | ------- |
| `libs/pg-sync/src/db/schema/projects.ts`                    | PublicBoardSettings + Defaults        | +30     |
| `libs/pg-sync/src/actions/project-actions.ts`               | update/get Public Settings            | +90     |
| `libs/pg-sync/src/finders/project-finder.ts`                | publicSettings im PublicProjectData   | +40     |
| `libs/pg-sync/src/finders/ticket-finder.ts`                 | visibleStatuses Filter                | +15     |
| `apps/server/src/routes/public-projects/index.ts`           | allowTicketCreation + visibleStatuses | +5      |
| `apps/ui/src/components/public-board/public-board-view.tsx` | Visible Columns + Intro Message       | +30     |
| `apps/ui/src/hooks/use-public-project.ts`                   | publicSettings Typen                  | +10     |
| `libs/pg-sync/src/index.ts`                                 | Exports (Settings + Finder Types)     | +5      |

---

## ✅ Abschlusskriterien

- [x] Projekt-Settings haben einen "Public Access" Tab. (UI unter /online-sync)
- [x] Einstellungen werden in DB gespeichert (JSONB).
- [x] Änderungen wirken sich sofort auf das Public Board aus (visibleStatuses + Intro).
- [x] Sicherheit: Backend validiert Permissions (Ticket-Create gesperrt, wenn disabled).

---

## 🚀 Implementierungsstand (2026-01-08)

### ✅ Backend + Public View

| Komponente | Datei                                                       | Beschreibung                               |
| ---------- | ----------------------------------------------------------- | ------------------------------------------ |
| Schema     | `libs/pg-sync/src/db/schema/projects.ts`                    | PublicBoardSettings + Defaults in settings |
| Actions    | `libs/pg-sync/src/actions/project-actions.ts`               | update/get Public Settings                 |
| Finder     | `libs/pg-sync/src/finders/project-finder.ts`                | publicSettings an PublicProjectData        |
| Finder     | `libs/pg-sync/src/finders/ticket-finder.ts`                 | visibleStatuses Filter für Public Tickets  |
| API        | `apps/server/src/routes/public-projects/index.ts`           | allowTicketCreation + visibleStatuses      |
| UI         | `apps/ui/src/components/public-board/public-board-view.tsx` | Sichtbarkeit + Intro Message               |

### ✅ Internes UI (2026-01-08)

| Komponente | Datei                                                           | Beschreibung                               |
| ---------- | --------------------------------------------------------------- | ------------------------------------------ |
| Server API | `apps/server/src/routes/pg-sync/index.ts`                       | Interne CRUD-Endpoints für Public Settings |
| UI Hooks   | `apps/ui/src/hooks/use-online-projects.ts`                      | React Query Hooks für Settings-Verwaltung  |
| UI Route   | `apps/ui/src/routes/online-sync.tsx`                            | Route für /online-sync                     |
| UI View    | `apps/ui/src/components/views/online-sync-view.tsx`             | Settings-Panel mit allen Optionen          |
| Navigation | `apps/ui/src/components/layout/sidebar/hooks/use-navigation.ts` | "Online" Section mit Globe Icon            |

---

## 🔗 Referenzen

- `phase-3.x` alle vorigen
