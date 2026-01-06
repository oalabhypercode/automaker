# 🧭 Phase 2.3: Projekt-Navigation & Routing

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 1.2 (Finders), Phase 2.1 (Web-App Basis)
> **Geschätzte Komplexität:** Gering - Mittel

---

## 🎯 Ziel dieser Phase

Aufbau einer robusten Navigationsstruktur für die **Interne Web-UI**.
Zentrale Elemente sind der Projekt-Kontextwechsel über ein Dropdown und eine konsistente URL-Struktur.

Features:

- Globaler Project-Switcher (Dropdown)
- Routing basierend auf Projekt-Slugs
- Sidebar mit Projekt-spezifischen Links (Board, Backlog, Settings)
- Breadcrumb-Navigation

---

## ❓ Proaktive F&A

### Q1: Wie sieht die URL-Struktur aus?

✅ **Slug-basiert:**

- `/projects/` -> Liste aller Projekte
- `/projects/[slug]/board` -> Kanban Board
- `/projects/[slug]/list` -> Listenansicht
- `/projects/[slug]/settings` -> Einstellungen

### Q2: Was passiert beim Wechsel des Projekts?

✅ **Client-Side Transition:**
Der Project-Switcher navigiert zur selben Ansicht im neuen Projekt (z.B. von "Board A" zu "Board B").

### Q3: Wer sieht welche Projekte?

✅ **Member-Filter:**
Der Dropdown zeigt nur Projekte an, in denen der eingeloggte User Mitglied ist (via `project_members`).

---

## 🏛️ UI-Struktur

### Layout-Skizze

```
┌─────────────────┬───────────────────────────────────────────────────┐
│  LOGO           │  Project: [ Finance Dashboard ▼ ]   (User Avatar) │
├─────────────────┼───────────────────────────────────────────────────┤
│                 │  Home > Finance > Board                           │
│  📊 Board       │                                                   │
│  📝 Backlog     │  ┌──────────────────┐  ┌──────────────────┐       │
│  📅 Timeline    │  │  TODO            │  │  IN PROGRESS     │       │
│  👥 Team        │  │                  │  │                  │       │
│  ⚙️ Settings    │  │  [Ticket 1]      │  │  [Ticket 3]      │       │
│                 │  │                  │  │                  │       │
│                 │  └──────────────────┘  └──────────────────┘       │
│                 │                                                   │
└─────────────────┴───────────────────────────────────────────────────┘
```

---

## 💻 Implementation Details

### 1. Data Fetching: `useMyProjects`

Datei: `apps/web/src/hooks/use-projects.ts`

Greift auf `libs/pg-sync/src/finders/project-finder.ts` zu (via API Route oder Server Component).

```typescript
export function useMyProjects() {
  return useQuery({
    queryKey: ['my-projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects');
      return response.json();
    },
  });
}
```

### 2. Komponente: `ProjectSwitcher`

Datei: `apps/web/src/components/layout/project-switcher.tsx`

- Combobox / Dropdown mit Suchfunktion (bei vielen Projekten).
- Zeigt aktuelles Projekt an (aus URL-Parameter).
- Bei Auswahl: `router.push(/projects/${newSlug}/${currentView})`.

### 3. Komponente: `AppLayout`

Datei: `apps/web/src/components/layout/app-layout.tsx`

Hält den State der Sidebar (collapsed/expanded) und rendert die Navigation.

---

## 🧩 Modifizierte Dateien

### Neue Dateien (Web-UI)

| Datei                                                 | Zweck           | ~Zeilen |
| ----------------------------------------------------- | --------------- | ------- |
| `apps/web/src/components/layout/project-switcher.tsx` | Dropdown        | ~80     |
| `apps/web/src/components/layout/sidebar.tsx`          | Hauptnavigation | ~100    |
| `apps/web/src/components/layout/app-layout.tsx`       | Layout Wrapper  | ~60     |
| `apps/web/src/app/projects/[slug]/layout.tsx`         | Next.js Layout  | ~40     |

### Backend API (Server)

| Datei                                    | Zweck                     | ~Zeilen |
| ---------------------------------------- | ------------------------- | ------- |
| `apps/web/src/app/api/projects/route.ts` | Endpoint für Projektliste | ~30     |

---

## ✅ Abschlusskriterien

- [ ] Project-Switcher zeigt User-Projekte an
- [ ] Navigation via URL-Slug funktioniert (`/projects/[slug]`)
- [ ] Sidebar-Links ändern sich dynamisch je nach Projekt
- [ ] Aktives Projekt wird im Switcher korrekt hervorgehoben
- [ ] 404-Page wenn Projekt nicht existiert oder kein Zugriff
- [ ] Responsive Design (Mobile Navigation)

---

## 🔗 Referenzen

- `phase-1.2-finder-actions.md` (`getProjectsForUser` Finder)
- `phase-2.1-ticket-creation.md` (Integrations-Kontext)
