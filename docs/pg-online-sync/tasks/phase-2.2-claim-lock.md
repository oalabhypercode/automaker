# 🔐 Phase 2.2: Claim/Lock-Mechanismus (Realtime)

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 2.1 (Ticket-Erstellung), Phase 0.2 (Postgres Setup)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Implementierung von Mechanismen zur Konfliktvermeidung bei gleichzeitiger Bearbeitung in der **Internen Web-UI**.
Wir unterscheiden dabei zwei Konzepte:

1. **Hard Claim (Persistent):** Ein User übernimmt die Verantwortung für ein Ticket (DB-gestützt).
2. **Soft Lock (Ephemeral):** Anzeige, wer das Ticket gerade bearbeitet (via Supabase Presence), um parallele Edits zu vermeiden.

---

## ❓ Proaktive F&A

### Q1: Was ist der Unterschied zwischen Claim und Assign?

✅ **Semantik:**

- **Assign:** Ein Manager weist das Ticket zu (Planung).
- **Claim:** Ein Entwickler "schnappt" sich das Ticket zur sofortigen Bearbeitung ("Ich mach das jetzt").
- Technisch: Setzt `claimed_by` und oft Status auf `in_progress`.

### Q2: Brauchen wir eine Lock-Tabelle in der DB?

✅ **Nein, Supabase Presence reicht:**
Für temporäre "Is Editing"-Anzeigen nutzen wir Supabase Realtime Presence. Das ist schneller und müllt die DB nicht zu. Wenn der Browser schließt, verschwindet der Lock automatisch.

### Q3: Was passiert, wenn zwei User gleichzeitig speichern?

✅ **Optimistic Locking:**
Die Tabelle `tickets` hat eine `version` Spalte.
Beim Update prüfen wir: `WHERE id = ... AND version = 5`.
Wenn die Version in der DB schon 6 ist, schlägt das Update fehl -> User muss neu laden.

---

## 🏛️ Architektur & Datenfluss

### 1. Hard Claim (Datenbank)

```
[User A] Klickt "Übernehmen"
    │
    ▼
[Action] updateTicket(id, { claimedBy: me, status: 'in_progress' })
    │
    ▼
[DB] Update & Event Log
    │
    ▼
[Realtime] Broadcast an alle Clients
    │
    ▼
[UI User B] Avatar von User A erscheint beim Ticket
```

### 2. Soft Lock (Presence)

```
[User A] Öffnet Edit-Dialog
    │
    ▼
[Supabase] channel.track({ user: 'User A', state: 'editing' })
    │
    ▼
[Supabase] Broadcast Presence State
    │
    ▼
[UI User B] Nachricht: "User A bearbeitet dieses Ticket gerade..."
            (Edit-Button evtl. deaktiviert oder Warnung)
```

---

## 💻 Implementation Details

### 1. Hook: `useTicketPresence`

Datei: `apps/web/src/hooks/use-ticket-presence.ts`

```typescript
export function useTicketPresence(ticketId: string) {
  const [activeUsers, setActiveUsers] = useState<User[]>([]);
  const user = useCurrentUser();

  useEffect(() => {
    const channel = supabase.channel(`ticket:${ticketId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        // Mappe State zu User-Liste
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            name: user.name,
            active_at: new Date(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
    };
  }, [ticketId]);

  return { activeUsers };
}
```

### 2. UI-Komponente: `LockIndicator`

Datei: `apps/web/src/components/tickets/lock-indicator.tsx`

Zeigt Avatare der User an, die gerade "live" auf dem Ticket sind.
Wenn jemand im "Editing"-Modus ist (nicht nur "Viewing"), wird eine Warnung angezeigt.

### 3. Action: `claimTicket`

Datei: `libs/pg-sync/src/actions/ticket-actions.ts`

```typescript
export async function claimTicket(ticketId: string, userId: string) {
  return await db.transaction(async (tx) => {
    // 1. Ticket holen & Version checken
    const ticket = await tx.query.tickets.findFirst(...)

    // 2. Update mit Version Check
    const updated = await tx.update(tickets)
      .set({
        claimedBy: userId,
        claimedAt: new Date(),
        status: 'in_progress',
        version: ticket.version + 1
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.version, ticket.version)))
      .returning();

    if (!updated.length) throw new Error("Ticket wurde zwischenzeitlich geändert");

    // 3. Event
    await createEvent(tx, { type: 'claimed', ... });
  });
}
```

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                                | Zweck         | ~Zeilen |
| ---------------------------------------------------- | ------------- | ------- |
| `apps/web/src/hooks/use-ticket-presence.ts`          | Realtime Hook | ~80     |
| `apps/web/src/components/tickets/lock-indicator.tsx` | UI Anzeige    | ~60     |
| `apps/web/src/components/tickets/claim-button.tsx`   | Claim-Button  | ~50     |

### Erweiterungen (Shared Lib)

| Datei                                        | Zweck          | ~Zeilen |
| -------------------------------------------- | -------------- | ------- |
| `libs/pg-sync/src/actions/ticket-actions.ts` | `claimTicket`  | +40     |
| `libs/pg-sync/src/types/sync.types.ts`       | Presence Types | +20     |

---

## ✅ Abschlusskriterien

- [ ] `claimTicket` Action mit Optimistic Locking implementiert
- [ ] UI-Button zum Claimen vorhanden
- [ ] Supabase Presence Hook (`useTicketPresence`) funktioniert
- [ ] Anzeige anderer aktiver User auf dem Ticket live sichtbar
- [ ] Warnung, wenn anderer User gerade editiert
- [ ] Automatische Freigabe des Soft-Locks beim Verlassen der Seite

---

## 🔗 Referenzen

- [Supabase Presence Docs](https://supabase.com/docs/guides/realtime/presence)
- `phase-1.1-datenmodell.md` (`tickets`-Tabelle)
