# 🎫 Phase 3.4: Kunden-Ticket-Eingang

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 3.3 (Kunden-Kanban), Phase 2.1 (Ticket Creation)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Kunden ermöglichen, **selbst Tickets zu erstellen** (Bug Reports, Feature Requests).
Dies geschieht über ein vereinfachtes Formular direkt auf dem öffentlichen Board.

Wichtige Aspekte:

- "Neues Ticket" Button auf Public Board
- Reduziertes Formular (Titel, Beschreibung, Anhänge optional)
- Automatische Zuweisung (Source: 'customer')
- Bestätigungsmeldung ("Wir haben dein Feedback erhalten")

---

## ❓ Proaktive F&A

### Q1: Dürfen Kunden Priorität setzen?

✅ **Eingeschränkt oder Nein:**
Oft setzen Kunden alles auf "Highest". Besser: Wir lassen sie "Art" wählen (Bug, Feature) und setzen intern die Prio. Oder wir geben ihnen einfache Optionen: "Normal", "Kritisch".

### Q2: Wo landen diese Tickets?

✅ **Inbox / Todo:**
Standardmäßig im Status `todo` oder einer speziellen `inbox` Spalte, damit sie vom PM triagiert werden können.

### Q3: Braucht der Kunde einen Account?

✅ **Wir nutzen die Projekt-Auth (Phase 3.2):**
Da der Kunde bereits das Projekt-Passwort eingegeben hat, ist er berechtigt. Wir speichern "Guest Customer" als Ersteller. Optional: Namensfeld im Formular abfragen ("Dein Name").

---

## 🏛️ Architektur & Datenfluss

### Formular-Flow

```
Public Page
(Create Button)
      │
      ▼
┌──────────────┐       ┌──────────────┐
│  Public Form │       │  Server Act. │
│ (Zod Valid.) │ ──►   │ createPublic │
│              │       │ Ticket       │
└──────────────┘       └──────┬───────┘
                              │
                              ▼
                       ┌──────────────┐
                       │  Postgres DB │
                       │              │
                       └──────────────┘
                              │
                        (Realtime)
                              ▼
                        Internes Board
                        (Mitarbeiter sieht neues Ticket sofort)
```

---

## 📋 Anforderungen

### Formular-Felder

| Feld           | Typ    | Pflicht? | UI                                        |
| -------------- | ------ | -------- | ----------------------------------------- |
| `title`        | string | Ja       | Input                                     |
| `description`  | text   | Nein     | Einfache Textarea (Kein komplexer Editor) |
| `creator_name` | string | Ja       | "Dein Name" (damit wir wissen wer es war) |
| `type`         | enum   | Ja       | Select: Fehler, Feature, Frage            |

### Backend-Logik (`createPublicTicket`)

- Setzt `status` = 'todo'
- Setzt `priority` = 'medium' (default)
- Setzt `tags` = ['customer-feedback']
- Speichert `creator_name` in einem passenden Feld (z.B. Description-Prefix oder Metadaten)

---

## 💻 Implementation Details

### 1. Zod Schema

Datei: `libs/pg-sync/src/types/ticket.types.ts` (Erweitern oder neu)

```typescript
export const CreatePublicTicketSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  creatorName: z.string().min(2, 'Bitte Namen angeben'),
  category: z.enum(['bug', 'feature', 'question']),
});
```

### 2. Action: `createPublicTicket`

Datei: `libs/pg-sync/src/actions/ticket-actions.ts`

```typescript
export async function createPublicTicket(projectId: string, data: PublicTicketInput) {
  // Description anreichern
  const fullDesc = `**Erstellt von:** ${data.creatorName}\n**Kategorie:** ${data.category}\n\n${data.description || ''}`;

  return await db.insert(ticketsTable).values({
    projectId,
    title: data.title,
    description: fullDesc,
    status: 'todo',
    source: 'customer_web_ui', // Wichtig zur Unterscheidung
    // ...
  });
}
```

### 3. UI: `PublicCreateTicketDialog`

Datei: `apps/web/src/components/board/public-create-ticket-dialog.tsx`

- Einfacher Dialog.
- Erfolgsmeldung: "Danke! Ticket #{nr} wurde erstellt."

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                                           | Zweck        | ~Zeilen |
| --------------------------------------------------------------- | ------------ | ------- |
| `apps/web/src/components/board/public-create-ticket-dialog.tsx` | Web Formular | ~100    |

### Erweiterungen

| Datei                                         | Zweck                | ~Zeilen |
| --------------------------------------------- | -------------------- | ------- |
| `libs/pg-sync/src/actions/ticket-actions.ts`  | `createPublicTicket` | +30     |
| `apps/web/src/app/(public)/p/[slug]/page.tsx` | Button einbauen      | +10     |

---

## ✅ Abschlusskriterien

- [ ] "Ticket erstellen" Button auf dem Kunden-Board sichtbar. (→ UI in Phase 3.5 oder separatem Frontend-Task)
- [x] Formular-Validierung implementiert (Zod Schema).
- [x] Backend API-Endpoint erstellt (POST /p/:slug/tickets).
- [x] Ticket erscheint im internen Board (status: todo, label: customer-feedback).
- [x] Ersteller-Name ist im Ticket ersichtlich (in Description).

---

## 🚀 Implementierungsstand (2026-01-07)

### ✅ Backend ABGESCHLOSSEN

| Datei                                             | Änderung                                                 |
| ------------------------------------------------- | -------------------------------------------------------- |
| `libs/pg-sync/src/validations/ticket.schema.ts`   | `CreatePublicTicketSchema`, `PublicTicketCategorySchema` |
| `libs/pg-sync/src/actions/ticket-actions.ts`      | `createPublicTicket` Action                              |
| `libs/pg-sync/src/index.ts`                       | Alle Exports hinzugefügt                                 |
| `apps/server/src/routes/public-projects/index.ts` | `POST /:slug/tickets` Endpoint                           |

### ⏳ Frontend TODO (wird in apps/ui oder separatem Web-Frontend implementiert)

- "Neues Ticket" Button auf Public Board
- PublicCreateTicketDialog Komponente
- API-Call an POST /api/p/:slug/tickets

---

## 🔗 Referenzen

- `phase-2.1-ticket-creation.md` (Interne Version)
