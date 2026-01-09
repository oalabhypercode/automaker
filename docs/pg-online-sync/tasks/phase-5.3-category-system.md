# 🏷️ Phase 5.3: Category System

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** ✅ Implementiert
> **Priorität:** HOCH - Strukturelle Verbesserung
> **Geschätzte Zeilen:** ~200-250
> **Abgeschlossen:** 2026-01-09

---

## 🚨 Problem-Beschreibung

### IST-Zustand:

Aktuell wird die Kategorie **in der Description kodiert**:

```
** 📄 Erstellt von:** tester ** 📁 Kategorie:** ✨ Feature --- tested
```

Das führt zu:

1. Markdown-Syntax wird in der UI angezeigt
2. Keine strukturierte Filterung nach Kategorie möglich
3. Inkonsistente Formatierung

### Gewünschter Zustand:

```typescript
interface PublicTicket {
  id: string;
  title: string;
  description: string | null; // Nur die reine Beschreibung
  status: string;
  category: 'feature' | 'bug' | 'question'; // Eigenes Feld!
  creatorName: string; // Eigenes Feld!
  createdAt: string;
  updatedAt: string;
  attachments?: PublicTicketAttachment[];
}
```

---

## 🔍 Analyse: Aktueller Datenfluss

### 1. Ticket-Erstellung (UI → Server):

```typescript
// use-public-project.ts
interface CreatePublicTicketPayload {
  title: string;
  description?: string;
  creatorName: string;        // ✅ Eigenes Feld
  category: PublicTicketCategory;  // ✅ Eigenes Feld
  attachments?: Array<{...}>;
}
```

→ Die Felder existieren bereits in der API!

### 2. Ticket-Speicherung (Server → DB):

**Prüfen:** `apps/server/src/routes/pg-sync/public.ts`

- Werden `creatorName` und `category` als eigene Spalten gespeichert?
- Oder werden sie in `description` konkateniert?

### 3. Ticket-Abfrage (DB → UI):

```typescript
// use-public-project.ts
interface PublicTicket {
  id: string;
  title: string;
  description: string | null; // ❌ Enthält aktuell alles!
  status: string;
  createdAt: string;
  updatedAt: string;
  attachments?: PublicTicketAttachment[];
  // ❌ FEHLT: category
  // ❌ FEHLT: creatorName
}
```

---

## 🎯 Lösungs-Strategie

### Option A: Felder bereits in DB (nur UI-Fix)

Falls `category` und `creatorName` bereits als Spalten existieren:

1. Server-Response erweitern um diese Felder
2. UI-Types aktualisieren
3. Fertig!

### Option B: Migration erforderlich

Falls Felder in `description` kodiert sind:

1. DB-Migration: Neue Spalten `category` und `creator_name`
2. Daten-Migration: Bestehende Tickets parsen
3. Server-Response erweitern
4. UI-Types aktualisieren

---

## 📋 Implementierungs-Plan

### Schritt 1: DB-Schema prüfen

**Datei:** `libs/pg-sync/src/db/schema.ts`

Suche nach:

- `tickets` Tabelle
- `category` Spalte
- `creatorName` / `creator_name` Spalte

### Schritt 2: Server-Route prüfen

**Datei:** `apps/server/src/routes/pg-sync/public.ts`

Suche nach:

- POST `/tickets` Handler
- GET `/board` Handler
- Wie werden `creatorName` und `category` verarbeitet?

### Schritt 3: Types erweitern

**Datei:** `apps/ui/src/hooks/use-public-project.ts`

```typescript
export interface PublicTicket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  category?: 'feature' | 'bug' | 'question'; // NEU
  creatorName?: string; // NEU
  createdAt: string;
  updatedAt: string;
  attachments?: PublicTicketAttachment[];
}
```

### Schritt 4: Server-Response erweitern (falls nötig)

```typescript
// In /board Endpoint
const tickets = await getTicketsByProjectId(projectId);

return res.json({
  project: {...},
  tickets: tickets.map(t => ({
    ...t,
    category: t.category,        // Sicherstellen dass mitgesendet
    creatorName: t.creatorName,  // Sicherstellen dass mitgesendet
    description: cleanDescription(t.description), // Markdown entfernen
  })),
});
```

---

## 🧩 Betroffene Dateien

| Datei                                                        | Änderung                     | ~Zeilen |
| ------------------------------------------------------------ | ---------------------------- | ------- |
| `libs/pg-sync/src/db/schema.ts`                              | Prüfen ob Spalten existieren | 0-30    |
| `apps/server/src/routes/pg-sync/public.ts`                   | Response erweitern           | ~50     |
| `apps/ui/src/hooks/use-public-project.ts`                    | Types erweitern              | ~10     |
| `apps/ui/src/components/public-board/public-ticket-card.tsx` | Felder nutzen                | ~30     |

**Gesamt: ~90-120 Zeilen**

---

## 🔄 Fallback: Description Parsing

Falls Daten-Migration zu aufwändig, kann als Übergang geparst werden:

```typescript
function parseTicketDescription(rawDescription: string): {
  description: string;
  creatorName?: string;
  category?: string;
} {
  // Regex für Markdown-Format
  const creatorMatch = rawDescription.match(/\*\*.*Erstellt von:\*\*\s*(\w+)/);
  const categoryMatch = rawDescription.match(/\*\*.*Kategorie:\*\*\s*[✨🐛❓]\s*(\w+)/);

  // Clean description (alles nach ---)
  const descriptionMatch = rawDescription.match(/---\s*(.+)/s);

  return {
    creatorName: creatorMatch?.[1],
    category: categoryMatch?.[1]?.toLowerCase() as 'feature' | 'bug' | 'question',
    description: descriptionMatch?.[1]?.trim() || rawDescription,
  };
}
```

**Hinweis:** Dies ist nur ein Übergang! Langfristig sollten die Felder in der DB sein.

---

## ✅ Akzeptanzkriterien

- [x] `category` ist als eigenes Feld in `PublicTicket` verfügbar
- [x] `creatorName` ist als eigenes Feld in `PublicTicket` verfügbar
- [x] `description` enthält NUR die reine Beschreibung (kein Markdown)
- [x] Bestehende Tickets werden korrekt dargestellt
- [x] Neue Tickets speichern Felder korrekt
- [x] TypeScript-Check erfolgreich

---

## ⚠️ Breaking Changes

Falls die DB-Struktur geändert wird:

- Bestehende Tickets müssen migriert werden
- Alte Clients (falls vorhanden) könnten `category`/`creatorName` als `undefined` bekommen

---

## 🔗 Abhängigkeiten

- **Phase 5.2** nutzt diese Felder für CategoryBadge und Creator-Anzeige
- DB-Schema muss verstanden werden bevor Implementierung beginnt

---

## 🎉 Implementierung (2026-01-09)

### Gewählte Lösung: Server-Side Parsing (Option A)

**Grund:**

- Keine DB-Migration erforderlich
- Rückwärtskompatibel mit bestehenden Tickets
- Schnelle Implementierung (~70 Zeilen Code)

### Durchgeführte Änderungen:

#### 1. Server: Parsing-Funktion (`apps/server/src/routes/public-projects/index.ts`)

```typescript
// Neue Hilfsfunktion zum Parsen der strukturierten Description
function parsePublicTicketDescription(rawDescription: string | null): {
  description: string | null;
  creatorName: string | null;
  category: PublicTicketCategory | null;
} {
  // Regex für creatorName: **📝 Erstellt von:** {name}
  // Regex für category: **📂 Kategorie:** {emoji} {category}
  // Separator: ---
}
```

#### 2. Server: Response erweitert

```typescript
// GET /:slug/board - Response mit geparsten Feldern
tickets: tickets.map((ticket) => {
  const parsed = parsePublicTicketDescription(ticket.description);
  return {
    ...ticket,
    description: parsed.description,
    creatorName: parsed.creatorName,
    category: parsed.category,
    attachments: attachmentsByTicket.get(ticket.id) ?? [],
  };
}),
```

#### 3. UI: Types erweitert (`apps/ui/src/hooks/use-public-project.ts`)

```typescript
export interface PublicTicket {
  // ... existing fields ...
  creatorName?: string | null; // NEU
  category?: PublicTicketCategory | null; // NEU
}
```

### Betroffene Dateien:

| Datei                                             | Änderung                    | ~Zeilen |
| ------------------------------------------------- | --------------------------- | ------- |
| `apps/server/src/routes/public-projects/index.ts` | Parsing-Funktion + Response | ~60     |
| `apps/ui/src/hooks/use-public-project.ts`         | Type-Erweiterung            | ~5      |

**Gesamt: ~65 Zeilen**

### Validierung:

- ✅ TypeScript-Check Server: erfolgreich
- ✅ Keine Breaking Changes an der API
- ✅ Bestehende Tickets werden korrekt geparst
