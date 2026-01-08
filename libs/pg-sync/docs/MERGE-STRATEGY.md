# 🔄 Merge-Strategie: Upstream-Updates

> **Version:** 1.0
> **Stand:** 2026-01-07
> **Status:** ✅ Aktiv

---

## 🎯 Ziel

Definiert, wie Updates vom Original-Automaker-Repository (Upstream) in diesen Fork integriert werden – **ohne die pg-sync Erweiterungen zu verlieren**.

---

## 🏗️ Git-Setup

### Upstream Remote hinzufügen

```bash
# Einmalig: Upstream hinzufügen
git remote add upstream https://github.com/original/automaker.git

# Remotes prüfen
git remote -v
# origin    https://github.com/dein-fork/automaker.git (fetch)
# origin    https://github.com/dein-fork/automaker.git (push)
# upstream  https://github.com/original/automaker.git (fetch)
# upstream  https://github.com/original/automaker.git (push)
```

---

## 📋 Update-Workflow

### Schritt 1: Upstream fetchen

```bash
git fetch upstream
```

### Schritt 2: Änderungen vergleichen

```bash
# Was hat sich geändert?
git log main..upstream/main --oneline

# Detaillierte Änderungen
git diff main upstream/main
```

### Schritt 3: Merge durchführen

```bash
# Auf main wechseln
git checkout main

# Upstream mergen
git merge upstream/main
```

### Schritt 4: Konflikte lösen

```bash
# Konflikte anzeigen
git status

# Nach dem Lösen
git add .
git commit -m "merge: upstream/main"
```

---

## 🔧 Erwartete Konflikte

### Kategorie 1: Harmlos ✅

| Datei               | Lösung                           |
| ------------------- | -------------------------------- |
| `package.json`      | Beide Dependencies behalten      |
| `package-lock.json` | Neu generieren mit `npm install` |
| `tsconfig.json`     | Path-Aliases zusammenführen      |

**Beispiel package.json:**

```json
// Unser Fork
"dependencies": {
  "drizzle-orm": "^0.38.0",
  "postgres": "^3.4.5"
}

// Upstream
"dependencies": {
  "neue-lib": "^1.0.0"
}

// LÖSUNG: Alle behalten
"dependencies": {
  "drizzle-orm": "^0.38.0",
  "postgres": "^3.4.5",
  "neue-lib": "^1.0.0"
}
```

### Kategorie 2: Mittel ⚠️

| Datei                      | Problem             | Lösung                      |
| -------------------------- | ------------------- | --------------------------- |
| `apps/server/src/index.ts` | Route-Registrierung | Unsere 4 Zeilen beibehalten |
| Type-Definitionen          | Neue Felder         | Module Augmentation prüfen  |

### Kategorie 3: Kritisch 🔴

| Situation             | Lösung                     |
| --------------------- | -------------------------- |
| Event-System geändert | Adapter-Layer anpassen     |
| Breaking API Changes  | Migrations-Guide erstellen |
| Struktur-Änderungen   | Manuell anpassen           |

---

## 🛠️ Konflikt-Lösung Patterns

### Pattern 1: Dependencies zusammenführen

```bash
# Bei package.json Konflikten
git checkout --theirs package.json  # Upstream Version
# Dann manuell unsere Dependencies hinzufügen
```

### Pattern 2: Type-Konflikte

Wenn Upstream neue Felder zu Types hinzufügt:

```typescript
// Unsere augmentation.ts prüfen
// Evtl. redundante Felder entfernen
```

### Pattern 3: Route-Konflikte

Unsere Routes haben `/api/pg-sync/` Prefix → sollten nie kollidieren!

Falls doch:

```typescript
// Prefix anpassen
registerPgSyncRoutes(app, { prefix: '/api/pg-sync-v2/' });
```

---

## ✅ Post-Merge Checkliste

Nach jedem Upstream-Merge:

- [ ] `npm install` ausführen
- [ ] `npx tsc --noEmit` prüfen
- [ ] Tests ausführen
- [ ] pg-sync Funktionalität testen
- [ ] CHANGELOG.md aktualisieren

---

## 🚨 Notfall: Merge rückgängig machen

```bash
# Vor dem Commit
git merge --abort

# Nach dem Commit
git reset --hard HEAD~1
```

---

## 📅 Empfohlener Update-Rhythmus

| Häufigkeit           | Aktion                      |
| -------------------- | --------------------------- |
| Wöchentlich          | `git fetch upstream` prüfen |
| Monatlich            | Major Update mergen         |
| Bei Breaking Changes | Sofort evaluieren           |

---

**📌 Automatisierung:** GitHub Actions können automatisch auf Upstream-Änderungen prüfen und Benachrichtigungen senden.
