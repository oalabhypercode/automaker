# Phase 6.3: Vereinfachte Pull/Push Logik (2 Buttons)

ULTRATHINK

> **Status:** ✅ Implementiert
> **Priorität:** 🔴 KRITISCH
> **Abhängigkeit:** Phase 6.2
> **Geschätzt:** ~250 neue Zeilen
> **Tatsächlich:** ~200 Zeilen (Hook ~200, Komponente reduziert von 213 auf 133)

---

## 🎯 Ziel

Vereinfache die Sync-Logik auf **2 klare Operationen**:

1. **Pull from Database** = Kompletter Prozess in einem Klick
2. **Push to Database** = Kompletter Prozess in einem Klick

---

## 📋 Aufgaben

### 6.3.1 - Neuer Hook: useDatabaseSync

**Neue Datei:** `apps/ui/src/hooks/use-database-sync.ts`

**Zweck:** Vereinfachte Sync-Logik die beide Schritte kombiniert

**Interface:**

```typescript
interface UseDatabaseSyncResult {
  // Pull: Postgres → Lokale Features
  pullFromDatabase: () => Promise<PullResult>;
  isPulling: boolean;

  // Push: Lokale Features → Postgres
  pushToDatabase: () => Promise<PushResult>;
  isPushing: boolean;

  // Status
  isConnected: boolean;
  matchingProject: OnlineProject | null;
  lastSyncAt: string | null;
}

interface PullResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}

interface PushResult {
  success: boolean;
  ticketsCreated: number;
  ticketsUpdated: number;
  ticketsSkipped: number;
}
```

---

### 6.3.2 - Pull-Logik vereinfachen

**Aktuell (2 Schritte):**

```
1. usePullFromRemote() → Holt Tickets von Postgres in Cache
2. usePullToLocal()    → Schreibt Cache in .automaker/features/
```

**Neu (1 Schritt):**

```
1. pullFromDatabase() → Kombiniert beide Schritte automatisch
```

**Implementation:**

```typescript
const pullFromDatabase = async () => {
  if (!matchingProject || !projectPath) {
    toast.error('Kein passendes Projekt in der Datenbank gefunden');
    return { success: false, created: 0, updated: 0, skipped: 0, failed: 0 };
  }

  setIsPulling(true);
  try {
    // Step 1: Pull from remote (Postgres → Cache)
    const pullResult = await pullFromRemote.mutateAsync();

    if (!pullResult.success) {
      throw new Error('Pull von Remote fehlgeschlagen');
    }

    // Step 2: Pull to local (Cache → .automaker/features/)
    const localResult = await pullToLocal.mutateAsync({
      localProjectPath: projectPath,
      overwriteExisting: false,
    });

    if (localResult.success && localResult.data) {
      const { created, updated, skipped, failed } = localResult.data;

      // Informative Toast
      if (created > 0 || updated > 0) {
        toast.success(`${created + updated} Ticket(s) aus Datenbank geladen`);
      } else {
        toast.info('Keine neuen Tickets in der Datenbank');
      }

      // Features neu laden
      onFeaturesUpdated?.();

      return { success: true, created, updated, skipped, failed };
    }

    return { success: false, created: 0, updated: 0, skipped: 0, failed: 0 };
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Pull fehlgeschlagen');
    return { success: false, created: 0, updated: 0, skipped: 0, failed: 0 };
  } finally {
    setIsPulling(false);
  }
};
```

---

### 6.3.3 - Push-Logik verwenden

**Push ist bereits einfach (1 Schritt):**

```typescript
const pushToDatabase = async () => {
  if (!matchingProject || !projectPath) {
    toast.error('Kein passendes Projekt in der Datenbank gefunden');
    return { success: false, ticketsCreated: 0, ticketsUpdated: 0, ticketsSkipped: 0 };
  }

  setIsPushing(true);
  try {
    const result = await pushToRemote.mutateAsync({
      localProjectPath: projectPath,
      includeTickets: true,
      updateExisting: true, // ← Wichtig: Bestehende Tickets aktualisieren
    });

    if (result.success) {
      const { ticketsCreated, ticketsUpdated, ticketsSkipped } = result.data;

      // Informative Toast
      if (ticketsCreated > 0 || ticketsUpdated > 0) {
        toast.success(`${ticketsCreated + ticketsUpdated} Ticket(s) zur Datenbank gesendet`);
      } else {
        toast.info('Keine Änderungen zum Pushen');
      }

      return { success: true, ticketsCreated, ticketsUpdated, ticketsSkipped };
    }

    return { success: false, ticketsCreated: 0, ticketsUpdated: 0, ticketsSkipped: 0 };
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Push fehlgeschlagen');
    return { success: false, ticketsCreated: 0, ticketsUpdated: 0, ticketsSkipped: 0 };
  } finally {
    setIsPushing(false);
  }
};
```

---

### 6.3.4 - DatabaseSyncButtons aktualisieren

**Datei:** `apps/ui/src/components/views/board-view/database-sync-buttons.tsx`

**Nutze den neuen Hook:**

```typescript
import { useDatabaseSync } from '@/hooks/use-database-sync';

export function DatabaseSyncButtons({ projectPath, projectName, onFeaturesUpdated }) {
  const {
    pullFromDatabase,
    isPulling,
    pushToDatabase,
    isPushing,
    isConnected,
    matchingProject,
  } = useDatabaseSync({
    projectPath,
    projectName,
    onFeaturesUpdated,
  });

  return (
    <div className="flex items-center gap-2">
      {/* Pull Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={pullFromDatabase}
        disabled={isPulling || isPushing || !isConnected}
        className={cn(
          'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
          'hover:shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]',
          !isConnected && 'opacity-50'
        )}
      >
        {isPulling ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Pulling...
          </>
        ) : (
          <>
            <Download className="h-4 w-4 mr-2" />
            Pull from Database
          </>
        )}
      </Button>

      {/* Push Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={pushToDatabase}
        disabled={isPulling || isPushing || !isConnected}
        className={cn(
          'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20',
          'hover:shadow-[0_0_15px_-3px_rgba(16,185,129,0.5)]',
          !isConnected && 'opacity-50'
        )}
      >
        {isPushing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Pushing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Push to Database
          </>
        )}
      </Button>

      {/* Connection Status */}
      {!isConnected && (
        <Tooltip>
          <TooltipTrigger>
            <span className="text-xs text-amber-500">Nicht verbunden</span>
          </TooltipTrigger>
          <TooltipContent>
            Projekt ist nicht mit der Online-Datenbank verbunden.
            Gehe zu Online Sync um es zu importieren.
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
```

---

## 🔄 Sync-Workflow (Finale Version)

### Pull from Database (Kompletter Flow)

```
User klickt [Pull from Database]
         │
         ▼
┌──────────────────────────────┐
│ 1. Finde passendes Projekt   │
│    (by name/slug matching)   │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. API: /api/pg-sync/pull    │
│    Hole Tickets aus Postgres │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 3. API: /api/pg-sync/pull    │
│    /to-local Endpunkt        │
│    Konvertiere & schreibe    │
│    in .automaker/features/   │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 4. loadFeatures()            │
│    Aktualisiere UI           │
└──────────────────────────────┘
         │
         ▼
Toast: "X Ticket(s) aus Datenbank geladen"
```

### Push to Database (Kompletter Flow)

```
User klickt [Push to Database]
         │
         ▼
┌──────────────────────────────┐
│ 1. Finde passendes Projekt   │
│    (by name/slug matching)   │
└──────────────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ 2. API: /api/pg-sync/push    │
│    Lese .automaker/features/ │
│    Sende zu Postgres         │
└──────────────────────────────┘
         │
         ▼
Toast: "X Ticket(s) zur Datenbank gesendet"
```

---

## ✅ Checkliste

- [x] `use-database-sync.ts` Hook erstellt (~200 Zeilen)
- [x] Pull-Logik kombiniert beide Schritte automatisch
- [x] Push-Logik mit `updateExisting: true` für Updates
- [x] `database-sync-buttons.tsx` nutzt neuen Hook
- [x] Informative Toast-Nachrichten (Deutsch)
- [x] Loading States während Sync
- [x] `npx tsc --noEmit` läuft ohne neue Fehler
- [ ] E2E Test: Pull holt Kunden-Tickets ins Board (manuell)
- [ ] E2E Test: Push sendet lokale Tickets zur DB (manuell)

---

## ❓ Edge Cases

### Konflikt-Handling

```typescript
// Bei Pull: Lokale Änderungen nicht überschreiben wenn nicht explizit gewünscht
overwriteExisting: false; // Nur neue Tickets, keine Updates

// Bei Push: Postgres-Tickets aktualisieren
updateExisting: true; // Bestehende Tickets updaten
```

### Offline-Modus

```typescript
if (!navigator.onLine || !isConnected) {
  toast.warning('Offline - Sync nicht möglich');
  return;
}
```

### Kein passendes Projekt

```typescript
if (!matchingProject) {
  toast.info('Projekt nicht in Datenbank. Importiere es zuerst unter Online Sync.');
  return;
}
```

---

## 📚 Referenzen

- `apps/ui/src/hooks/use-online-projects.ts` - Basis-Hooks
- `apps/server/src/routes/pg-sync/pull.ts` - Pull API
- `apps/server/src/routes/pg-sync/push.ts` - Push API
- `docs/pg-online-sync/tasks/phase-6.0-sync-button-fix.md` - Übersicht

---

## 🎉 Abschluss

Nach Implementierung von Phase 6.3 ist die Sync-Button UX-Korrektur **KOMPLETT**.

**Ergebnis:**

- 2 klare Buttons im Kanban-Board
- Einfacher One-Click Workflow
- Keine verwirrenden Zwischenschritte
- Kein Wechsel zwischen Tabs nötig

**Aktualisiere:**

- `docs/pg-online-sync/GLOBAL-TASKLIST.md` - Phase 6 als ABGESCHLOSSEN markieren
