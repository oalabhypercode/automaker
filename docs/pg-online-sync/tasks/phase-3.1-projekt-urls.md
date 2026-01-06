# 🌐 Phase 3.1: Öffentliche Projekt-URLs

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 0.2 (Supabase), Phase 1.1 (Datenmodell)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Einrichtung der **öffentlichen Routing-Struktur** für Kunden-Boards und Implementierung der **Projekt-Slugs**.
Kunden sollen über eine sprechende URL (z.B. `app.domain.com/p/mein-projekt`) auf ihr Board zugreifen können.

Wichtige Aspekte:

- URL-Struktur `/p/[projectSlug]`
- Slug-Generierung & Einzigartigkeit
- Middleware für Routing & Erste Checks
- 404-Handling bei ungültigen Slugs

---

## ❓ Proaktive F&A

### Q1: Warum Slugs statt UUIDs in der URL?

✅ **User Experience & Professionalität:**
URLs wie `/p/launch-2025` wirken professioneller und sind leichter zu teilen als `/p/550e8400-e29b-41d4-a716-446655440000`.

### Q2: Wann wird der Slug generiert?

✅ **Bei Projekterstellung:**
Er wird aus dem Projektnamen generiert (z.B. "Website Relaunch" -> "website-relaunch"). Falls vergeben, wird ein Zähler angehängt. Der Slug soll später auch änderbar sein (mit Warnung).

### Q3: Läuft das über dieselbe Next.js App?

✅ **Ja, im selben Frontend-Monolith:**
Wir nutzen Next.js Dynamic Routes.

- `/board/*` -> Interne Ansicht (Mitarbeiter)
- `/p/*` -> Public Ansicht (Kunden)

---

## 🏛️ Architektur & Datenfluss

### Routing-Logik

```
Request: GET /p/marketing-q1
      │
      ▼
┌──────────────┐
│  Middleware  │ Checks:
│  (Next.js)   │ 1. Ist Pfad /p/*?
└──────┬───────┘ 2. Existiert Slug in DB? (Cachebar)
       │
       ▼
┌──────────────┐      ┌──────────────┐
│ Page Component│ ──► │  Postgres DB │
│ [projectSlug] │     │ (via Actions)│
└──────────────┘      └──────────────┘
       │
       ▼
  Render Layout
 (Public Variant)
```

---

## 📋 Anforderungen

### Datenmodell Erweiterung (bereits in Phase 1.1 geplant/vorbereitet)

| Feld        | Typ     | Constraints   | Beschreibung                          |
| ----------- | ------- | ------------- | ------------------------------------- |
| `slug`      | text    | UNIQUE, INDEX | URL-freundliche ID (kebab-case)       |
| `is_public` | boolean | DEFAULT false | Ob das Board überhaupt öffentlich ist |

### Slug-Logik

1. **Normalisierung:** Lowercase, Spaces zu Bindestrichen, Sonderzeichen entfernen.
2. **Uniqueness:** Check gegen DB vor Insert/Update.
3. **Reservierte Wörter:** `admin`, `api`, `login`, `setup` dürfen keine Slugs sein.

### Routing

- **Pfad:** `apps/web/app/(public)/p/[slug]/page.tsx`
- **Layout:** `apps/web/app/(public)/layout.tsx` (Ohne Sidebar, reduzierter Header)

---

## 💻 Implementation Details

### 1. Action: `getProjectBySlug`

Datei: `libs/pg-sync/src/finders/project-finder.ts`

```typescript
export async function getProjectBySlug(slug: string) {
  const project = await db.query.projects.findFirst({
    where: (projects, { eq, and }) =>
      and(
        eq(projects.slug, slug),
        eq(projects.isPublic, true) // Wichtig!
      ),
    // Nur öffentliche Felder holen
    columns: {
      id: true,
      name: true,
      description: true,
      slug: true,
      logoUrl: true,
    },
  });

  return project;
}
```

### 2. Utility: `generateSlug`

Datei: `libs/pg-sync/src/utils/slug-generator.ts`

```typescript
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
// + Uniqueness Check Logic in Action
```

### 3. Next.js Page Structure

Datei: `apps/web/src/app/(public)/p/[slug]/page.tsx`

```tsx
export default async function PublicBoardPage({ params }: Props) {
  const project = await getProjectBySlug(params.slug);

  if (!project) {
    notFound(); // Zeigt 404 Seite
  }

  // Check Auth (kommt in Phase 3.2)
  // if (project.hasPassword && !session.isAuthenticated) { ... }

  return (
    <div className="public-board-container">
      <PublicHeader project={project} />
      <PublicKanbanBoard projectId={project.id} />
    </div>
  );
}
```

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                         | Zweck                     | ~Zeilen |
| --------------------------------------------- | ------------------------- | ------- |
| `apps/web/src/app/(public)/p/[slug]/page.tsx` | Entry Point Public Board  | ~50     |
| `apps/web/src/app/(public)/layout.tsx`        | Layout für Kunden (Clean) | ~60     |
| `libs/pg-sync/src/utils/slug-generator.ts`    | Helper                    | ~30     |

### Erweiterungen (Shared Lib)

| Datei                                         | Zweck                    | ~Zeilen |
| --------------------------------------------- | ------------------------ | ------- |
| `libs/pg-sync/src/finders/project-finder.ts`  | `getProjectBySlug` Query | +20     |
| `libs/pg-sync/src/actions/project-actions.ts` | Create/Update mit Slug   | +40     |

---

## ✅ Abschlusskriterien

- [ ] Projekte haben einen einzigartigen `slug` in der DB.
- [ ] Utility zur Slug-Generierung ist implementiert und getestet.
- [ ] Route `/p/[slug]` ist erreichbar.
- [ ] Ungültige Slugs führen zu einer schönen 404-Seite.
- [ ] Nur Projekte mit `is_public: true` sind aufrufbar.
- [ ] Öffentliches Layout unterscheidet sich vom Internen (keine Sidebar etc.).

---

## 🔗 Referenzen

- `GLOBAL-TASKLIST.md` (URL Struktur)
- `phase-1.1-datenmodell.md` (Project Table)
