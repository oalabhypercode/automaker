# 🎫 Phase 2.1: Online Ticket-Erstellung

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 1.1 (Datenmodell), Phase 1.2 (Actions)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Implementierung der **Ticket-Erstellung** für die **Interne Web-UI**.
Im Gegensatz zur Offline-First App (die lokal speichert und später synct), interagiert diese Komponente **direkt** mit der Postgres-Datenbank via Supabase.

Wichtige Aspekte:

- Formular mit Validierung (Zod)
- Direkter Datenbank-Write (Optimistic UI optional)
- Unterstützung für Datei-Anhänge (Basis)
- Automatische Zuordnung zu Projekt und User

---

## ❓ Proaktive F&A

### Q1: Warum nicht den lokalen Sync-Mechanismus nutzen?

✅ **Direkter Zugriff:**
Die "Interne Web-UI" ist eine reine Online-Anwendung. Wir schreiben direkt in die Postgres DB, um sofortige Konsistenz für alle Online-Nutzer zu gewährleisten. Der Sync (Phase 1) ist nur für die Offline-Clients nötig.

### Q2: Welche Validierung wird verwendet?

✅ **Shared Zod Schemas:**
Wir nutzen dieselben Zod-Schemas wie im Backend / Sync-Layer (`libs/pg-sync/src/types/ticket.types.ts`), um Datenkonsistenz sicherzustellen.

### Q3: Was passiert bei Verbindungsabbruch während des Sendens?

✅ **Error-Handling:**
Da es eine Online-App ist: Fehleranzeige (Toast) und der User muss es erneut versuchen. Kein Offline-Queueing in der Web-UI (anders als im Electron-Client).

### Q4: Wer kann Tickets erstellen?

✅ **Auth-Check:**
Nur eingeloggte Mitarbeiter (Internal User) mit Schreibrechten auf dem Projekt.

---

## 🏛️ Architektur & Datenfluss

### Ablauf der Erstellung

```
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│   Web-UI Frontend  │      │   Shared Lib       │      │   Postgres DB      │
│  (Next.js / React) │      │  (libs/pg-sync)    │      │   (Supabase)       │
└─────────┬──────────┘      └─────────┬──────────┘      └─────────┬──────────┘
          │                           │                           │
          │ 1. Formular Submit        │                           │
          │ ────────────────────────► │                           │
          │                           │                           │
          │                           │ 2. Validate (Zod)         │
          │                           │ ───────────────────┐      │
          │                           │                    ▼      │
          │                           │ 3. Execute Action         │
          │                           │ (ticket-actions.ts)       │
          │                           │ ────────────────────────► │
          │                           │                           │ 4. INSERT Row
          │                           │                           │ (Trigger: Events)
          │                           │ ◄──────────────────────── │
          │                           │                           │
          │ 5. Return Created Ticket  │                           │
          │ ◄──────────────────────── │                           │
          │                           │                           │
          ▼                           ▼                           ▼
     Update UI List             (Stateless)                 Persisted
```

---

## 📋 Anforderungen

### Datenfelder (Formular)

| Feld          | Typ      | Pflicht? | Default  | UI-Komponente               |
| ------------- | -------- | -------- | -------- | --------------------------- |
| `title`       | string   | Ja       | -        | Input (Text)                |
| `description` | string   | Nein     | ""       | Rich-Text Editor / Textarea |
| `status`      | enum     | Ja       | 'todo'   | Select / Dropdown           |
| `priority`    | enum     | Ja       | 'medium' | Select (Icon)               |
| `assignee_id` | uuid     | Nein     | null     | User-Select (Avatar)        |
| `due_date`    | date     | Nein     | null     | Datepicker                  |
| `tags`        | string[] | Nein     | []       | Tag-Input                   |

### Validierungs-Regeln (Zod)

```typescript
const CreateTicketSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3, 'Titel muss mind. 3 Zeichen haben').max(100),
  description: z.string().optional(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  assigneeId: z.string().uuid().nullable().optional(),
  dueDate: z.date().nullable().optional(),
});
```

---

## 💻 Implementation Details

### 1. Action: `createTicket`

Datei: `libs/pg-sync/src/actions/ticket-actions.ts`

```typescript
export async function createTicket(data: CreateTicketDTO): Promise<Ticket> {
  // 1. Validierung
  const validated = CreateTicketSchema.parse(data);

  // 2. DB Insert via Drizzle
  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      ...validated,
      ticketNumber: sql`next_ticket_number(${validated.projectId})`, // Custom function
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();

  // 3. Event erstellen (für Sync anderer Clients - geschieht oft via DB Trigger,
  //    aber hier explizit oder via Trigger in Phase 1.3 definiert)

  return ticket;
}
```

### 2. UI-Komponente: `CreateTicketDialog`

Datei: `apps/web/src/components/tickets/create-ticket-dialog.tsx`

- Verwendet `react-hook-form` + `zod-resolver`
- Modal-Dialog
- Lädt Projekt-Member für Assignee-Dropdown
- "Erstellen" Button mit Loading-State

### 3. Hook: `useCreateTicket`

Datei: `apps/web/src/hooks/use-tickets.ts`

```typescript
export function useCreateTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTicketDTO) => ticketActions.createTicket(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      toast.success('Ticket erstellt');
    },
    onError: (error) => {
      toast.error('Fehler beim Erstellen: ' + error.message);
    },
  });
}
```

---

## 🧩 Modifizierte Dateien

### Neue Dateien (Web-App spezifisch)

| Datei                                                      | Zweck                | ~Zeilen |
| ---------------------------------------------------------- | -------------------- | ------- |
| `apps/web/src/components/tickets/create-ticket-dialog.tsx` | UI Dialog            | ~150    |
| `apps/web/src/components/tickets/ticket-form.tsx`          | Formular-Logik       | ~120    |
| `apps/web/src/hooks/use-create-ticket.ts`                  | React Query Mutation | ~40     |

### Erweiterungen (Shared Lib)

| Datei                                           | Zweck                   | ~Zeilen |
| ----------------------------------------------- | ----------------------- | ------- |
| `libs/pg-sync/src/actions/ticket-actions.ts`    | `createTicket` Funktion | +50     |
| `libs/pg-sync/src/validations/ticket.schema.ts` | Zod Schemas exportieren | +30     |

---

## ✅ Abschlusskriterien

- [ ] Zod-Schema für Ticket-Erstellung definiert
- [ ] `createTicket` Action in `libs/pg-sync` implementiert
- [ ] Ticket-Nummer Generierung (Auto-Increment pro Projekt) funktioniert
- [ ] UI-Dialog für Erstellung vorhanden
- [ ] Formular-Validierung funktioniert und zeigt Fehler an
- [ ] Erfolgreicher DB-Insert sichtbar in UI (Liste updated)
- [ ] Fehlerbehandlung (z.B. Datenbank nicht erreichbar) implementiert

---

## 🔗 Referenzen

- `phase-1.1-datenmodell.md` (Tabellen-Struktur)
- `phase-1.2-finder-actions.md` (Basis Pattern für Actions)
