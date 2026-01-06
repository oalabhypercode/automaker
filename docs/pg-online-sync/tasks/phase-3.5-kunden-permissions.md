# 🛡️ Phase 3.5: Kunden-Permissions & Views

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 3.1 - 3.4
> **Geschätzte Komplexität:** Hoch

---

## 🎯 Ziel dieser Phase

Fein-granulare **Konfiguration der Kunden-Sichtbarkeit**.
Nicht jedes Projekt soll gleich offen sein. Wir brauchen Settings, um zu steuern, was Kunden sehen und tun dürfen.

Wichtige Aspekte:

- Projekt-Einstellungen UI (Intern)
- Permissions Flags (`allow_create`, `show_done_column` etc.)
- View-Logik im Backend (damit unsichtbare Dinge gar nicht erst geladen werden)

---

## ❓ Proaktive F&A

### Q1: Was sind typische Einstellungen?

- **Public Visibility:** Ein/Aus
- **Password Protection:** Ein/Aus
- **Allow Ticket Creation:** Dürfen Kunden Tickets schreiben?
- **Show Comments:** Sind Kommentare (die nicht intern markiert sind) sichtbar?

### Q2: Wo wird das konfiguriert?

✅ **Im Internen Board:**
Ein neuer Settings-Reiter "Kunden-Zugang" im Projekt-Dashboard.

---

## 🏛️ Architektur & Datenmodell

### `project_settings` Tabelle (oder JSONB Feld)

Um flexibel zu bleiben, eignet sich ein JSONB Feld in der `projects` Tabelle oder eine 1:1 Tabelle. Wir nehmen JSONB `public_settings` für Flexibilität.

```json
// projects.public_settings (JSONB)
{
  "theme": "dark",
  "allow_ticket_creation": true,
  "show_comments": false,
  "visible_columns": ["todo", "in_progress", "done"],
  "intro_message": "Willkommen im Roadmap Board!"
}
```

### Filtering Strategy

Die Finder-Funktionen (aus Phase 3.3) müssen dieses JSONB lesen und filtern.

```typescript
// Pseudocode
if (!settings.show_comments) {
  // lade keine Kommentare
}
```

---

## 📋 Anforderungen

### Konfigurierbare Optionen

| Option                 | Default          | Beschreibung                     |
| ---------------------- | ---------------- | -------------------------------- |
| `enabled`              | false            | Ist das Public Board aktiv?      |
| `allow_create`         | true             | Button "Neues Ticket" anzeigen?  |
| `show_comments_public` | false            | Öffentliche Kommentare anzeigen? |
| `visible_statuses`     | ['todo', 'done'] | Welche Spalten werden gezeigt?   |

### Settings UI (Intern)

- Toggle Switches für die Optionen.
- Textfeld für "Willkommensnachricht".
- Passwort-Reset Button.
- Link zum Board (Copy to Clipboard).

---

## 💻 Implementation Details

### 1. DB Schema Update

Datei: `libs/pg-sync/src/db/schema.ts`

```typescript
export const projects = pgTable('projects', {
  // ...
  publicSettings: jsonb('public_settings').default({}),
  // ...
});
```

### 2. Action: `updateProjectPublicSettings`

Datei: `libs/pg-sync/src/actions/project-actions.ts`
Implementiert `PATCH` Logic für das JSON.

### 3. UI: `PublicAccessSettingsPanel`

Datei: `apps/web/src/components/settings/public-access-settings-panel.tsx`
Integration in die bestehenden Projekt-Settings.

### 4. Enforcement in Views

Anpassung von `page.tsx` und Findern aus Phase 3.3/3.4, um die Settings zu respektieren.
Z.B. `createTicket` Button ausblenden, wenn `allow_create: false`.

---

## 🧩 Modifizierte Dateien

### Neue Dateien

| Datei                                                               | Zweck    | ~Zeilen |
| ------------------------------------------------------------------- | -------- | ------- |
| `apps/web/src/components/settings/public-access-settings-panel.tsx` | Admin UI | ~150    |

### Updates

| Datei                                         | Zweck                 | ~Zeilen |
| --------------------------------------------- | --------------------- | ------- |
| `libs/pg-sync/src/db/schema.ts`               | JSONB Feld            | +5      |
| `apps/web/src/app/(public)/p/[slug]/page.tsx` | Conditional Rendering | +20     |
| `libs/pg-sync/src/finders/ticket-finder.ts`   | Filter Logic          | +20     |

---

## ✅ Abschlusskriterien

- [ ] Projekt-Settings haben einen "Public Access" Tab.
- [ ] Einstellungen werden in DB gespeichert (JSONB).
- [ ] Änderungen wirken sich sofort auf das Public Board aus (z.B. Button verschwindet).
- [ ] Sicherheit: Backend validiert Permissions (API lässt Ticket-Create nicht zu, wenn disabled).

---

## 🔗 Referenzen

- `phase-3.x` alle vorigen
