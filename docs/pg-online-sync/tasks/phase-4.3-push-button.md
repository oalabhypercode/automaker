# Phase 4.3: Push Button Enhancement

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Phase:** 4.3 - Push Button Enhancement
> **Stand:** 2026-01-09
> **Status:** ✅ IMPLEMENTIERT
> **Abhängigkeit:** Phase 4.1, 4.2 (für konsistente UI)

---

## 🎯 Ziel der Phase

Den existierenden **"Import Local Projects"** Button verbessern und in einen klaren **"Push to Remote"** Button umwandeln, der pro Projekt funktioniert (nicht nur als Batch-Import).

**Problem:** Der aktuelle Button importiert alle lokalen Projekte auf einmal - es fehlt ein pro-Projekt Push-Button!

---

## 🖥️ Konkretes Beispiel

```
🖥️ Benutzer öffnet Online-Sync View (/online-sync)
📋 Sieht Projekt "Finance Dashboard" in der Liste
⬆️ Klickt auf "Push to Remote" Button
⏳ Loading-Spinner erscheint
✅ Toast: "3 lokale Tickets hochgeladen"
🌐 Public Board (/p/finance-dashboard) zeigt jetzt die neuen Tickets
```

---

## 🔗 Abhängigkeiten & Voraussetzungen

### Existierender Code

| Komponente           | Pfad                                                | Status       |
| -------------------- | --------------------------------------------------- | ------------ |
| Seed-Route           | `POST /api/pg-sync/projects/seed-local`             | ✅ Existiert |
| useSeedLocalProjects | `apps/ui/src/hooks/use-online-projects.ts`          | ✅ Existiert |
| Online-Sync-View     | `apps/ui/src/components/views/online-sync-view.tsx` | ✅ Existiert |

### Was angepasst werden muss

| Teil              | Beschreibung                                                       |
| ----------------- | ------------------------------------------------------------------ |
| Neue Server-Route | `POST /api/pg-sync/projects/:id/push` - Push für einzelnes Projekt |
| Neuer Hook        | `usePushToRemote(projectId)` - Push-Mutation                       |
| UI-Button         | "Push to Remote" Button pro Projekt                                |

---

## 🚀 Strategie

### Zwei Modi: Batch vs. Single

```
┌─────────────────────────────────────────────────┐
│  Aktuell (Batch-Import)                         │
│  ─────────────────────                          │
│  [Import All Local Projects]                    │
│  → Alle Projekte + alle Tickets auf einmal      │
└─────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────┐
│  Neu (Pro-Projekt Push)                         │
│  ─────────────────────                          │
│  ┌─────────────────────────────────────────┐   │
│  │ Finance Dashboard                       │   │
│  │ [🔄 Sync from Remote] [⬆️ Push to Remote]│   │
│  └─────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────┐   │
│  │ E-Commerce Site                         │   │
│  │ [🔄 Sync from Remote] [⬆️ Push to Remote]│   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## ❓ Edge Cases & Proaktive F&A

### ✅ Was passiert, wenn das Projekt noch nicht in Postgres existiert?

- Button heißt dann "Create & Push"
- Erstellt Projekt in Postgres und pusht Tickets

### ✅ Was passiert bei Duplikaten (Ticket existiert bereits)?

- Skip oder Update basierend auf `localId` Mapping
- Toast zeigt: "3 neu, 2 aktualisiert, 1 übersprungen"

### ✅ Was passiert bei sehr vielen lokalen Tickets?

- Progress-Bar zeigt Fortschritt
- Batch-Push (50 Tickets pro Request)

### ✅ Soll der Batch-Import-Button bleiben?

- Ja, für initiales Setup
- Versteckt wenn bereits Projekte existieren

---

## 📋 Implementierungs-Tasks

### Task 1: Push Server-Route (Single Project)

**Datei:** `apps/server/src/routes/pg-sync/push.ts` **~120 Zeilen**

**Endpoint:** `POST /api/pg-sync/projects/:id/push`

**Request-Body:**

```typescript
interface PushRequest {
  localProjectPath: string; // Pfad zum lokalen Projekt
  includeTickets?: boolean; // Default: true
  updateExisting?: boolean; // Existierende Tickets aktualisieren
}
```

**Response-Body:**

```typescript
interface PushResponse {
  success: boolean;
  data: {
    ticketsCreated: number;
    ticketsUpdated: number;
    ticketsSkipped: number;
  };
  error?: string;
}
```

---

### Task 2: usePushToRemote Hook

**Datei:** `apps/ui/src/hooks/use-online-projects.ts` **~60 Zeilen Erweiterung**

**API:**

```typescript
export function usePushToRemote(projectId: string);
```

**Funktionalität:**

- `mutateAsync({ localProjectPath })` - Push ausführen
- `isPending` - Loading-State
- `error` - Fehler-State
- Automatisches Cache-Invalidieren nach Erfolg

---

### Task 3: Push Button in ProjectCard

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx` **~50 Zeilen Erweiterung**

**Änderungen an ProjectCard:**

- Neuer "Push to Remote" Button neben "Sync from Remote"
- Loading-State mit Spinner
- Disabled wenn kein lokales Projekt zugeordnet

---

### Task 4: Route in Index einbinden

**Datei:** `apps/server/src/routes/pg-sync/index.ts` **~10 Zeilen**

**Änderungen:**

- Import der neuen Push-Route
- Router einbinden

---

## 🔧 Wiederverwendung

### Aus existierendem Code:

| Modul               | Funktion                | Verwendung            |
| ------------------- | ----------------------- | --------------------- |
| `pg-sync/index.ts`  | `seedLocalProject()`    | Logik für Ticket-Push |
| `ticket-actions.ts` | `createTicketAction()`  | Ticket erstellen      |
| `ticket-finder.ts`  | `findTicketByLocalId()` | Duplikat-Check        |

### Pattern kopieren von:

```typescript
// Analog zu handleSeedLocalProjects in online-sync-view.tsx
const handlePushToRemote = useCallback(async () => {
  const result = await pushToRemote.mutateAsync({
    localProjectPath: currentProject?.path,
  });
  toast.success(`${result.data.ticketsCreated} Tickets hochgeladen`);
}, [pushToRemote, currentProject]);
```

---

## 📊 Geschätzte Komplexität

| Task                         | Zeilen   | Komplexität |
| ---------------------------- | -------- | ----------- |
| Task 1: Push Server-Route    | ~120     | Mittel      |
| Task 2: usePushToRemote Hook | ~60      | Niedrig     |
| Task 3: Push Button UI       | ~50      | Niedrig     |
| Task 4: Route Integration    | ~10      | Niedrig     |
| **Gesamt**                   | **~240** | **Mittel**  |

---

## ✅ Akzeptanzkriterien

1. [x] "Push to Remote" Button erscheint pro Projekt
2. [x] Button zeigt Loading-State während Push
3. [x] Erfolgs-Toast mit Statistiken (created/updated/skipped)
4. [x] Fehler-Toast bei Problemen
5. [x] Duplikat-Handling funktioniert korrekt
6. [x] TypeScript-Check erfolgreich: `npx tsc --noEmit`

---

## 🎨 Design-Vorgaben

### Button-Styling (Liquid Glass):

```
- Background: bg-emerald-500/20
- Border: border border-emerald-500/30
- Hover: shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]
- Icon: Upload oder ArrowUpFromLine
- Text: "Push to Remote"
```

### Button-Anordnung:

```
┌─────────────────────────────────────────────────┐
│ Project Card                                    │
│                                                 │
│ ┌───────────────────┐  ┌───────────────────┐   │
│ │ 🔄 Sync from      │  │ ⬆️ Push to        │   │
│ │    Remote         │  │    Remote         │   │
│ │    (blau)         │  │    (grün)         │   │
│ └───────────────────┘  └───────────────────┘   │
│                                                 │
│ Last Push: 2026-01-09 14:30                    │
└─────────────────────────────────────────────────┘
```

---

## 📝 Notizen für Implementierung

- **WICHTIG:** Existierende `seedLocalProject()` Funktion wiederverwenden!
- Die Logik ist bereits da, nur das Routing/UI fehlt
- `localId` Mapping nutzen für Duplikat-Erkennung

---

## 🔗 Nächste Phase

Nach Abschluss dieser Phase → **Phase 4.4: Local Feature Integration**
