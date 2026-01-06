# ⚡ Phase 2.4: Status-Updates & Real-time

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 2.1-2.3, Phase 0.2 (Supabase)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Implementierung von **Live-Updates** für das Kanban-Board in der Online-UI.
Änderungen (Drag & Drop, Titel-Updates, neue Tickets), die von anderen Usern gemacht werden, sollen **sofort** sichtbar sein, ohne Page-Reload.

Wir nutzen dazu **Supabase Realtime** (basierend auf Postgres Replication).

---

## ❓ Proaktive F&A

### Q1: Wie verhindern wir "flackernde" Updates?

✅ **Optimistic UI + Reconciliation:**
Wir updaten die UI sofort bei eigener Aktion (Optimistic). Wenn das Realtime-Event kommt, prüfen wir, ob es "neuer" ist oder unsere eigene Änderung bestätigt.

### Q2: Lauschen wir auf "Alles"?

✅ **Nein, Filterung nach Project:**
Wir abonnieren nur Änderungen für das aktive Projekt:
`postgres_changes` Event mit Filter `project_id=eq.[CURRENT_ID]`.

### Q3: Performance bei vielen Events?

✅ **Debouncing & Throttling:**
Bei sehr vielen Updates (z.B. Massen-Import) kann die UI überfordert werden. Wir nutzen React Query's `invalidateQueries` meist, aber für Drag & Drop Positionen eher direkten State-Patch, um Re-Fetches zu sparen.

---

## 🏛️ Architektur & Datenfluss

```
[Postgres DB] <── (Replication) ──> [Supabase Realtime Server]
      ▲                                       │
      │ Write (via Action)                    │ WS Broadcast
      │                                       ▼
[Client A (Actor)]                    [Client B (Observer)]
1. Optimistic Update UI               1. Empfängt Event
2. Send API Request                   2. Update lokalen Store / Refetch
```

---

## 💻 Implementation Details

### 1. Hook: `useRealtimeSubscription`

Datei: `apps/web/src/hooks/use-realtime-board.ts`

```typescript
export function useRealtimeBoard(projectId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`project:${projectId}:tickets`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'tickets',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // Strategie A: Einfach alles neu laden (sicher, aber mehr Traffic)
          // queryClient.invalidateQueries({ queryKey: ['tickets', projectId] });

          // Strategie B: Smart Update (Cache direkt manipulieren)
          handleRealtimeEvent(queryClient, projectId, payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId]);
}
```

### 2. Event Handler Logic

Datei: `apps/web/src/lib/realtime-utils.ts`

```typescript
function handleRealtimeEvent(queryClient, projectId, payload) {
  queryClient.setQueryData(['tickets', projectId], (oldData) => {
    switch (payload.eventType) {
      case 'INSERT':
        return [...oldData, payload.new];
      case 'UPDATE':
        return oldData.map((t) => (t.id === payload.new.id ? payload.new : t));
      case 'DELETE':
        return oldData.filter((t) => t.id !== payload.old.id);
    }
  });
}
```

### 3. Integration in Board Page

Datei: `apps/web/src/app/projects/[slug]/board/page.tsx`

```tsx
export default function BoardPage({ params }) {
  // ... data fetching ...

  // Aktiviert Realtime Listeners solange die Page offen ist
  useRealtimeBoard(project.id);

  return <KanbanBoard data={tickets} />;
}
```

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                      | Zweck                 | ~Zeilen |
| ------------------------------------------ | --------------------- | ------- |
| `apps/web/src/hooks/use-realtime-board.ts` | Subscription Logik    | ~60     |
| `apps/web/src/lib/realtime-utils.ts`       | Cache Updater Helpers | ~50     |

### Erweiterungen

| Datei                                             | Zweck                | ~Zeilen |
| ------------------------------------------------- | -------------------- | ------- |
| `apps/web/src/app/projects/[slug]/board/page.tsx` | Hook Aufruf einfügen | +5      |

---

## ✅ Abschlusskriterien

- [ ] Realtime Subscription auf `tickets` Tabelle funktioniert
- [ ] Filterung nach `project_id` korrekt
- [ ] INSERT (anderer User erstellt Ticket) -> erscheint sofort
- [ ] UPDATE (Statusänderung) -> Karte springt sofort in neue Spalte
- [ ] DELETE -> Karte verschwindet
- [ ] Keine doppelten Einträge durch Race Conditions

---

## 🔗 Referenzen

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- `phase-2.2-claim-lock.md` (Nutzt ebenfalls Supabase Channels)
