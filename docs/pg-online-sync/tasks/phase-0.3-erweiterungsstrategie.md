# 🔧 Phase 0.3: Erweiterungsstrategie für minimale Merge-Konflikte

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 0.1, 0.2
> **Geschätzte Komplexität:** Hoch (Architektur-kritisch)

---

## 🎯 Ziel dieser Phase

Definieren, WIE der bestehende Automaker-Code erweitert wird, ohne:

- Bestehende Dateien stark zu verändern
- Merge-Konflikte bei Upstream-Updates zu verursachen
- Die Offline-Funktionalität zu beeinträchtigen

---

## ❓ Proaktive F&A

### Q1: Was sind die kritischen Integration-Points?

✅ **Identifizierte Stellen:**

- `apps/server/src/index.ts` - Route-Registrierung
- `apps/server/src/services/` - Event-Emitter
- `apps/ui/src/routes/` - Neue UI-Routes
- `libs/types/` - Erweiterung der Types

### Q2: Wie vermeiden wir Änderungen am Kern-Code?

✅ **Plugin/Hook-Architektur:**

- Neues Package registriert sich selbst
- Event-basierte Kommunikation
- Lazy-Loading für neue Komponenten

### Q3: Was passiert bei Konflikten?

✅ **Konflikt-Kategorien:**

- **Harmlos:** package.json Dependencies → Manuell mergen
- **Mittel:** Type-Erweiterungen → Module Augmentation
- **Kritisch:** Struktur-Änderungen → Selten, dann anpassen

### Q4: Wie testen wir beide Modi (Offline/Online)?

✅ **Test-Strategie:**

- Feature-Flag `SYNC_ENABLED` schaltet Online-Features
- Alle bestehenden Tests müssen weiter funktionieren
- Neue Tests nur für neue Funktionalität

### Q5: Was wenn Upstream breaking Changes macht?

✅ **Breaking-Change-Handling:**

- GitHub Actions prüft automatisch auf Konflikte
- Semantic Versioning beachten
- Adapter-Pattern für kritische APIs

---

## 🔄 Erweiterungs-Patterns

### Pattern 1: Event-basierte Integration ✅ (PRIMÄR)

**Konzept:**

```
Bestehend:                    Erweiterung:
┌─────────────────┐          ┌─────────────────┐
│ FeatureService  │          │ PgSyncService   │
│                 │  Event   │                 │
│ emit('created') │ ──────► │ on('created')   │
│                 │          │ → syncToDb()    │
└─────────────────┘          └─────────────────┘
```

**Vorteile:**

- Keine Änderung am bestehenden Code
- Lose Kopplung
- Einfach zu testen

**Umsetzung:**

- Bestehende Services emittieren bereits Events
- Neues Package registriert Listener beim App-Start
- Listener-Registrierung in separater Datei

---

### Pattern 2: Route-Plugin-System

**Konzept:**

```
apps/server/src/index.ts (MINIMAL ÄNDERN):
─────────────────────────────────────────
// Am Ende, nach allen bestehenden Routes:
import { registerPgSyncRoutes } from '@automaker/pg-sync';
if (process.env.SYNC_ENABLED === 'true') {
  registerPgSyncRoutes(app);
}
─────────────────────────────────────────
Das sind NUR 4 Zeilen Änderung!
```

**Neue Routes bleiben isoliert:**

```
libs/pg-sync/src/routes/
├── index.ts           # registerPgSyncRoutes()
├── sync.routes.ts     # /api/sync/*
├── project.routes.ts  # /api/projects/*
└── ticket.routes.ts   # /api/tickets/*
```

---

### Pattern 3: Type-Erweiterung via Module Augmentation

**Konzept:**

```
// libs/pg-sync/src/types/augmentation.ts
declare module '@automaker/types' {
  interface Feature {
    // Neue optionale Felder für Sync
    syncId?: string;
    lastSyncedAt?: string;
    syncStatus?: 'synced' | 'pending' | 'conflict';
  }
}
```

**Vorteile:**

- Keine Änderung an `@automaker/types`
- TypeScript erkennt erweiterte Types
- Bei Upstream-Update: Keine Konflikte

---

### Pattern 4: UI-Erweiterung via Lazy Routes

**Konzept:**

```
apps/ui/src/routes/
├── __root.tsx           # Bestehend (NICHT ÄNDERN)
├── _index.tsx           # Bestehend
├── board.tsx            # Bestehend
└── _online/             # NEU: Lazy-loaded
    ├── sync.tsx
    ├── projects.tsx
    └── admin.tsx
```

**Umsetzung:**

- Neue Routes in Unterordner
- TanStack Router lädt lazy
- Kein Einfluss auf bestehende Routes

---

## 📋 Konkrete Änderungs-Stellen

### Minimale Änderungen am bestehenden Code

| Datei                      | Änderung              | Zeilen |
| -------------------------- | --------------------- | ------ |
| `apps/server/src/index.ts` | Route-Plugin Import   | +4     |
| `apps/server/package.json` | Dependency hinzufügen | +1     |
| `apps/ui/package.json`     | Dependency hinzufügen | +1     |
| `package.json` (root)      | Workspace hinzufügen  | +1     |
| `tsconfig.json`            | Path-Alias hinzufügen | +1     |

**TOTAL: ~8 Zeilen Änderung am bestehenden Code!**

---

### Neue Dateien (alles in libs/pg-sync/)

```
libs/pg-sync/
├── package.json                    # Package-Definition
├── tsconfig.json                   # TypeScript-Config
├── src/
│   ├── index.ts                    # Public Exports
│   ├── types/
│   │   ├── index.ts
│   │   ├── project.types.ts
│   │   ├── ticket.types.ts
│   │   ├── sync.types.ts
│   │   └── augmentation.ts         # Module Augmentation
│   ├── db/
│   │   ├── client.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   ├── finders/
│   │   ├── project-finder.ts
│   │   ├── ticket-finder.ts
│   │   └── event-finder.ts
│   ├── actions/
│   │   ├── project-actions.ts
│   │   ├── ticket-actions.ts
│   │   └── sync-actions.ts
│   ├── sync/
│   │   ├── push-service.ts
│   │   ├── pull-service.ts
│   │   ├── conflict-resolver.ts
│   │   └── event-listener.ts       # Registriert Event-Handlers
│   ├── routes/
│   │   ├── index.ts                # registerPgSyncRoutes()
│   │   ├── sync.routes.ts
│   │   ├── project.routes.ts
│   │   └── ticket.routes.ts
│   └── hooks/
│       ├── use-sync.ts
│       └── use-projects.ts
└── tests/
    ├── sync.test.ts
    └── integration.test.ts
```

---

## 🔌 Integration-Checkliste

### Server-Integration

1. **Route-Registrierung:**
   - Funktion `registerPgSyncRoutes(app: Express)` exportieren
   - Alle neuen Routes unter `/api/pg-sync/` Prefix
   - Middleware für Auth/Logging integrieren

2. **Event-Listener:**
   - Funktion `initPgSyncListeners()` beim App-Start aufrufen
   - Listener für: feature:created, feature:updated, feature:deleted
   - Async Queue für nicht-blockierendes Syncing

3. **Service-Integration:**
   - Optional: `PgSyncService` als Singleton
   - Methoden: `push()`, `pull()`, `getStatus()`

### UI-Integration

1. **Route-Erweiterung:**
   - Neue Routes in `_online/` Ordner
   - Lazy-Loading über TanStack Router
   - Guard für `SYNC_ENABLED` Check

2. **Store-Erweiterung:**
   - Neuer Zustand: `syncStatus`, `lastSyncTime`
   - Actions: `triggerPush`, `triggerPull`
   - Selektoren für Sync-State

3. **Komponenten-Erweiterung:**
   - Sync-Status-Indicator (Toolbar)
   - Push/Pull-Buttons
   - Conflict-Resolution-Dialog

---

## 📱 Konkrete Beispiele

### Beispiel: Event-Listener registrieren

```
🚀 App startet
📥 initPgSyncListeners() wird aufgerufen
🔗 Listener registriert für 'feature:created'
🔗 Listener registriert für 'feature:updated'
✅ Sync-System bereit

📝 User erstellt Feature lokal
📡 Event 'feature:created' wird emittiert
🔄 Listener fängt Event
📤 Feature wird in Outbox-Queue gelegt
⏰ Nächster Sync pusht zur DB
```

### Beispiel: Upstream-Update integrieren

```
$ git fetch upstream
$ git merge upstream/main

Konflikte:
  - package.json (1 Zeile - Dependency)
  ✅ Einfach zu lösen: Beide Dependencies behalten

$ npm install
$ npm run build
✅ Alles funktioniert!
```

---

## ⚡ Edge Cases & Risiken

### Edge Case 1: Upstream ändert Event-System

**Problem:** Events haben andere Payload-Struktur
**Lösung:** Adapter-Layer zwischen Events und Sync

```
EventAdapter:
├── Prüft Event-Version
├── Transformiert Payload wenn nötig
└── Einheitliches Format für Sync-Service
```

### Edge Case 2: Feature-Type bekommt neue Pflichtfelder

**Problem:** Neue Felder in @automaker/types
**Lösung:** Module Augmentation macht Felder optional

```
// Sync-System behandelt fehlende Felder
if (!feature.newField) {
  feature.newField = defaultValue;
}
```

### Edge Case 3: Route-Konflikt mit Upstream

**Problem:** Upstream fügt Route hinzu, die wir auch nutzen
**Lösung:** Alle unsere Routes haben Prefix `/api/pg-sync/`

---

## 🧩 Komponenten dieser Phase

### Dokumentation zu erstellen

| Dokument               | Zweck                     | ~Zeilen |
| ---------------------- | ------------------------- | ------- |
| `INTEGRATION-GUIDE.md` | Anleitung für Entwickler  | ~200    |
| `MERGE-STRATEGY.md`    | Upstream-Update Anleitung | ~100    |

### Code-Patterns zu dokumentieren

- Event-Listener Registration Pattern
- Route-Plugin Pattern
- Type-Augmentation Pattern
- Feature-Flag Pattern

---

## ✅ Abschlusskriterien

- [ ] Alle Integration-Points dokumentiert
- [ ] Minimale Änderungen definiert (<10 Zeilen)
- [ ] Event-Listener Pattern getestet
- [ ] Route-Plugin Pattern getestet
- [ ] Merge-Strategie dokumentiert

---

## 🔗 Referenzen

- `temp-pg-online-supabase.md` - Original-Anforderungen
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `phase-0.1-architektur-entscheidung.md` - Architektur
- `phase-0.2-postgres-setup.md` - DB-Setup

---

**📌 Nächste Phase:** 0.4 - Shared Types & Interfaces
