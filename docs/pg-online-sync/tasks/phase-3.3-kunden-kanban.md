# 📋 Phase 3.3: Abgespeckte Kanban-UI

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 3.2 (Auth), Phase 2.3 (Internes Board)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Erstellung der **Customer-Facing Kanban View**.
Diese Ansicht unterscheidet sich vom internen Board durch **Reduzierung**: Weniger Details, keine Drag&Drop-Rechte (meistens), Fokus auf Status-Transparenz.

Wichtige Aspekte:

- Read-Only Status für Spalten (Kein Drag & Drop für Kunden)
- Detail-View mit eingeschränkten Feldern
- Ausblenden interner Tickets/Notizen
- Branding-Möglichkeiten (Logo des Projekts)

---

## ❓ Proaktive F&A

### Q1: Können Kunden Tickets verschieben?

✅ **Nein (Standard):**
In der Regel beobachtet der Kunde nur den Fortschritt. Schreibrechte beschränken sich auf Kommentare oder Erstellung (Phase 3.4). Drag & Drop ist deaktiviert.

### Q2: Werden alle Tickets angezeigt?

✅ **Filterbar:**
Es sollte ein Flag `is_visible_to_customer` oder Ähnliches geben, oder alle Tickets sind standardmäßig sichtbar. Wir starten mit: **Alle Tickets sind sichtbar**, es sei denn, sie haben einen speziellen "Intern"-Tag.

### Q3: Sehen Kunden dasselbe Design?

✅ **Ähnlich, aber vereinfacht:**
Wir nutzen dieselben UI-Komponenten (`TicketCard`), aber deaktivieren die Editier-Funktionen. Das Layout ist "Clean" (keine Sidebar für Settings etc.).

---

## 🏛️ Architektur & UI-Komponenten

### Wiederverwendung vs. neu bauen

Wir nutzen das **Component Composition Pattern**:

```tsx
// Shared
<KanbanColumn>
  <TicketList>
    <TicketCard readonly={true} />
  </TicketList>
</KanbanColumn>
```

Die `TicketCard` muss intelligent genug sein, Edit-Buttons zu verstecken, wenn `readonly={true}` gesetzt ist.

### Daten-Fetching (Server Component)

```typescript
// fetchPublicTickets(projectId)
// Filtert sensible Daten bereits im Backend raus!
```

---

## 📋 Anforderungen

### UI-Unterschiede (Intern vs. Public)

| Feature              | Intern         | Public (Kunde)                 |
| -------------------- | -------------- | ------------------------------ |
| **Drag & Drop**      | ✅ Ja          | ❌ Nein                        |
| **Ticket Erstellen** | ✅ Button oben | ✅ (Phase 3.4)                 |
| **Status ändern**    | ✅ Ja          | ❌ Nein                        |
| **Details sehen**    | ✅ Alles       | ⚠️ Nur Titel, Desc, Status, ID |
| **Interne Notizen**  | ✅ Ja          | ❌ Ausgefiltert                |
| **Assignee**         | ✅ Ja          | ✅ (Vielleicht optional)       |

### API Security

Die Fetch-Action `getPublicTickets` darf **niemals** interne Felder zurückgeben (z.B. interne Kosten, Zeiterfassung).

---

## 💻 Implementation Details

### 1. Finder: `getPublicProjectTickets`

Datei: `libs/pg-sync/src/finders/ticket-finder.ts`

```typescript
export async function getPublicProjectTickets(projectId: string) {
  return db.query.tickets.findMany({
    where: and(
      eq(tickets.projectId, projectId)
      // evtl. Check auf 'internal' Tag
    ),
    columns: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
      priority: true,
      updatedAt: true,
      // Description könnte groß sein, evtl. lazy laden oder trimmen
    },
  });
}
```

### 2. Komponente: `PublicTicketCard`

Datei: `apps/web/src/components/board/public-ticket-card.tsx`
Kann eine Wrapper um die normale `TicketCard` sein oder eine separate, leichtere Version.
_Empfehlung: Separate Version, um versehentliches Leaking von Admin-Controls zu verhindern._

```tsx
export function PublicTicketCard({ ticket }: { ticket: PublicTicket }) {
  return (
    <div className="border p-3 rounded bg-white shadow-sm">
      <div className="flex justify-between">
        <span className="text-sm text-gray-500">#{ticket.ticketNumber}</span>
        <StatusBadge status={ticket.status} />
      </div>
      <h3 className="font-medium mt-1">{ticket.title}</h3>
    </div>
  );
}
```

### 3. Detail-Dialog (Public)

Klickt der Kunde auf eine Karte, öffnet sich ein Dialog.
Dieser muss Kommentare (Public) und Description zeigen (Phase 3.4/3.5 beachten).

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                                  | Zweck          | ~Zeilen |
| ------------------------------------------------------ | -------------- | ------- |
| `apps/web/src/components/board/public-board-view.tsx`  | Main Grid View | ~80     |
| `apps/web/src/components/board/public-ticket-card.tsx` | Read-only Card | ~60     |

### Erweiterungen/Anpassungen

| Datei                                       | Zweck                     | ~Zeilen |
| ------------------------------------------- | ------------------------- | ------- |
| `libs/pg-sync/src/finders/ticket-finder.ts` | `getPublic...` Funktionen | +30     |

---

## ✅ Abschlusskriterien

- [ ] Route `/p/[slug]` zeigt Kanban-Spalten.
- [ ] Tickets werden geladen.
- [ ] Tickets können NICHT bewegt werden (DragDisabled).
- [ ] UI ist responsiv für Mobile (Kunden schauen oft am Handy).
- [ ] Sensible Daten (Interne Kommentare, Felder) werden nicht an den Client gesendet.

---

## 🔗 Referenzen

- `phase-3.1-projekt-urls.md`
- `phase-1.1-datenmodell.md`
