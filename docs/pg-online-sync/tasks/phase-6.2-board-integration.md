# Phase 6.2: Sync-Buttons in board-view.tsx integrieren

ULTRATHINK

> **Status:** ✅ Implementiert
> **Priorität:** 🔴 KRITISCH
> **Abhängigkeit:** Phase 6.1
> **Geschätzt:** ~150 neue Zeilen
> **Tatsächlich:** ~195 Zeilen

---

## 🎯 Ziel

Füge 2 klare Sync-Buttons zum Kanban-Board (`/board`) hinzu:

1. **Pull from Database** - Holt Tickets aus Postgres
2. **Push to Database** - Sendet lokale Tickets zur Postgres DB

---

## 📋 Aufgaben

### 6.2.1 - Neue Komponente erstellen: DatabaseSyncButtons

**Neue Datei:** `apps/ui/src/components/views/board-view/database-sync-buttons.tsx`

**Zweck:** Kompakte Sync-Buttons für das Board-Header

**Props:**

```typescript
interface DatabaseSyncButtonsProps {
  projectPath: string | null;
  projectName: string;
  onFeaturesUpdated: () => void; // Callback um Features neu zu laden
}
```

**Struktur (~100 Zeilen):**

```
DatabaseSyncButtons
├── Pull-Button (Download icon, blue)
│   └── Lädt Tickets aus Postgres → Lokale Features
├── Push-Button (Upload icon, emerald)
│   └── Sendet lokale Features → Postgres
└── Status-Indicator (optional)
    └── Zeigt an ob Online-Projekt verbunden ist
```

**Styling (Glasmorphism, kompakt):**

```css
/* Pull Button */
bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20
hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]

/* Push Button */
bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20
hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]
```

---

### 6.2.2 - Integration in BoardHeader

**Datei:** `apps/ui/src/components/views/board-view/board-header.tsx`

**Aktuelle Struktur:**

```
BoardHeader
├── Project Name
├── Concurrency Selector
├── Auto Mode Toggle
└── Add Feature Button
```

**Neue Struktur:**

```
BoardHeader
├── Project Name
├── Concurrency Selector
├── Auto Mode Toggle
├── DatabaseSyncButtons  ← NEU
└── Add Feature Button
```

**Position:** Zwischen Auto Mode Toggle und Add Feature Button

**Props erweitern:**

```typescript
interface BoardHeaderProps {
  // ... bestehende Props
  projectPath: string | null; // NEU
  projectName: string; // NEU (bereits vorhanden)
  onFeaturesUpdated: () => void; // NEU
}
```

---

### 6.2.3 - board-view.tsx anpassen

**Datei:** `apps/ui/src/components/views/board-view.tsx`

**Änderung in BoardHeader Aufruf (~Zeile 1077):**

```tsx
<BoardHeader
  projectName={currentProject.name}
  projectPath={currentProject.path} // NEU
  onFeaturesUpdated={loadFeatures} // NEU
  // ... bestehende Props
/>
```

---

## 🧩 Komponenten-Details

### DatabaseSyncButtons Komponente

```
┌───────────────────────────────────────────────────────┐
│  DatabaseSyncButtons                                   │
├───────────────────────────────────────────────────────┤
│                                                       │
│  Hooks verwendet:                                     │
│  ├── useOnlineProjects() - Findet passendes Projekt   │
│  ├── usePullToLocal() - Pull from Postgres to Local   │
│  └── usePushToRemote() - Push from Local to Postgres  │
│                                                       │
│  State:                                               │
│  ├── isPulling: boolean                               │
│  ├── isPushing: boolean                               │
│  └── matchingProject: OnlineProject | null            │
│                                                       │
│  Render:                                              │
│  ├── [Pull from Database] Button                      │
│  │   ├── Icon: Download (lucide-react)                │
│  │   ├── Loading: Loader2 spinning                    │
│  │   └── Disabled wenn: kein matchingProject          │
│  │                                                    │
│  └── [Push to Database] Button                        │
│      ├── Icon: Upload (lucide-react)                  │
│      ├── Loading: Loader2 spinning                    │
│      └── Disabled wenn: kein matchingProject          │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## ✅ Checkliste

- [x] `database-sync-buttons.tsx` erstellt (~195 Zeilen)
- [x] `board-header.tsx` erweitert mit neuen Props
- [x] `board-view.tsx` gibt neue Props an BoardHeader weiter
- [x] Styling: Glasmorphism, kompakt, responsive
- [x] `npx tsc --noEmit` läuft ohne Fehler (keine neuen Fehler)
- [x] Buttons erscheinen im Board-Header

---

## 🎨 UI/UX Design

### Desktop

```
┌──────────────────────────────────────────────────────────────┐
│ [Project Name]  │ [1▼] │ [Auto Mode] │ [↓ Pull] [↑ Push] │ [+ Add] │
└──────────────────────────────────────────────────────────────┘
```

### Mobile (responsive)

```
┌────────────────────────────────┐
│ [Project Name]                 │
├────────────────────────────────┤
│ [1▼] [Auto] [↓ Pull] [↑ Push] [+] │
└────────────────────────────────┘
```

### Button States

| State    | Pull Button                   | Push Button                   |
| -------- | ----------------------------- | ----------------------------- |
| Normal   | Blue outline, Download icon   | Emerald outline, Upload icon  |
| Hover    | Blue glow, filled background  | Emerald glow, filled bg       |
| Loading  | Spinner, "Pulling..."         | Spinner, "Pushing..."         |
| Disabled | Muted, "No project connected" | Muted, "No project connected" |
| Success  | Toast: "X tickets pulled"     | Toast: "X tickets pushed"     |
| Error    | Toast: Error message          | Toast: Error message          |

---

## ⚠️ Edge Cases

### Kein Online-Projekt gefunden

```typescript
if (!matchingProject) {
  // Buttons zeigen Tooltip: "Projekt nicht mit Datenbank verbunden"
  // Optional: Link zur /online-sync Seite anbieten
}
```

### Projekt-Matching Logik

```typescript
// Finde das passende Online-Projekt basierend auf Name oder Slug
const matchingProject = onlineProjects?.find(
  (p) =>
    p.name.toLowerCase() === projectName.toLowerCase() ||
    p.name.toLowerCase().replace(/\s+/g, '-') === projectName.toLowerCase().replace(/\s+/g, '-')
);
```

---

## 📚 Referenzen

- `apps/ui/src/components/views/board-view/board-header.tsx` - Ziel für Integration
- `apps/ui/src/hooks/use-online-projects.ts` - Hooks für Pull/Push
- `docs/pg-online-sync/tasks/phase-6.0-sync-button-fix.md` - Übersicht

---

## 🚀 Nächster Schritt

Nach Abschluss → **Phase 6.3**: Vereinfachte Pull/Push Logik

```
Referenziere: docs/pg-online-sync/tasks/phase-6.3-simplified-sync.md
```
