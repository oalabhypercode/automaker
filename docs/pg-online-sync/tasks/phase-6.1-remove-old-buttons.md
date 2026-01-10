# Phase 6.1: Sync-Buttons aus online-sync-view.tsx entfernen

ULTRATHINK

> **Status:** ✅ IMPLEMENTIERT
> **Priorität:** 🔴 KRITISCH
> **Abhängigkeit:** Keine
> **Entfernt:** ~208 Zeilen (773 → 565)

---

## 🎯 Ziel

Entferne die `ProjectSyncButtons` Komponente aus `online-sync-view.tsx`, da diese Buttons ins Kanban-Board (`/board`) gehören.

---

## 📋 Aufgaben

### 6.1.1 - ProjectSyncButtons Komponente entfernen

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx`

**Zu entfernen (Zeilen 249-443):**

```typescript
// ❌ ENTFERNEN: Die gesamte ProjectSyncButtons Funktion
function ProjectSyncButtons({ project }: { project: OnlineProject }) {
  // ... ~195 Zeilen Code
}
```

**Zusätzlich zu entfernen:**

1. Import-Statement für nicht mehr benötigte Hooks:

   ```typescript
   // ❌ ENTFERNEN aus imports:
   usePullFromRemote,
   usePullSyncStatus,
   usePushToRemote,
   usePullToLocal,
   ```

2. Import-Statement für nicht mehr benötigte Icons:

   ```typescript
   // ❌ ENTFERNEN aus imports:
   Download,
   RefreshCw,
   Upload,
   ```

3. Aufruf in `ProjectCard`:
   ```typescript
   // ❌ ENTFERNEN:
   <ProjectSyncButtons project={project} />
   ```

---

### 6.1.2 - ProjectCard anpassen

**Datei:** `apps/ui/src/components/views/online-sync-view.tsx`

**Aktuell (Zeile 234-237):**

```tsx
<CollapsibleContent>
  <CardContent className="pt-0 space-y-6">
    <ProjectSyncButtons project={project} /> // ← ENTFERNEN
    <ProjectSettingsPanel project={project} />
  </CardContent>
</CollapsibleContent>
```

**Nach Änderung:**

```tsx
<CollapsibleContent>
  <CardContent className="pt-0 space-y-6">
    <ProjectSettingsPanel project={project} />
  </CardContent>
</CollapsibleContent>
```

---

## ✅ Checkliste

- [x] `ProjectSyncButtons` Funktion entfernt (Zeilen 249-443)
- [x] Unnötige Imports entfernt (`usePullFromRemote`, `usePullSyncStatus`, `usePushToRemote`, `usePullToLocal`)
- [x] Unnötige Icon-Imports entfernt (`Download`, `RefreshCw`, `Upload`)
- [x] `<ProjectSyncButtons />` Aufruf aus `ProjectCard` entfernt
- [x] `npx tsc --noEmit` läuft ohne neue Fehler (vorbestehende Fehler unverändert)
- [ ] `/online-sync` Seite zeigt noch die Projekt-Settings (manuell verifizieren)

---

## 🔍 Verifikation

Nach Abschluss:

1. **Build-Check:** `npx tsc --noEmit`
2. **Visual-Check:** Öffne `http://localhost:3007/online-sync`
   - Projekt-Cards sollten noch funktionieren
   - Nur Settings-Panel sollte sichtbar sein (Public Access, Password, etc.)
   - Keine Sync-Buttons mehr in den Project-Cards

---

## ⚠️ Hinweise

### Was BLEIBT in online-sync-view.tsx:

- `OnlineSyncView` - Hauptkomponente
- `ProjectCard` - Projekt-Karten (ohne Sync-Buttons)
- `ProjectSettingsPanel` - Einstellungen für Public Access, Passwort, etc.
- Import-Button für lokale Projekte (in Empty-State)

### Was ENTFERNT wird:

- `ProjectSyncButtons` - Die 3 verwirrenden Sync-Buttons
- Zugehörige Hooks und Icons

---

## 📚 Referenzen

- `apps/ui/src/components/views/online-sync-view.tsx:249-443` - Zu entfernender Code
- `docs/pg-online-sync/tasks/phase-6.0-sync-button-fix.md` - Problem-Analyse

---

## 🚀 Nächster Schritt

Nach Abschluss → **Phase 6.2**: Integration der Sync-Buttons in `board-view.tsx`

```
Referenziere: docs/pg-online-sync/tasks/phase-6.2-board-integration.md
```
