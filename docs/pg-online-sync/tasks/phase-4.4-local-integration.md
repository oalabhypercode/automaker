# Phase 4.4: Local Feature Integration

ULTRATHINK

> **Projekt:** Automaker Offline-First + Postgres Online-Sync
> **Phase:** 4.4 - Local Feature Integration
> **Stand:** 2026-01-09
> **Status:** ✅ IMPLEMENTIERT
> **Abhängigkeit:** Phase 4.1, 4.2 (Pull-Route und UI müssen funktionieren)

---

## 🎯 Ziel der Phase

Die **kritische Brücke** bauen: Tickets aus Postgres als lokale `.automaker/features/*.json` Dateien speichern, damit sie im lokalen Kanban-Board erscheinen.

**Problem:** Selbst wenn Pull funktioniert, landen die Tickets nirgendwo lokal!

---

## 🖥️ Konkretes Beispiel

```
🖥️ Kunde erstellt Ticket auf Public Board (/p/finance-dashboard)
   └── Ticket wird in Postgres gespeichert

🔄 Mitarbeiter klickt "Sync from Remote"
   └── Server holt Tickets aus Postgres
   └── Server schreibt feature.json Dateien
   └── UI refresht lokales Board

📋 Mitarbeiter sieht Ticket im lokalen Board (/board)
   └── Ticket erscheint in "Backlog" Spalte
   └── Mitarbeiter kann Ticket bearbeiten
```

---

## 🔗 Abhängigkeiten & Voraussetzungen

### Existierende Strukturen

| Struktur       | Pfad                                         | Beschreibung           |
| -------------- | -------------------------------------------- | ---------------------- |
| Feature-Ordner | `.automaker/features/{id}/`                  | Pro Feature ein Ordner |
| Feature-JSON   | `.automaker/features/{id}/feature.json`      | Feature-Daten          |
| Feature-Loader | `apps/server/src/services/feature-loader.ts` | Lädt Features          |

### Lokale Feature-Struktur (Ziel)

```
.automaker/
└── features/
    └── {featureId}/
        ├── feature.json      ← Muss erstellt werden!
        ├── agent-output.md   ← Optional
        └── images/           ← Optional
```

---

## 🚀 Strategie

### Daten-Mapping: Postgres → Lokal

```
┌─────────────────────────────────┐      ┌─────────────────────────────────┐
│ Postgres Ticket (RemoteTicket)  │      │ Lokales Feature (feature.json)  │
├─────────────────────────────────┤      ├─────────────────────────────────┤
│ id: "uuid-..."                  │  →   │ id: "uuid-..." (gleich!)        │
│ title: "Neues Feature"          │  →   │ title: "Neues Feature"          │
│ description: "..."              │  →   │ description: "..."              │
│ status: "todo"                  │  →   │ status: "todo"                  │
│ priority: "high"                │  →   │ priority: 1 (gemappt)           │
│ labels: ["bug", "urgent"]       │  →   │ labels: ["bug", "urgent"]       │
│ createdBy: "customer@..."       │  →   │ metadata.createdBy: "..."       │
│ createdAt: "2026-01-09T..."     │  →   │ createdAt: "2026-01-09T..."     │
│ localId: null                   │  →   │ remoteId: "uuid-..." (NEU!)     │
└─────────────────────────────────┘      └─────────────────────────────────┘
```

---

## ❓ Edge Cases & Proaktive F&A

### ✅ Was passiert, wenn Feature-Ordner nicht existiert?

- Ordner erstellen: `mkdir -p .automaker/features/{id}/`
- feature.json schreiben

### ✅ Was passiert, wenn Feature lokal bereits existiert?

- Prüfen via `remoteId` oder `localId` Mapping
- Bei Match: Update oder Skip (konfigurierbar)
- Bei keinem Match: Neues Feature erstellen

### ✅ Was passiert mit Attachments/Bildern?

- Phase 1: Nur Text-Daten synchronisieren
- Später: Supabase Storage URLs in lokale Dateien konvertieren

### ✅ Was passiert mit gelöschten Remote-Tickets?

- Lokale Features bleiben erhalten (Soft-Delete)
- Optional: Flag setzen `syncDeleted: true`

### ✅ Wie wird Status gemappt?

| Remote Status | Lokal Status                     |
| ------------- | -------------------------------- |
| `backlog`     | `backlog`                        |
| `todo`        | `todo`                           |
| `in_progress` | `in-progress`                    |
| `review`      | `review` oder `waiting_approval` |
| `done`        | `done` oder `verified`           |
| `archived`    | `archived`                       |

### ✅ Wie wird Priority gemappt?

| Remote Priority | Lokal Priority (Zahl) |
| --------------- | --------------------- |
| `urgent`        | 0                     |
| `high`          | 1                     |
| `medium`        | 2                     |
| `low`           | 3                     |

---

## 📋 Implementierungs-Tasks

### Task 1: FeatureWriter Service

**Datei:** `apps/server/src/services/feature-writer.ts` **~200 Zeilen**

**Zweck:** Remote-Tickets als lokale feature.json Dateien schreiben

**API:**

```typescript
interface WriteFeatureOptions {
  projectPath: string; // z.B. "/home/user/projects/finance"
  ticket: RemoteTicket; // Postgres-Ticket
  overwriteExisting?: boolean; // Default: false
}

interface WriteFeatureResult {
  success: boolean;
  featureId: string;
  action: 'created' | 'updated' | 'skipped';
  path: string;
}

// Funktionen
export async function writeFeatureFromTicket(
  options: WriteFeatureOptions
): Promise<WriteFeatureResult>;
export async function writeMultipleFeaturesFromTickets(
  projectPath: string,
  tickets: RemoteTicket[]
): Promise<WriteFeatureResult[]>;
```

**Funktionalität:**

- Ordner erstellen wenn nötig
- feature.json schreiben
- Mapping remote → lokal
- Duplikat-Check via remoteId

---

### Task 2: ID-Mapping System

**Datei:** `apps/server/src/services/sync-id-mapper.ts` **~100 Zeilen**

**Zweck:** Bidirektionales Mapping zwischen Remote-IDs und Local-IDs

**Speicherort:** `.automaker/sync-mapping.json`

```typescript
interface SyncMapping {
  projectId: string; // Postgres Project ID
  mappings: Array<{
    localId: string; // Lokale Feature-ID
    remoteId: string; // Postgres Ticket-ID
    lastSyncAt: string; // ISO Timestamp
    syncDirection: 'push' | 'pull';
  }>;
  lastPullAt: string | null;
  lastPushAt: string | null;
}
```

**Funktionen:**

```typescript
export async function loadSyncMapping(projectPath: string): Promise<SyncMapping | null>;
export async function saveSyncMapping(projectPath: string, mapping: SyncMapping): Promise<void>;
export function findLocalIdByRemoteId(mapping: SyncMapping, remoteId: string): string | null;
export function findRemoteIdByLocalId(mapping: SyncMapping, localId: string): string | null;
```

---

### Task 3: Feature-Type Erweiterung

**Datei:** `libs/types/src/feature.ts` **~20 Zeilen Erweiterung**

**Neue Felder für Feature-Interface:**

```typescript
interface Feature {
  // ... existierende Felder ...

  // NEU: Sync-Metadaten
  remoteId?: string; // Postgres Ticket-ID
  syncedAt?: string; // Letzter Sync-Zeitpunkt
  syncSource?: 'local' | 'remote';
}
```

---

### Task 4: Pull-Route Integration

**Datei:** `apps/server/src/routes/pg-sync/pull.ts` **~50 Zeilen Erweiterung**

**Änderungen:**

- Nach Ticket-Abruf: `writeMultipleFeaturesFromTickets()` aufrufen
- Sync-Mapping aktualisieren
- Ergebnis mit Statistiken zurückgeben

---

### Task 5: Feature-Loader Cache Invalidation

**Datei:** `apps/server/src/services/feature-loader.ts` **~20 Zeilen**

**Änderungen:**

- Event emittieren wenn neue Features geschrieben wurden
- UI kann dann neu laden

---

## 🔧 Wiederverwendung

### Aus existierendem Code:

| Modul                 | Funktion          | Verwendung         |
| --------------------- | ----------------- | ------------------ |
| `feature-loader.ts`   | Feature-Struktur  | Format verstehen   |
| `lib/secure-fs.ts`    | File-Operations   | Sicheres Schreiben |
| `@automaker/platform` | `getFeatureDir()` | Pfade              |

### Aus libs/pg-sync:

| Modul             | Type           | Verwendung |
| ----------------- | -------------- | ---------- |
| `ticket.types.ts` | `RemoteTicket` | Input-Type |
| `sync.types.ts`   | Sync-Types     | Mapping    |

---

## 📊 Geschätzte Komplexität

| Task                             | Zeilen   | Komplexität |
| -------------------------------- | -------- | ----------- |
| Task 1: FeatureWriter Service    | ~200     | Hoch        |
| Task 2: ID-Mapping System        | ~100     | Mittel      |
| Task 3: Feature-Type Erweiterung | ~20      | Niedrig     |
| Task 4: Pull-Route Integration   | ~50      | Mittel      |
| Task 5: Cache Invalidation       | ~20      | Niedrig     |
| **Gesamt**                       | **~390** | **Hoch**    |

---

## ✅ Akzeptanzkriterien

1. [x] Remote-Tickets werden als lokale feature.json gespeichert
2. [x] Ordnerstruktur `.automaker/features/{id}/` wird korrekt erstellt
3. [x] ID-Mapping funktioniert bidirektional
4. [x] Duplikate werden erkannt und nicht doppelt erstellt
5. [x] Status und Priority werden korrekt gemappt
6. [x] Nach Sync erscheinen Tickets im lokalen Board
7. [x] TypeScript-Check erfolgreich (Server: `npx tsc -p apps/server/tsconfig.json --noEmit`)

---

## 📂 Datei-Struktur nach Sync

```
project/
└── .automaker/
    ├── features/
    │   ├── abc-123/                    ← Existierend (lokal erstellt)
    │   │   └── feature.json
    │   ├── def-456/                    ← NEU (von Postgres gepullt)
    │   │   └── feature.json
    │   └── ghi-789/                    ← NEU (von Kunde erstellt)
    │       └── feature.json
    ├── sync-mapping.json               ← NEU: ID-Mapping
    └── settings.json
```

---

## 📝 Notizen für Implementierung

- **KRITISCH:** Feature-ID beibehalten wenn möglich (UUID aus Postgres)
- **KRITISCH:** Keine Überschreibung von lokal geänderten Features ohne Warnung
- `remoteId` Feld erlaubt späteren 2-Wege-Sync
- `syncedAt` Feld für Konflikt-Erkennung

---

## 🔗 Nach Abschluss aller Phase 4 Tasks

### Kompletter Sync-Flow funktioniert:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Lokales       │     │    Postgres     │     │   Public        │
│   Board         │ ←→  │    Datenbank    │ ←→  │   Board         │
│   (/board)      │     │                 │     │   (/p/slug)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
       ↑                        ↑                       ↑
       │                        │                       │
    Mitarbeiter            Zentrale              Kunden
    arbeitet lokal         Quelle                erstellen Tickets
```

---

**🎉 Nach Phase 4.4 ist der vollständige Sync-Zyklus implementiert!**
