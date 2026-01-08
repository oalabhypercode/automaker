# 🔌 Integration Guide: pg-sync in Automaker

> **Version:** 1.0
> **Stand:** 2026-01-07
> **Status:** ✅ Aktiv

---

## 🎯 Übersicht

Dieses Dokument beschreibt, wie das `@automaker/pg-sync` Package in das bestehende Automaker-System integriert wird – **ohne den Kern-Code zu verändern**.

---

## 🏗️ Architektur-Prinzipien

### Minimale Änderungen am Kern-Code

Das pg-sync Package folgt dem **Plugin-Architektur-Prinzip**:

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTOMAKER (Bestehend)                       │
├─────────────────────────────────────────────────────────────┤
│  Kern-Code bleibt UNVERÄNDERT                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  libs/pg-sync/ (Plugin - registriert sich selbst)   │    │
│  │  ├── Event-Listener für bestehende Events           │    │
│  │  ├── Eigene Routes unter /api/pg-sync/*             │    │
│  │  └── Module Augmentation für Types                  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Vorteile dieser Architektur

1. **Keine Merge-Konflikte** bei Upstream-Updates
2. **Feature-Flag gesteuert** - kann jederzeit deaktiviert werden
3. **Lose Kopplung** - pg-sync kann unabhängig entwickelt werden
4. **Einfaches Testing** - bestehende Tests bleiben unverändert

---

## 🔧 Integration-Schritte

### Schritt 1: Package installieren

Das Package ist bereits im Monorepo unter `libs/pg-sync/`.

```bash
# Im Root des Projekts
npm install
```

### Schritt 2: Environment-Variablen

Erstelle eine `.env` Datei in `libs/pg-sync/` (oder nutze die globale `.env`):

```env
# Postgres/Supabase Verbindung
DATABASE_URL=postgres://user:pass@host:5432/dbname

# Feature-Flag (optional, default: false)
SYNC_ENABLED=true
```

### Schritt 3: Server-Integration (4 Zeilen!)

In `apps/server/src/index.ts` am Ende hinzufügen:

```typescript
// Am Ende, nach allen bestehenden Routes:
import { registerPgSyncRoutes } from '@automaker/pg-sync';

if (process.env.SYNC_ENABLED === 'true') {
  registerPgSyncRoutes(app);
}
```

### Schritt 4: Event-Listener registrieren

```typescript
import { initPgSyncListeners } from '@automaker/pg-sync';

// Beim App-Start (nach DB-Verbindung)
if (process.env.SYNC_ENABLED === 'true') {
  await initPgSyncListeners();
}
```

---

## 📦 Exports des Packages

### Database Exports

```typescript
import {
  // Client Factory
  getDb, // Drizzle DB-Instanz
  getSql, // Raw postgres.js Client

  // Utilities
  testConnection, // Verbindungstest
  getConfigInfo, // Config-Informationen
  closeConnections, // Verbindungen schließen
  resetClients, // Clients zurücksetzen

  // Config Validation
  validateEnv, // Environment prüfen
} from '@automaker/pg-sync';
```

### Type Exports

```typescript
import type {
  // DB Config Types
  DatabaseConfig,
  SyncConfig,
  ValidatedEnv,

  // API Types
  ApiResponse,
  ApiError,

  // Sync Types
  SyncOperationStatus,
  SyncResult,

  // Entity Types (ab Phase 0.4)
  Project,
  ProjectSettings,
  User,
  ProjectMember,
  Ticket,
  TicketEvent,
  SyncState,
} from '@automaker/pg-sync';
```

---

## 🔌 Integration Patterns

### Pattern 1: Event-basierte Integration

Das Sync-System reagiert auf Events aus dem Kern-System:

```
Feature erstellt (lokal)
        │
        ▼ Event: 'feature:created'
        │
        ▼ pg-sync Listener
        │
        ▼ In Outbox-Queue
        │
        ▼ Nächster Sync → Postgres
```

**Implementierung:**

```typescript
// libs/pg-sync/src/sync/event-listener.ts
import { EventEmitter } from '@automaker/core';

export function initPgSyncListeners() {
  EventEmitter.on('feature:created', async (feature) => {
    await queueForSync('created', feature);
  });

  EventEmitter.on('feature:updated', async (feature) => {
    await queueForSync('updated', feature);
  });
}
```

### Pattern 2: Route-Plugin

Alle pg-sync Routes sind unter `/api/pg-sync/` isoliert:

```
/api/pg-sync/
├── /sync           # Push/Pull Endpoints
├── /projects       # Projekt-CRUD
├── /tickets        # Ticket-CRUD
└── /health         # Health-Check
```

### Pattern 3: Module Augmentation

Bestehende Types werden erweitert, ohne sie zu ändern:

```typescript
// libs/pg-sync/src/types/augmentation.ts
declare module '@automaker/types' {
  interface Feature {
    // Neue optionale Felder
    syncId?: string;
    lastSyncedAt?: string;
    syncStatus?: 'synced' | 'pending' | 'conflict';
  }
}
```

---

## 🚦 Feature-Flag System

### SYNC_ENABLED

Steuert, ob das Sync-System aktiv ist:

| Wert                    | Verhalten                                      |
| ----------------------- | ---------------------------------------------- |
| `true`                  | Sync aktiv, Routes registriert, Listener aktiv |
| `false` / nicht gesetzt | Sync deaktiviert, keine Auswirkung auf Kern    |

### Verwendung im Code

```typescript
// Server-seitig
const isSyncEnabled = process.env.SYNC_ENABLED === 'true';

// Client-seitig (via Config)
import { getSyncConfig } from '@automaker/pg-sync';
const { enabled } = getSyncConfig();
```

---

## 🧪 Testing

### Verbindungstest

```typescript
import { testConnection } from '@automaker/pg-sync';

async function checkConnection() {
  const result = await testConnection();

  if (result.success) {
    console.log(`✅ DB verbunden! Latenz: ${result.latencyMs}ms`);
  } else {
    console.error(`❌ Verbindung fehlgeschlagen: ${result.error}`);
  }
}
```

### Unit Tests

```bash
# Nur pg-sync Tests
cd libs/pg-sync
npm test

# TypeScript Check
npx tsc --noEmit
```

---

## 📁 Dateistruktur

```
libs/pg-sync/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── .env.example
├── docs/
│   ├── INTEGRATION-GUIDE.md    # Diese Datei
│   └── MERGE-STRATEGY.md       # Upstream-Updates
├── src/
│   ├── index.ts                # Public Exports
│   ├── types/                  # Type-Definitionen
│   ├── db/                     # Drizzle Client & Schema
│   ├── finders/                # DB Queries
│   ├── actions/                # DB Mutations
│   ├── sync/                   # Push/Pull Services
│   └── routes/                 # Express Routes
└── tests/
```

---

## ⚠️ Wichtige Hinweise

### DO's ✅

- Feature-Flag nutzen für bedingte Aktivierung
- Alle neuen Routes unter `/api/pg-sync/` Prefix
- Module Augmentation für Type-Erweiterungen
- Event-basierte Kommunikation

### DON'Ts ❌

- Bestehende Dateien im Kern-Code ändern
- Direkten Import in Kern-Komponenten
- Sync-Logik in bestehende Services einbauen
- Hardcoded DB-Credentials

---

## 🔗 Weiterführende Dokumentation

- `MERGE-STRATEGY.md` - Upstream-Update Anleitung
- `GLOBAL-TASKLIST.md` - Projektübersicht
- `phase-*.md` - Detaillierte Phasen-Dokumentation

---

**📌 Bei Fragen:** Diese Dokumentation aktualisieren!
