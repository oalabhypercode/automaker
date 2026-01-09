# 📊 Phase 5.5: Board Column Redesign

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** ✅ IMPLEMENTIERT
> **Priorität:** MITTEL - Visuelles Polish
> **Geschätzte Zeilen:** ~90 implementiert

---

## 🚨 Problem-Beschreibung

### IST-Zustand:

```
┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
│ ● TODO        (1) │  │ ● IN PROGRESS (0) │  │ ● DONE        (0) │
│                   │  │                   │  │                   │
│ ┌───────────────┐ │  │ No tickets right  │  │ No tickets right  │
│ │ Ticket Card   │ │  │ now.              │  │ now.              │
│ └───────────────┘ │  │                   │  │                   │
└───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Probleme:

1. Langweilige Spalten-Header
2. Kein visueller Unterschied zwischen Spalten
3. Empty-State nicht ansprechend
4. Keine Hover-Effekte auf Spalten

---

## 🎯 SOLL-Zustand (Design-Vision)

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ ░░░░░ Subtle Glow ░░░│  │ ░░░░░░░░░░░░░░░░░░░░│  │ ░░░░░░░░░░░░░░░░░░░░│
│                      │  │                      │  │                      │
│  🔵 TODO         1   │  │  🟡 IN PROGRESS  0   │  │  🟢 DONE         0   │
│  ────────────────    │  │  ────────────────    │  │  ────────────────    │
│                      │  │                      │  │                      │
│  ┌────────────────┐  │  │  ┌────────────────┐  │  │  ┌────────────────┐  │
│  │  Ticket Card   │  │  │  │   📭           │  │  │  │   📭           │  │
│  │  (Glasmorph)   │  │  │  │   Noch keine   │  │  │  │   Noch keine   │  │
│  └────────────────┘  │  │  │   Tickets      │  │  │  │   Tickets      │  │
│                      │  │  └────────────────┘  │  │  └────────────────┘  │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

---

## 📋 Implementierungs-Plan

### Schritt 1: Column-Container mit Glasmorphism

```tsx
<div
  key={column.id}
  className={cn('min-w-[280px] max-w-[340px] flex-1', 'relative overflow-hidden')}
>
  {/* Column Card */}
  <div
    className={cn(
      'h-full rounded-2xl',
      'bg-black/30 backdrop-blur-sm',
      'border border-white/10',
      'p-4'
    )}
  >
    {/* Subtle Top-Glow basierend auf Status */}
    <div
      className={cn(
        'absolute top-0 left-1/2 -translate-x-1/2',
        'w-[200px] h-[100px] rounded-[100%] blur-[60px]',
        'pointer-events-none',
        COLUMN_GLOW_COLORS[column.id]
      )}
      style={{ opacity: 0.15 }}
    />

    {/* Header */}
    <div className="relative z-10">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-3 w-3 rounded-full',
              'ring-2 ring-offset-2 ring-offset-black/50',
              column.colorClass
            )}
          />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{column.title}</h2>
        </div>
        <Badge
          variant="muted"
          size="sm"
          className={cn(
            'min-w-[24px] justify-center',
            columnTickets.length > 0 && COLUMN_BADGE_COLORS[column.id]
          )}
        >
          {columnTickets.length}
        </Badge>
      </div>

      {/* Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />

      {/* Tickets */}
      <div className="space-y-3">
        {columnTickets.length === 0 ? (
          <EmptyColumnState searchQuery={searchQuery} />
        ) : (
          columnTickets.map((ticket) => <PublicTicketCard key={ticket.id} ticket={ticket} />)
        )}
      </div>
    </div>
  </div>
</div>
```

### Schritt 2: Verbesserte Column-Farben

```typescript
const COLUMN_GLOW_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  archived: 'bg-gray-500',
};

const COLUMN_BADGE_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  todo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};
```

### Schritt 3: Empty State Component

```tsx
function EmptyColumnState({ searchQuery }: { searchQuery?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'py-8 px-4 rounded-xl',
        'bg-white/5 border border-dashed border-white/10'
      )}
    >
      <div className="text-2xl mb-2">📭</div>
      <p className="text-sm text-muted-foreground text-center">
        {searchQuery ? 'Keine Tickets gefunden' : 'Noch keine Tickets'}
      </p>
      {searchQuery && (
        <p className="text-xs text-muted-foreground/70 mt-1 text-center">
          Versuche eine andere Suche
        </p>
      )}
    </div>
  );
}
```

### Schritt 4: Horizontal Scroll Verbesserung

```tsx
{
  /* Board Container */
}
<section className="mt-8">
  {/* Scroll Indicators (optional) */}
  <div className="relative">
    <div
      className={cn(
        'flex gap-4 overflow-x-auto pb-4',
        'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
        'snap-x snap-mandatory md:snap-none'
      )}
    >
      {columns.map((column) => (
        <div key={column.id} className="snap-start md:snap-none">
          {/* Column Content */}
        </div>
      ))}
    </div>
  </div>
</section>;
```

---

## 🎨 Responsive Design

### Desktop (≥768px):

- Alle Spalten nebeneinander
- Horizontal scroll nur bei vielen Spalten
- Größere Paddings

### Mobile (<768px):

- Snap-Scrolling durch Spalten
- Eine Spalte dominant sichtbar
- Kleinere Paddings
- Touch-friendly Spacing

```tsx
// Mobile-optimierte Spaltenbreite
className = 'min-w-[85vw] md:min-w-[280px] max-w-[90vw] md:max-w-[340px]';
```

---

## 🧩 Betroffene Dateien

| Datei                                                        | Änderung                       | ~Zeilen |
| ------------------------------------------------------------ | ------------------------------ | ------- |
| `apps/ui/src/components/public-board/public-board-view.tsx`  | Spalten-Container refactor     | ~100    |
| `apps/ui/src/components/public-board/empty-column-state.tsx` | NEU (optional, inline möglich) | ~30     |

**Gesamt: ~130 Zeilen**

---

## ⚡ Edge Cases

### 1. Nur 1-2 Spalten sichtbar

```tsx
// Spalten sollten sich bei wenigen stretchen
className={cn(
  columns.length <= 2 && "md:min-w-[350px]"
)}
```

### 2. Viele Tickets in einer Spalte

```tsx
// Max-Height mit Scroll
<div className="space-y-3 max-h-[60vh] overflow-y-auto">
  {columnTickets.map(...)}
</div>
```

### 3. Sehr lange Spalten-Titel (falls customizable)

```tsx
<h2 className="text-sm font-semibold uppercase tracking-wide truncate max-w-[150px]">
  {column.title}
</h2>
```

---

## ✅ Akzeptanzkriterien

- [x] Spalten haben subtilen Status-Glow
- [x] Badge zeigt Count mit Status-Farbe (wenn > 0)
- [x] Gradient-Separator unter Header
- [x] Ansprechender Empty-State
- [x] Snap-Scrolling auf Mobile
- [x] Smooth horizontal scroll auf Desktop
- [x] Consistent spacing zwischen Tickets
- [x] TypeScript-Check erfolgreich

---

## 🔗 Abhängigkeiten

- **Phase 5.2** (Ticket Card Redesign) sollte vorher abgeschlossen sein
- Nutzt die gleichen Farb-Konstanten wie Cards

---

## 📚 Referenzen

- `shared-docs/design/liquid-glass-guide.md` - Design-System
- `shared-docs/CODING-RULES.md` Regel 7.6 - Mobile-First
