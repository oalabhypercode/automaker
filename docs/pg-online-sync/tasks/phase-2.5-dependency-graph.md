# 🧶 Phase 2.5: Dependency-Graph & Visualisierung

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 2.1, Phase 1.1 (Datenmodell Erweiterung)
> **Geschätzte Komplexität:** Mittel - Hoch

---

## 🎯 Ziel dieser Phase

Visualisierung von Abhängigkeiten zwischen Tickets, um Blocker und kritische Pfade zu identifizieren.
Dazu führen wir explizite Relationen zwischen Tickets ein ("Blockiert", "Wird blockiert von", "Verwandt mit").
Zusätzlich erstellen wir eine visuelle **Graph-Ansicht** (Node-Link Diagramm).

---

## ❓ Proaktive F&A

### Q1: Unterstützt das Datenmodell bereits Abhängigkeiten?

✅ **Nein, muss erweitert werden:**
Wir fügen eine Tabelle `ticket_relations` (oder `ticket_dependencies`) hinzu, um M:N Beziehungen abzubilden.
Typen: `blocks`, `relates_to`, `duplicate_of`.

### Q2: Welche Library nutzen wir für den Graphen?

✅ **React Flow:**

- Standard in modernem React Stack
- Interaktiv (Drag, Zoom, Click)
- Gute Performance
- Anpassbare Nodes (Custom Ticket Cards als Nodes)

### Q3: Werden zyklische Abhängigkeiten verhindert?

✅ **Ja (Backend Check):**
Vor dem Erstellen einer `blocks`-Relation prüfen wir, ob dadurch ein Zirkelbezug entstünde (A -> B -> C -> A).
Das ist wichtig für Gantt/Critical Path Berechnungen später.

---

## 🏛️ Datenmodell Erweiterung

### Neue Tabelle: `ticket_dependencies`

Datei: `libs/pg-sync/src/db/schema/tickets.ts` (Update)

```typescript
export const ticketDependencies = pgTable('ticket_dependencies', {
  id: uuid('id').defaultRandom().primaryKey(),
  sourceTicketId: uuid('source_ticket_id')
    .references(() => tickets.id)
    .notNull(),
  targetTicketId: uuid('target_ticket_id')
    .references(() => tickets.id)
    .notNull(),
  relationType: varchar('relation_type', { enum: ['blocks', 'relates_to'] }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Index:**

- Composite Index auf `(source_ticket_id, target_ticket_id)` für schnelle Lookups.

---

## 💻 Implementation Details

### 1. Visualization: `DependencyGraph`

Datei: `apps/web/src/components/views/dependency-graph.tsx`

Nutzt `reactflow` zur Darstellung.

- **Nodes:** Tickets (Farbe je nach Status)
- **Edges:** Linien mit Pfeilen (Rot für "Blockiert")
- **Layout:** `dagre` für automatisches hierarchisches Layout (Tree/Layered).

```tsx
import ReactFlow, { Background, Controls } from 'reactflow';

export function DependencyGraph({ tickets, dependencies }) {
  // Mapping logic: Ticket -> Node, Dep -> Edge
  const { nodes, edges } = useLayout(tickets, dependencies);

  return (
    <div style={{ height: '80vh' }}>
      <ReactFlow nodes={nodes} edges={edges}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
```

### 2. Action: `addDependency`

Datei: `libs/pg-sync/src/actions/dependency-actions.ts`

```typescript
export async function addDependency(sourceId: string, targetId: string, type: 'blocks') {
  // 1. Check Cycle
  if (await detectCycle(sourceId, targetId)) {
    throw new Error("Zyklische Abhängigkeit erkannt!");
  }

  // 2. Insert
  return await db.insert(ticketDependencies).values({ ... });
}
```

### 3. UI: "Blockers" Indikator im Board

Datei: `apps/web/src/components/board/ticket-card.tsx`

Wenn ein Ticket von offenen Tickets blockiert wird (Status != DONE), zeige ein rotes 🛑 Icon oder Badge "Blocked by #123".

---

## 🧩 Modifizierte Dateien

### Schema & Libs

| Datei                                            | Zweck              | ~Zeilen |
| ------------------------------------------------ | ------------------ | ------- |
| `libs/pg-sync/src/db/schema/tickets.ts`          | Tabelle hinzufügen | +15     |
| `libs/pg-sync/src/actions/dependency-actions.ts` | CRUD Actions       | ~100    |

### UI Komponenten

| Datei                                                 | Zweck           | ~Zeilen |
| ----------------------------------------------------- | --------------- | ------- |
| `apps/web/src/app/projects/[slug]/graph/page.tsx`     | Page Route      | ~20     |
| `apps/web/src/components/views/dependency-graph.tsx`  | Graph View      | ~150    |
| `apps/web/src/components/tickets/dependency-list.tsx` | Liste im Dialog | ~60     |

---

## ✅ Abschlusskriterien

- [ ] Schema-Migration für `ticket_dependencies` erstellt
- [ ] Action zum Hinzufügen/Löschen funktioniert
- [ ] Kreis-Erkennung (Cycle Detection) implementiert
- [ ] React Flow View zeigt Tickets als Nodes
- [ ] Kanten zeigen Richtung der Abhängigkeit an (Pfeilspitzen)
- [ ] Ticket-Dialog erlaubt Hinzufügen von Blockern
- [ ] Board-Ansicht markiert blockierte Tickets visuell

---

## 🔗 Referenzen

- [React Flow Docs](https://reactflow.dev/)
- `phase-2.1-ticket-creation.md` (Ticket Entität)
