# Phase 4.2: Pull UI-Button (Sync from Remote)

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Phase:** 4.2 - Pull UI-Button
> **Stand:** 2026-01-09
> **Status:** ✅ IMPLEMENTIERT
> **Abhängigkeit:** Phase 4.1 (Pull Server-Route)

---

## 🎯 Ziel der Phase

Einen **"Sync from Remote"** Button in der Online-Sync-View implementieren, der Tickets aus der Postgres-Datenbank ins lokale Board holt.

**Problem:** Es gibt keinen UI-Button zum Pullen von Remote-Tickets!

---

## 🖥️ Konkretes Beispiel

```
🖥️ Benutzer öffnet Online-Sync View (/online-sync)
📋 Sieht Projekt "Finance Dashboard" in der Liste
🔄 Klickt auf "Sync from Remote" Button
⏳ Loading-Spinner erscheint
✅ Toast: "5 neue Tickets synchronisiert"
📋 Lokales Board (/board) zeigt jetzt die neuen Tickets
```

---

## 🔗 Abhängigkeiten & Voraussetzungen

### Benötigte Komponenten

| Komponente       | Pfad                                                | Status         |
| ---------------- | --------------------------------------------------- | -------------- |
| Online-Sync-View | `apps/ui/src/components/views/online-sync-view.tsx` | ✅ Existiert   |
| API Hook         | `apps/ui/src/hooks/use-online-projects.ts`          | ✅ Existiert   |
| Button Component | `apps/ui/src/components/ui/button.tsx`              | ✅ Existiert   |
| Toast            | `sonner`                                            | ✅ Installiert |

### Phase 4.1 muss abgeschlossen sein:

- `POST /api/pg-sync/pull` Route funktioniert

---

## 🚀 Strategie

### UI-Flow

```
┌─────────────────────────────────────────────────┐
│  Online Sync View                               │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐   │
│  │ Finance Dashboard              /finance │   │
│  │ [Public] [Protected]                    │   │
│  │                                         │   │
│  │ ┌─────────────────┐ ┌─────────────────┐│   │
│  │ │ 🔄 Sync from    │ │ ⬆️ Push to      ││   │
│  │ │    Remote       │ │    Remote       ││   │
│  │ └─────────────────┘ └─────────────────┘│   │
│  │                                         │   │
│  │ Last Sync: 2026-01-09 14:30            │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

## ❓ Edge Cases & Proaktive F&A

### ✅ Was passiert, wenn kein lokales Projekt ausgewählt ist?

- Button zeigt Dropdown zur Projekt-Auswahl
- Oder: Automatisch lokales Projekt mit gleichem Namen finden

### ✅ Was passiert bei Konflikten (Ticket existiert lokal UND remote)?

- Modal mit Konflikt-Optionen:
  - "Remote überschreibt Lokal"
  - "Lokal behalten"
  - "Manuell mergen" (später)

### ✅ Was passiert während des Syncs?

- Button disabled mit Spinner
- Progress-Text: "Synchronisiere... (3/10 Tickets)"
- Abbrechen-Button (optional)

### ✅ Was passiert bei Netzwerk-Fehler?

- Toast mit Fehlermeldung
- Retry-Button erscheint

---

## 📋 Implementierungs-Tasks

### Task 1: usePullFromRemote Hook

**Datei:** `apps/ui/src/hooks/use-online-projects.ts` **~80 Zeilen Erweiterung**

**Zweck:** React Query Mutation für Pull-Operation

**API:**

```typescript
interface UsePullFromRemoteOptions {
  projectId: string;
  localProjectPath: string;
}

// Hook exportieren
export function usePullFromRemote(projectId: string);
```

**Funktionalität:**

- `mutateAsync({ projectId, localProjectPath })` - Pull ausführen
- `isPending` - Loading-State
- `error` - Fehler-State
- Automatisches Cache-Invalidieren nach Erfolg

---

### Task 2: SyncButtons Component

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx` **~100 Zeilen Erweiterung**

**Neue Komponente:** `ProjectSyncButtons`

**Props:**

- `project: OnlineProject` - Das Projekt
- `localProjectPath: string | null` - Lokaler Pfad (aus App-Store)

**UI-Elemente:**

- "Sync from Remote" Button mit Download-Icon
- Loading-Spinner während Sync
- Progress-Anzeige (optional)
- Letzter Sync-Zeitpunkt

---

### Task 3: Projekt-Mapping Logic

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx` **~30 Zeilen**

**Zweck:** Online-Projekt mit lokalem Projekt verknüpfen

**Logik:**

1. Prüfen ob `project.slug` mit lokalem Projekt-Namen übereinstimmt
2. Oder: Explizites Mapping im Settings speichern
3. Fallback: Dropdown zur manuellen Auswahl

---

### Task 4: Pull-Ergebnis Toast

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx` **~20 Zeilen**

**Toast-Varianten:**

| Zustand     | Toast                             |
| ----------- | --------------------------------- |
| Erfolg      | "✅ 5 Tickets synchronisiert"     |
| Keine neuen | "ℹ️ Keine neuen Tickets"          |
| Fehler      | "❌ Sync fehlgeschlagen: [Grund]" |
| Konflikte   | "⚠️ 2 Konflikte gefunden"         |

---

## 🔧 Wiederverwendung

### Aus apps/ui wiederverwenden:

| Modul                    | Komponente   | Verwendung |
| ------------------------ | ------------ | ---------- |
| `use-online-projects.ts` | Hook-Pattern | Struktur   |
| `button.tsx`             | Button       | UI         |
| `sonner`                 | toast()      | Feedback   |

### Pattern aus existierendem Code:

```typescript
// Analog zu useEnableCustomerAccess
export function usePullFromRemote(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: PullOptions) => {
      const response = await fetch(`/api/pg-sync/pull`, {
        method: 'POST',
        body: JSON.stringify({ projectId, ...options }),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['online-projects'] });
    },
  });
}
```

---

## 📊 Geschätzte Komplexität

| Task                           | Zeilen   | Komplexität |
| ------------------------------ | -------- | ----------- |
| Task 1: usePullFromRemote Hook | ~80      | Mittel      |
| Task 2: SyncButtons Component  | ~100     | Mittel      |
| Task 3: Projekt-Mapping        | ~30      | Niedrig     |
| Task 4: Toast-Feedback         | ~20      | Niedrig     |
| **Gesamt**                     | **~230** | **Mittel**  |

---

## ✅ Akzeptanzkriterien

1. [x] "Sync from Remote" Button erscheint in ProjectCard
2. [x] Button zeigt Loading-State während Sync
3. [x] Erfolgs-Toast nach erfolgreichem Sync
4. [x] Fehler-Toast bei Problemen
5. [x] Button disabled wenn kein lokales Projekt zugeordnet (zeigt Warning)
6. [x] TypeScript-Check erfolgreich: `npx tsc --noEmit`

---

## 🎨 Design-Vorgaben

### Button-Styling (Liquid Glass):

```
- Background: bg-blue-500/20
- Border: border border-blue-500/30
- Hover: shadow-[0_0_15px_-3px_rgba(59,130,246,0.5)]
- Icon: RefreshCw oder Download
- Text: "Sync from Remote"
```

### Loading-State:

```
- Icon: Loader2 mit animate-spin
- Text: "Synchronisiere..."
- Disabled: opacity-50 cursor-not-allowed
```

---

## 📝 Notizen für Implementierung

- **WICHTIG:** Lokaler Projekt-Pfad muss aus App-Store kommen (`useAppStore`)
- **WICHTIG:** Nach Sync muss Phase 4.4 aufgerufen werden (Feature-Files schreiben)
- Button sollte neben den existierenden Public-Access-Buttons platziert werden

---

## 🔗 Nächste Phase

Nach Abschluss dieser Phase → **Phase 4.3: Push Button Enhancement**
