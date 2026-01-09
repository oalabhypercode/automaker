# 🎨 Phase 5.2: Ticket Card Redesign

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** ✅ Implementiert (2026-01-09)
> **Priorität:** HOCH - Hauptvisuelles Element
> **Implementierte Zeilen:** ~330

---

## 🚨 Problem-Beschreibung

### IST-Zustand:

```
┌─────────────────────────────────────┐
│  #1DA89B1C              [Todo]      │
│                                     │
│  test                               │
│  ** 📄 Erstellt von:** tester       │  ← Markdown sichtbar!
│  ** 📁 Kategorie:** ✨              │  ← Markdown sichtbar!
│  Feature --- tested                 │  ← Unstrukturiert
│                                     │
│  [🖼️ KFZ-]                          │  ← Bild kaputt
│  Updated Jan 9, 2026                │
└─────────────────────────────────────┘
```

### SOLL-Zustand:

```
┌─────────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Subtle Glasmorphism
│  #1DA89B1C              [🔵 Todo]   │  ← Farbiger Status-Badge
│                                     │
│  🎫 test                            │  ← Titel prominent
│                                     │
│  👤 tester  ·  ✨ Feature  ·  2h    │  ← Strukturierte Meta-Zeile
│                                     │
│  "tested"                           │  ← Saubere Description
│                                     │
│  📎 [Bild1] [Bild2]                 │  ← Funktionierende Bilder
└─────────────────────────────────────┘
```

---

## 🎯 Design-Konzept

### Glasmorphism Card (Liquid Glass):

```tsx
<Card
  className={cn(
    // Base - Deep Black
    'relative overflow-hidden',
    'bg-black/40 backdrop-blur-sm',
    'border border-white/10',
    'rounded-xl',
    // Hover Effect
    'hover:bg-black/50 hover:border-white/20',
    'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]',
    'transition-all duration-300'
  )}
>
  {/* Subtle Glow Corner */}
  <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 blur-2xl" />

  {/* Content */}
  <CardContent>...</CardContent>
</Card>
```

### Meta-Zeile Struktur:

```tsx
<div className="flex items-center gap-2 text-xs text-muted-foreground">
  {/* Creator */}
  <div className="flex items-center gap-1">
    <User className="h-3 w-3" />
    <span>{ticket.creatorName}</span>
  </div>

  <span className="text-muted-foreground/50">·</span>

  {/* Category Badge */}
  <CategoryBadge category={ticket.category} />

  <span className="text-muted-foreground/50">·</span>

  {/* Relative Time */}
  <span>{formatRelativeTime(ticket.updatedAt)}</span>
</div>
```

---

## 📋 Implementierungs-Plan

### Komponente 1: `public-ticket-card.tsx` Refactor (~250 Zeilen)

**Änderungen:**

1. **Card-Wrapper mit Glasmorphism**
2. **Strukturierte Header-Zeile** (ID + Status-Badge)
3. **Titel-Zeile** (ohne Emoji-Prefix)
4. **Meta-Zeile** (Creator + Category + Time)
5. **Description** (Markdown entfernt, nur Text)
6. **Attachments** (mit Fallback bei Fehler)

### Komponente 2: `category-badge.tsx` (NEU) (~50 Zeilen)

**Wiederverwendbare Kategorie-Badge:**

```tsx
interface CategoryBadgeProps {
  category: 'feature' | 'bug' | 'question';
  size?: 'sm' | 'md';
}

const CATEGORY_CONFIG = {
  feature: {
    icon: Sparkles,
    label: 'Feature',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
  bug: {
    icon: Bug,
    label: 'Bug',
    className: 'bg-red-500/20 text-red-400 border-red-500/30',
  },
  question: {
    icon: HelpCircle,
    label: 'Frage',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
};
```

### Komponente 3: `relative-time.ts` Utility (~30 Zeilen)

**Relative Zeitangaben:**

```typescript
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;

  return new Intl.DateTimeFormat('de', { dateStyle: 'short' }).format(date);
}
```

---

## 🧩 Betroffene Dateien

| Datei                                                        | Änderung            | ~Zeilen |
| ------------------------------------------------------------ | ------------------- | ------- |
| `apps/ui/src/components/public-board/public-ticket-card.tsx` | Kompletter Refactor | ~250    |
| `apps/ui/src/components/public-board/category-badge.tsx`     | NEU                 | ~50     |
| `apps/ui/src/lib/relative-time.ts`                           | NEU                 | ~30     |

**Gesamt: ~330 Zeilen**

---

## 🎨 CSS-Details

### Status-Badge Farben (verbessert):

```tsx
const STATUS_CONFIG = {
  backlog: {
    label: 'Backlog',
    className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  },
  todo: {
    label: 'Todo',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  review: {
    label: 'Review',
    className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  },
  done: {
    label: 'Done',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  },
};
```

### Hover-Animation:

```css
.ticket-card {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.ticket-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 30px -5px rgba(139, 92, 246, 0.3);
}
```

---

## ⚡ Edge Cases

### 1. Kein Creator-Name

```tsx
{
  ticket.creatorName ? (
    <div className="flex items-center gap-1">
      <User className="h-3 w-3" />
      <span>{ticket.creatorName}</span>
    </div>
  ) : null;
}
```

### 2. Keine Kategorie

```tsx
{
  ticket.category && <CategoryBadge category={ticket.category} />;
}
```

### 3. Sehr lange Description

```tsx
<p className="line-clamp-2 text-sm text-muted-foreground">{ticket.description}</p>
```

### 4. Attachment-Fehler

```tsx
<img
  src={attachment.url}
  alt={attachment.filename}
  onError={(e) => {
    e.currentTarget.src = '/placeholder-image.svg';
    e.currentTarget.onerror = null;
  }}
  className="..."
/>
```

---

## ✅ Akzeptanzkriterien

- [x] Kein Markdown mehr in der UI sichtbar
- [x] Creator-Name mit User-Icon angezeigt
- [x] Kategorie als farbiger Badge
- [x] Relative Zeitangaben ("vor 2h" statt "Jan 9, 2026")
- [x] Glasmorphism-Effekt auf Cards
- [x] Smooth Hover-Animation
- [x] Fallback bei kaputten Bildern
- [x] Mobile-responsive (kleinere Paddings auf Mobile)
- [x] TypeScript-Check erfolgreich

---

## 🔗 Abhängigkeiten

- **Phase 5.1** muss VORHER abgeschlossen sein (Attachment URLs fixen)
- Nutzt `CategoryBadge` aus dieser Phase

---

## 📚 Referenzen

- `shared-docs/design/liquid-glass-guide.md` - Glasmorphism-Richtlinien
- `shared-docs/CODING-RULES.md` Regel 5.4-5.7 - Design Patterns
