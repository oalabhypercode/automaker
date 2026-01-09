# 💎 Phase 5.4: Ticket Detail Dialog Redesign

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** ✅ Implementiert
> **Priorität:** MITTEL - UX-Verbesserung
> **Geschätzte Zeilen:** ~200-250
> **Implementiert:** 2026-01-09

---

## 🚨 Problem-Beschreibung

### IST-Zustand (Screenshot):

```
┌─────────────────────────────────────────────────────┐
│  test [Todo]                                   [X]  │
│  Ticket #1DA89B1C · Updated Jan 9, 2026            │
│─────────────────────────────────────────────────────│
│  ** 📄 Erstellt von:** tester                      │
│  ** 📁 Kategorie:** ✨ Feature                     │
│  ---                                               │
│  tested                                            │
│                                                    │
│  Attachments                                       │
│  ┌─────────────────────────────────────┐          │
│  │ 🖼️ KFZ-Lindner_Logo.png            │          │  ← Bild kaputt
│  │ [                          ]        │          │
│  │ KFZ-Lindner_Logo.png                │          │
│  └─────────────────────────────────────┘          │
│                                                    │
│  Created Jan 9, 2026                               │
└─────────────────────────────────────────────────────┘
```

### Probleme:

1. Kein Premium-Design (kein Glow, keine Depth)
2. Markdown-Syntax sichtbar
3. Bilder kaputt
4. Kein visueller Fokus auf wichtige Infos
5. Langweiliges Layout

---

## 🎯 SOLL-Zustand (Design-Vision)

```
┌─────────────────────────────────────────────────────┐
│  ░░░░░░░░ TOP-GLOW (violet) ░░░░░░░░░░░░░░░░░░░░░░ │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
├─────────────────────────────────────────────────────┤
│                                                     │
│  🎫 test                          [🔵 Todo]         │
│  #1DA89B1C                                          │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ 👤 tester  ·  ✨ Feature  ·  vor 2 Stunden  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ─────────────────────────────────────────────────  │
│                                                     │
│  tested                                             │
│                                                     │
│  📎 Anhänge                                         │
│  ┌──────────────┐  ┌──────────────┐                │
│  │ [Bild laden] │  │ [Bild laden] │                │
│  │              │  │              │                │
│  │ filename.png │  │ filename.png │                │
│  └──────────────┘  └──────────────┘                │
│                                                     │
│  ─────────────────────────────────────────────────  │
│  📅 Erstellt: 9. Januar 2026, 14:30 Uhr            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Implementierungs-Plan

### Schritt 1: Dialog-Shell mit Top-Glow

```tsx
<DialogContent
  className={cn(
    'relative overflow-hidden',
    'bg-black/80 backdrop-blur-xl',
    'border border-white/10',
    'max-w-xl'
  )}
>
  {/* Top Glow */}
  <div
    className={cn(
      'absolute top-[-15%] left-1/2 -translate-x-1/2',
      'w-[400px] h-[200px] rounded-[100%] blur-[80px]',
      'pointer-events-none',
      STATUS_GLOW_COLORS[ticket.status] // Dynamisch basierend auf Status
    )}
    style={{ opacity: 0.2 }}
  />

  {/* Grain Texture */}
  <div
    className="absolute inset-0 pointer-events-none"
    style={{
      backgroundImage: "url('https://grainy-gradients.vercel.app/noise.svg')",
      opacity: 0.05,
      mixBlendMode: 'overlay',
    }}
  />

  {/* Content */}
  <div className="relative z-10">...</div>
</DialogContent>
```

### Schritt 2: Header-Bereich

```tsx
<DialogHeader className="space-y-3">
  {/* Titel + Status */}
  <div className="flex items-start justify-between gap-3">
    <DialogTitle className="text-xl font-semibold">{ticket.title}</DialogTitle>
    <StatusBadge status={ticket.status} />
  </div>

  {/* Ticket-ID */}
  <div className="text-xs text-muted-foreground font-mono">#{shortId}</div>

  {/* Meta-Zeile */}
  <div
    className={cn('flex items-center gap-3 p-3 rounded-lg', 'bg-white/5 border border-white/10')}
  >
    {ticket.creatorName && (
      <div className="flex items-center gap-1.5 text-sm">
        <User className="h-4 w-4 text-muted-foreground" />
        <span>{ticket.creatorName}</span>
      </div>
    )}

    {ticket.category && (
      <>
        <span className="text-muted-foreground/50">·</span>
        <CategoryBadge category={ticket.category} />
      </>
    )}

    <span className="text-muted-foreground/50">·</span>
    <span className="text-sm text-muted-foreground">{formatRelativeTime(ticket.updatedAt)}</span>
  </div>
</DialogHeader>
```

### Schritt 3: Description-Bereich

```tsx
<Separator className="my-4 bg-white/10" />

<div className="space-y-2">
  {ticket.description ? (
    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
      {ticket.description}
    </p>
  ) : (
    <p className="text-sm text-muted-foreground italic">
      Keine Beschreibung vorhanden.
    </p>
  )}
</div>
```

### Schritt 4: Attachments-Galerie

```tsx
{
  attachments.length > 0 && (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <Paperclip className="h-4 w-4" />
        Anhänge ({attachments.length})
      </h4>

      <div className="grid gap-3 sm:grid-cols-2">
        {attachments.map((attachment) => (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              'group block rounded-xl overflow-hidden',
              'bg-white/5 border border-white/10',
              'hover:border-white/20 hover:bg-white/10',
              'transition-all duration-200'
            )}
          >
            <div className="aspect-video relative bg-black/20">
              <img
                src={attachment.url}
                alt={attachment.filename}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              {/* Fallback */}
              <div className="hidden absolute inset-0 flex items-center justify-center text-muted-foreground">
                <ImageIcon className="h-8 w-8" />
              </div>
            </div>
            <div className="p-2 text-xs text-muted-foreground truncate">{attachment.filename}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
```

### Schritt 5: Footer mit Erstellungsdatum

```tsx
<Separator className="my-4 bg-white/10" />

<div className="flex items-center gap-2 text-xs text-muted-foreground">
  <Calendar className="h-3.5 w-3.5" />
  <span>Erstellt: {formatFullDate(ticket.createdAt)}</span>
</div>
```

---

## 🎨 Status-Glow-Farben

```typescript
const STATUS_GLOW_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  archived: 'bg-gray-500',
};
```

---

## 🧩 Betroffene Dateien

| Datei                                                        | Änderung                          | ~Zeilen |
| ------------------------------------------------------------ | --------------------------------- | ------- |
| `apps/ui/src/components/public-board/public-ticket-card.tsx` | Dialog-Teil komplett überarbeiten | ~150    |
| `apps/ui/src/lib/format-date.ts`                             | formatFullDate Utility            | ~20     |

**Gesamt: ~170 Zeilen** (zusätzlich zu Phase 5.2)

---

## ⚡ Edge Cases

### 1. Sehr lange Descriptions

```tsx
<div className="max-h-[300px] overflow-y-auto">
  <p className="...">{ticket.description}</p>
</div>
```

### 2. Viele Attachments (>4)

```tsx
// Zeige erste 4, dann "Mehr anzeigen" Button
const visibleAttachments = showAll ? attachments : attachments.slice(0, 4);
```

### 3. Dialog auf Mobile

- Fullscreen-Dialog auf kleinen Screens
- Stapel-Layout statt Grid für Attachments

---

## ✅ Akzeptanzkriterien

- [x] Top-Glow basierend auf Status-Farbe
- [x] Grain-Texture für Premium-Effekt
- [x] Glasmorphism-Background
- [x] Meta-Zeile mit Creator, Kategorie, Zeit
- [x] Saubere Description ohne Markdown
- [x] Attachment-Galerie mit Hover-Effekten
- [x] Fallback bei kaputten Bildern
- [x] Mobile-responsive Layout
- [x] Smooth Open/Close Animation
- [x] TypeScript-Check erfolgreich

---

## 🔗 Abhängigkeiten

- **Phase 5.1** (Attachment URLs) muss vorher funktionieren
- **Phase 5.3** (Category System) für CategoryBadge
- Nutzt `CategoryBadge` aus Phase 5.2

---

## 📚 Referenzen

- `shared-docs/design/liquid-glass-guide.md` - Design-System
- `shared-docs/CODING-RULES.md` Regel 5.6 - Top-Glow Pattern
