# 🎨 Phase 5: Public Board UI/UX Redesign - ÜBERSICHT

ULTRATHINK

> **Erstellt:** 2026-01-09
> **Status:** 🟡 In Planung
> **Priorität:** HOCH - Kundenwahrnehmung kritisch

---

## 🚨 Problem-Analyse (Screenshots)

### IST-Zustand - Identifizierte Probleme:

| #   | Problem                                                                          | Schweregrad | Screenshot-Referenz  |
| --- | -------------------------------------------------------------------------------- | ----------- | -------------------- |
| 1   | **Attachments nicht sichtbar** - Bilder zeigen nur "KFZ-" statt Inhalt           | 🔴 KRITISCH | Ticket-Card + Dialog |
| 2   | **Markdown-Syntax sichtbar** - `** 📄 Erstellt von:** tester ** 📁 Kategorie:**` | 🔴 KRITISCH | Ticket-Card          |
| 3   | **Kein dediziertes Kategorie-Feld** - Kategorie als Teil der Description         | 🟠 HOCH     | Ticket-Card          |
| 4   | **Kein Creator-Badge** - Ersteller-Name nicht prominent                          | 🟠 HOCH     | Ticket-Card          |
| 5   | **Basic Design** - Keine Glasmorphism/Premium-Effekte                            | 🟡 MITTEL   | Gesamte View         |
| 6   | **Langweiliger Dialog** - Keine modernen Animationen                             | 🟡 MITTEL   | Ticket-Detail        |
| 7   | **Englisch/Deutsch Mix** - Inkonsistente Sprache                                 | 🟢 NIEDRIG  | Gesamte View         |

---

## 🎯 SOLL-Zustand (Design-Vision)

### Premium Public Board Konzept:

```
┌──────────────────────────────────────────────────────────────────┐
│  🏢 Projekt-Header mit Logo                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  [Logo]  AI Cutting Automaker                               │ │
│  │          "Premium Kanban für Kunden"                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  📝 Submit Request (Collapsible - wie jetzt, aber schöner)       │
│                                                                  │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                    │
│  │ 🔵 TODO   │  │ 🟡 IN     │  │ 🟢 DONE   │                    │
│  │    (1)    │  │ PROGRESS  │  │    (0)    │                    │
│  │           │  │    (0)    │  │           │                    │
│  │ ┌───────┐ │  │           │  │           │                    │
│  │ │Ticket │ │  │  Keine    │  │  Keine    │                    │
│  │ │ Card  │ │  │  Tickets  │  │  Tickets  │                    │
│  │ │(Modern)│ │  │           │  │           │                    │
│  │ └───────┘ │  │           │  │           │                    │
│  └───────────┘  └───────────┘  └───────────┘                    │
└──────────────────────────────────────────────────────────────────┘
```

### Moderne Ticket-Card (Glasmorphism):

```
┌─────────────────────────────────────────┐
│  #1DA89B1C                 [Todo Badge] │  ← Status-Badge mit Farbe
│                                         │
│  🎫 test                                │  ← Titel prominent
│                                         │
│  👤 tester  ·  ✨ Feature  ·  vor 2h    │  ← Creator + Kategorie + Zeit
│                                         │
│  "tested"                               │  ← Description (ohne Markdown)
│                                         │
│  📎 [Bild1] [Bild2]                     │  ← Attachments (funktionierende URLs)
└─────────────────────────────────────────┘
```

---

## 📋 Phase 5 - Unteraufgaben

| #   | Phase                 | Beschreibung                                         | Status   | Datei                                |
| --- | --------------------- | ---------------------------------------------------- | -------- | ------------------------------------ |
| 5.1 | Attachment URL Fix    | Signed URLs fixen, Supabase Policy prüfen            | 🔴 Offen | `phase-5.1-attachment-url-fix.md`    |
| 5.2 | Ticket Card Redesign  | Glasmorphism, Creator-Badge, Kategorie-Badge         | 🔴 Offen | `phase-5.2-ticket-card-redesign.md`  |
| 5.3 | Category System       | Kategorien aus Description extrahieren, eigenes Feld | 🔴 Offen | `phase-5.3-category-system.md`       |
| 5.4 | Ticket Detail Dialog  | Premium Dialog mit Top-Glow, Animationen             | 🔴 Offen | `phase-5.4-ticket-detail-dialog.md`  |
| 5.5 | Board Column Redesign | Moderne Spalten-Header, Hover-Effekte                | 🔴 Offen | `phase-5.5-board-column-redesign.md` |

---

## 🔍 Root-Cause-Analyse: Attachment-Problem

### Vermutete Ursachen:

1. **Signed URL abgelaufen** - Supabase Storage signed URLs haben TTL (Time To Live)
2. **Policy-Problem** - Bucket ist `private` statt `public` gestellt
3. **CORS-Problem** - Cross-Origin Request wird blockiert
4. **Falscher Bucket-Name** - URL zeigt auf `public-ticket-attachments`, aber Bucket heißt anders

### Lösungsansatz:

```typescript
// Option A: Längere TTL für signed URLs (1 Jahr)
const { data } = await supabase.storage
  .from('public-ticket-attachments')
  .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 Jahr

// Option B: Public Bucket Policy (empfohlen für Public Board)
// In Supabase Dashboard: Storage → Policies → Allow public read
```

---

## 🎨 Design-Richtlinien (aus CODING-RULES.md)

### Liquid Glass Design (Regel 5.4-5.7):

- **Tiefe:** `bg-black/40`, `backdrop-blur-xl`, `box-shadow` mit `inset`
- **Licht als Akzent:** `blur-[50px]` Punkt-Glows, Status-Farben
- **Muted Buttons:** `orange-500/20` statt `bg-orange-500`

### Top-Glow Pattern für Dialoge:

```tsx
{
  /* Radial Glow Spot - OBEN zentriert */
}
<div
  className={cn(
    'absolute top-[-15%] left-1/2 -translate-x-1/2',
    'w-[400px] h-[300px] rounded-[100%] blur-[80px]',
    'bg-violet-600'
  )}
  style={{ opacity: 0.25 }}
/>;
```

### Kategorie-Farben:

| Kategorie | Farbe   | Tailwind                                                   |
| --------- | ------- | ---------------------------------------------------------- |
| Feature   | Emerald | `bg-emerald-500/20 text-emerald-400 border-emerald-500/30` |
| Bug       | Red     | `bg-red-500/20 text-red-400 border-red-500/30`             |
| Question  | Blue    | `bg-blue-500/20 text-blue-400 border-blue-500/30`          |

---

## ⚡ Performance-Bedenken

### Mobile-First (Regel 7.6):

- Keine `backdrop-blur-*` auf Mobile (Capacitor deaktiviert es)
- Solide Fallback-Hintergründe: `bg-[#1a1a1a]` statt `bg-black/40`

### Lazy Loading:

- Bilder mit `loading="lazy"` (bereits vorhanden ✅)
- Skeleton-States für Loading

---

## 📁 Betroffene Dateien

```
apps/ui/src/components/public-board/
├── public-board-view.tsx       → Spalten-Redesign
├── public-ticket-card.tsx      → Card-Redesign + Dialog
├── public-ticket-form.tsx      → Minimal ändern
└── (NEU) category-badge.tsx    → Wiederverwendbare Kategorie-Badge

apps/server/src/routes/
└── pg-sync/public.ts           → Attachment URL-Logik prüfen

libs/pg-sync/src/
└── types/ticket.types.ts       → Category-Feld prüfen
```

---

## ✅ Akzeptanzkriterien (Gesamt Phase 5)

- [ ] Attachments werden korrekt angezeigt (keine kaputten Bilder)
- [ ] Keine Markdown-Syntax mehr in der UI sichtbar
- [ ] Kategorie als eigenes Badge angezeigt
- [ ] Creator-Name mit Icon/Avatar
- [ ] Relative Zeitangaben ("vor 2 Stunden")
- [ ] Glasmorphism-Design auf Ticket-Cards
- [ ] Premium-Dialog mit Top-Glow
- [ ] TypeScript-Check erfolgreich
- [ ] Mobile-responsive ohne Performance-Einbußen

---

## 📝 Nächster Schritt

**Phase 5.1: Attachment URL Fix** - Das kritischste Problem zuerst lösen!

```
Referenz: docs/pg-online-sync/tasks/phase-5.1-attachment-url-fix.md
```
