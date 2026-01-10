# 🗑️ Phase 7: Multi-Select Delete mit Datenbank-Sync + Status-Synchronisation

ULTRATHINK

> **Phase:** 7.0
> **Status:** ✅ VOLLSTÄNDIG IMPLEMENTIERT
> **Datum:** 2026-01-10
> **Implementierte Zeilen:** ~680 Zeilen (alle Sub-Phasen)

---

## 🎯 Ziel der Phase

Erweiterung des Kanban-Boards um:

1. **🗑️ Multi-Select Delete mit DB-Sync** - Synced Features können per Trash-Icon gelöscht werden, wobei sie auch aus der Postgres-Datenbank entfernt werden
2. **🔄 Status-Synchronisation** - Bei Status-Änderungen (z.B. auf "In Progress") wird der Status auch in der Datenbank aktualisiert

---

## 🔍 Ist-Analyse

### Bestehende Komponenten

| Komponente             | Datei                                                                         | Funktion                                     |
| ---------------------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| `SelectionActionBar`   | `apps/ui/src/components/views/board-view/components/selection-action-bar.tsx` | Zeigt Edit/Clear Buttons (~79 Zeilen)        |
| `ticket-actions.ts`    | `libs/pg-sync/src/actions/ticket-actions.ts`                                  | `deleteTicket()` = Soft-Delete (~613 Zeilen) |
| `push.ts`              | `apps/server/src/routes/pg-sync/push.ts`                                      | Push-Route für Ticket-Sync (~278 Zeilen)     |
| `use-database-sync.ts` | `apps/ui/src/hooks/use-database-sync.ts`                                      | Pull/Push Hooks (~236 Zeilen)                |

### Feature-Metadaten für Sync

```typescript
// libs/types/src/feature.ts
interface Feature {
  id: string;
  // ... andere Felder

  // Sync-Metadaten für Postgres Online-Sync
  remoteId?: string; // Postgres Ticket-ID
  syncedAt?: string; // Letzter Sync-Zeitpunkt (ISO String)
  syncSource?: 'local' | 'remote'; // Woher das Feature ursprünglich kommt
}
```

### Aktueller Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  MULTI-SELECT (aktuell)                                         │
├─────────────────────────────────────────────────────────────────┤
│  [Checkbox] [Checkbox] [Checkbox]                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ 3 features selected  │  [Edit Selected]  [Select All]     │ │
│  │                      │                   [Clear]          │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ❌ FEHLT: Trash-Button für Löschen                             │
│  ❌ FEHLT: Status-Sync bei Bulk-Update                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Soll-Zustand

### Multi-Select Delete

```
┌───────────────────────────────────────────────────────────────────┐
│  3 features selected  │  [🗑️] [✏️ Edit]  [Select All]  [Clear]   │
└───────────────────────────────────────────────────────────────────┘
                          ↓
                ┌─────────────────────────────┐
                │ 🗑️ Delete Confirmation      │
                │                             │
                │ 3 Features werden gelöscht: │
                │ - Feature A (lokal)         │
                │ - Feature B (synced) ⚠️     │
                │ - Feature C (synced) ⚠️     │
                │                             │
                │ ⚠️ 2 synced Features werden │
                │ auch aus der Datenbank      │
                │ entfernt!                   │
                │                             │
                │ [Abbrechen]    [🗑️ Löschen] │
                └─────────────────────────────┘
```

### Status-Sync bei Bulk-Update

```
Bulk-Update Flow:
1. User wählt Features aus
2. Klickt "Edit Selected"
3. Ändert Status auf "In Progress"
4. Klickt "Apply"
5. ✅ Lokale Features werden aktualisiert
6. ✅ Synced Features werden AUCH in der DB aktualisiert
```

---

## 📋 Phasen-Übersicht

| Phase      | Beschreibung                             | Geschätzte Zeilen |
| ---------- | ---------------------------------------- | ----------------- |
| 7.1        | Server-Route für Batch-Delete            | ~80 Zeilen        |
| 7.2        | Server-Route für Status-Update           | ~80 Zeilen        |
| 7.3        | UI Hook für Delete/Status-Sync           | ~120 Zeilen       |
| 7.4        | SelectionActionBar + Delete-Confirmation | ~150 Zeilen       |
| 7.5        | Integration in board-view.tsx            | ~80 Zeilen        |
| **Gesamt** |                                          | **~510 Zeilen**   |

---

## 🔧 Phase 7.1: Server-Route für Batch-Delete ✅ IMPLEMENTIERT

**Datei:** `apps/server/src/routes/pg-sync/delete.ts` (NEU)

### API-Spezifikation

```
POST /api/pg-sync/projects/:id/tickets/batch-delete

Request Body:
{
  ticketIds: string[];    // Postgres Ticket-IDs (remoteId der Features)
}

Response:
{
  success: boolean;
  data: {
    deletedCount: number;
    notFoundIds: string[];
    failedIds: string[];
  };
}
```

### Implementierte Dateien

1. **`libs/pg-sync/src/actions/ticket-actions.ts`** - `deleteMultipleTickets()` Action (~70 Zeilen)
   - Batch soft-delete mit `inArray` für effiziente DB-Operation
   - Gibt detailliertes Ergebnis mit deletedCount, notFoundIds, failedIds zurück

2. **`apps/server/src/routes/pg-sync/delete.ts`** - Route (~90 Zeilen)
   - POST `/projects/:id/tickets/batch-delete`
   - Validiert Project-Existenz
   - Filtert ungültige IDs

3. **`apps/server/src/routes/pg-sync/index.ts`** - Route-Registrierung
   - Import und Registrierung der createDeleteRoutes()

---

## 🔧 Phase 7.2: Server-Route für Status-Update ✅ IMPLEMENTIERT

**Datei:** `apps/server/src/routes/pg-sync/status.ts` (NEU)

### API-Spezifikation

```
POST /api/pg-sync/projects/:id/tickets/batch-status

Request Body:
{
  updates: Array<{
    ticketId: string;       // Postgres Ticket-ID
    status: string;         // Neuer Status
    localId?: string;       // Optional: Local Feature-ID
  }>;
}

Response:
{
  success: boolean;
  data: {
    updatedCount: number;
    failedIds: string[];
  };
}
```

### Implementierte Dateien

1. **`libs/pg-sync/src/actions/ticket-actions.ts`** - `updateMultipleTicketsStatus()` Action (~70 Zeilen)
   - Batch status update mit Status-Gruppierung für effiziente DB-Operationen
   - Event-Erstellung für Audit-Trail
   - Gibt detailliertes Ergebnis mit updatedCount, failedIds zurück

2. **`apps/server/src/routes/pg-sync/status.ts`** - Route (~140 Zeilen)
   - POST `/projects/:id/tickets/batch-status`
   - Validiert Project-Existenz
   - Status-Mapping von Local → Remote Format

3. **`apps/server/src/routes/pg-sync/index.ts`** - Route-Registrierung
   - Import und Registrierung der createStatusRoutes()

### Status-Mapping (Local → Remote)

```typescript
const STATUS_MAP = {
  backlog: 'backlog',
  todo: 'todo',
  'in-progress': 'in_progress',
  in_progress: 'in_progress',
  review: 'review',
  waiting_approval: 'review',
  verified: 'done',
  done: 'done',
  completed: 'archived',
  archived: 'archived',
};
// Special handling: 'pipeline_*' → 'in_progress'
```

---

## 🔧 Phase 7.3: UI Hook für Delete/Status-Sync ✅ IMPLEMENTIERT

**Datei:** `apps/ui/src/hooks/use-synced-operations.ts` (NEU)

### Hook API

```typescript
interface UseSyncedOperationsOptions {
  projectPath: string | null;
  projectName: string;
}

interface UseSyncedOperationsResult {
  // Delete synced features from DB
  deleteSyncedFeatures: (features: Feature[]) => Promise<DeleteResult>;
  isDeleting: boolean;

  // Update status in DB
  updateSyncedStatus: (features: Feature[], newStatus: string) => Promise<StatusUpdateResult>;
  isUpdatingStatus: boolean;

  // Connection info
  isConnected: boolean;
  isLoading: boolean;
  matchingProject: OnlineProject | null;

  // Helper: Filter synced features from a list
  filterSyncedFeatures: (features: Feature[]) => Feature[];
}
```

### Implementierte Features (~250 Zeilen)

1. **`filterSyncedFeatures()`** - Helper zum Filtern von Features mit `remoteId`
2. **`deleteSyncedFeatures()`** - Ruft `/api/pg-sync/projects/:id/tickets/batch-delete` auf
3. **`updateSyncedStatus()`** - Ruft `/api/pg-sync/projects/:id/tickets/batch-status` auf
4. **Connection-Detection** - Gleiche Logik wie `use-database-sync.ts` (matchingProject)
5. **Toast-Feedback** - Informative Meldungen für Delete, Silent für einzelne Status-Updates

### Logik

1. Filtert Features nach `remoteId` (nur synced Features)
2. Sammelt alle `remoteId`s
3. Ruft entsprechende API-Route auf
4. Gibt detailliertes Ergebnis zurück

---

## 🔧 Phase 7.4: SelectionActionBar + Delete-Confirmation ✅ IMPLEMENTIERT

**Dateien:**

- `apps/ui/src/components/views/board-view/components/selection-action-bar.tsx` (ERWEITERT ~127 Zeilen)
- `apps/ui/src/components/views/board-view/dialogs/delete-selected-dialog.tsx` (NEU ~113 Zeilen)

### Implementierte Props

```typescript
interface SelectionActionBarProps {
  // Existing
  selectedCount: number;
  totalCount: number;
  onEdit: () => void;
  onClear: () => void;
  onSelectAll: () => void;

  // NEU (optional für Rückwärtskompatibilität)
  onDelete?: () => void; // Öffnet Delete-Confirmation
  syncedCount?: number; // Anzahl synced Features in Auswahl
  isDeleting?: boolean; // Loading-State
}
```

### Implementierte Features

1. **SelectionActionBar Erweiterungen:**
   - Trash-Button mit Tooltip (zeigt synced-Count)
   - Cloud-Icon neben Auswahl-Counter für synced Features
   - Loading-State mit Spinner während Delete
   - Destructive Styling für Delete-Button

2. **DeleteSelectedDialog:**
   - Auflistung: lokale vs synced Features
   - Warning-Box bei synced Features
   - Loading-State während Delete
   - Cancel/Confirm Buttons

### UI-Struktur

```
┌─────────────────────────────────────────┐
│ 🗑️ Delete Features                      │
├─────────────────────────────────────────┤
│                                         │
│ Are you sure you want to delete         │
│ 5 features?                             │
│                                         │
│ 📦 3 local features                     │
│ ☁️ 2 synced features                    │
│                                         │
│ ⚠️ Database Warning                      │
│ The synced features will also be        │
│ removed from the Postgres database.     │
│                                         │
├─────────────────────────────────────────┤
│               [Cancel]  [🗑️ Delete 5]   │
└─────────────────────────────────────────┘
```

---

## 🔧 Phase 7.5: Integration in board-view.tsx ✅ IMPLEMENTIERT

**Datei:** `apps/ui/src/components/views/board-view.tsx` (ERWEITERT)

### Implementierte Änderungen

1. ✅ **Import `useSyncedOperations` Hook** (Zeile 63)

   ```typescript
   import { useSyncedOperations } from '@/hooks/use-synced-operations';
   ```

2. ✅ **Import `DeleteSelectedDialog`** (Zeile 62)

   ```typescript
   import { MassEditDialog, DeleteSelectedDialog } from './board-view/dialogs';
   ```

3. ✅ **State für Delete-Dialog** (Zeile 173)

   ```typescript
   const [showDeleteDialog, setShowDeleteDialog] = useState(false);
   ```

4. ✅ **Hook-Aufruf für `useSyncedOperations`** (Zeilen 176-185)

   ```typescript
   const {
     deleteSyncedFeatures,
     updateSyncedStatus,
     isDeleting: isSyncDeleting,
     filterSyncedFeatures,
     isConnected: isSyncConnected,
   } = useSyncedOperations({
     projectPath: currentProject?.path ?? null,
     projectName: currentProject?.name ?? '',
   });
   ```

5. ✅ **Synced Features Memo** (Zeilen 529-531)

   ```typescript
   const syncedSelectedFeatures = useMemo(() => {
     return filterSyncedFeatures(selectedFeatures);
   }, [selectedFeatures, filterSyncedFeatures]);
   ```

6. ✅ **Handler `handleBulkDelete`** (Zeilen 534-563)
   - Löscht synced Features zuerst aus Postgres (wenn verbunden)
   - Dann lokales Löschen aller Features
   - Toast-Feedback
   - Schließt Dialog und beendet Selection-Mode

7. ✅ **`handleBulkUpdate` für Status-Sync erweitert** (Zeilen 498-507)

   ```typescript
   // If status was updated, sync to Postgres for synced features
   if (updates.status && isSyncConnected) {
     const selectedFeaturesForSync = hookFeatures.filter((f) => selectedFeatureIds.has(f.id));
     const syncedFeatures = filterSyncedFeatures(selectedFeaturesForSync);
     if (syncedFeatures.length > 0) {
       // Fire and forget - status sync runs in background
       updateSyncedStatus(syncedFeatures, updates.status).catch((err) => {
         logger.error('Status sync failed:', err);
       });
     }
   }
   ```

8. ✅ **Props an `SelectionActionBar`** (Zeilen 1288-1297)

   ```typescript
   <SelectionActionBar
     selectedCount={selectedCount}
     totalCount={allSelectableFeatureIds.length}
     onEdit={() => setShowMassEditDialog(true)}
     onClear={clearSelection}
     onSelectAll={() => selectAll(allSelectableFeatureIds)}
     onDelete={() => setShowDeleteDialog(true)}
     syncedCount={syncedSelectedFeatures.length}
     isDeleting={isSyncDeleting}
   />
   ```

9. ✅ **`DeleteSelectedDialog` Komponente** (Zeilen 1310-1318)
   ```typescript
   <DeleteSelectedDialog
     open={showDeleteDialog}
     onOpenChange={setShowDeleteDialog}
     onConfirm={handleBulkDelete}
     selectedFeatures={selectedFeatures}
     syncedFeatures={syncedSelectedFeatures}
     isDeleting={isSyncDeleting}
   />
   ```

---

## ❓ Proaktive F&A

### Q1: Was passiert wenn ein Feature lokal gelöscht wird aber nicht synced ist?

✅ **A:** Das Feature wird nur lokal gelöscht. Kein API-Call zur DB.

### Q2: Was passiert bei Netzwerk-Fehler während Batch-Delete?

✅ **A:**

- Lokale Features werden trotzdem gelöscht
- Toast zeigt an: "3 Features gelöscht, 2 konnten nicht aus DB entfernt werden"
- Features können erneut gepusht werden um sie wieder zu synchronisieren

### Q3: Werden gelöschte Tickets wirklich gelöscht oder soft-deleted?

✅ **A:** Soft-Delete (setzen von `deletedAt`). Dies ermöglicht:

- Audit-Trail
- Versehentliches Löschen rückgängig machen (falls später gewünscht)
- Konsistenz mit bestehendem `deleteTicket()` Pattern

### Q4: Was passiert wenn Status nicht gemappt werden kann?

✅ **A:** Fallback auf `'backlog'`. Status-Mapping ist bereits in `push.ts` implementiert und wird wiederverwendet.

---

## ⚡ Performance-Optimierung

1. **Batch-Operationen:** Alle Tickets in einem API-Call, nicht einzeln
2. **Parallel Execution:** Lokales Löschen und DB-Löschen können parallel laufen
3. **Optimistic UI:** Lokale Änderungen sofort zeigen, DB-Sync im Hintergrund

---

## 🔄 Code-Wiederverwendung

| Bestehender Code                        | Wiederverwendung                    |
| --------------------------------------- | ----------------------------------- |
| `deleteTicket()` in `ticket-actions.ts` | Basis für `deleteMultipleTickets()` |
| `STATUS_MAP` in `push.ts`               | Für Status-Mapping wiederverwendbar |
| `useDatabaseSync` Hook                  | Pattern für neuen Hook              |
| `MassEditDialog`                        | Referenz für Delete-Dialog Design   |

---

## 📚 Betroffene Dokumentation

Nach Implementierung aktualisieren:

1. `docs/pg-online-sync/GLOBAL-TASKLIST.md` - Phase 7 hinzufügen
2. Diese Datei - Status auf ✅ Implementiert setzen

---

## ✅ Akzeptanzkriterien

- [x] Trash-Icon in SelectionActionBar sichtbar wenn Features ausgewählt
- [x] Delete-Confirmation Dialog zeigt Anzahl synced Features
- [x] **Phase 7.1:** Synced Features können aus Postgres DB gelöscht werden (batch-delete Route)
- [x] **Phase 7.2:** Status-Update Route implementiert (batch-status Route)
- [x] **Phase 7.3:** UI Hook für Delete/Status-Sync implementiert
- [x] **Phase 7.4:** SelectionActionBar + Delete-Dialog implementiert
- [x] **Phase 7.5:** Integration in board-view.tsx
- [x] Status-Update via Bulk-Edit synchronisiert auch zur DB
- [x] Toast-Nachrichten informieren über Sync-Status
- [x] Error-Handling bei Netzwerk-Fehlern

---

## 📌 Nächste Schritte

1. ~~**User-Feedback:** Plan durchlesen und Feedback geben~~
2. ~~**Phase 7.1:** Server-Route für Batch-Delete~~ ✅ ERLEDIGT
3. ~~**Phase 7.2:** Server-Route für Status-Update~~ ✅ ERLEDIGT
4. ~~**Phase 7.3:** UI Hook für Delete/Status-Sync~~ ✅ ERLEDIGT
5. ~~**Phase 7.4:** SelectionActionBar + Delete-Confirmation~~ ✅ ERLEDIGT
6. ~~**Phase 7.5:** Integration in board-view.tsx~~ ✅ ERLEDIGT

---

## 🎉 Phase 7 VOLLSTÄNDIG ABGESCHLOSSEN
