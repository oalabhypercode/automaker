# 📐 Phase 0.4: Shared Types & Interfaces

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 0.1, 0.2, 0.3
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

TypeScript Types und Interfaces definieren für:

- Datenmodell (Project, User, Ticket, Events)
- API-Responses und Requests
- Sync-Status und Konfiguration
- Module Augmentation für bestehende Types

---

## ❓ Proaktive F&A

### Q1: Eigenes Type-Package oder in pg-sync?

✅ **Empfehlung: In pg-sync Package**

- Alle Sync-relevanten Types in einem Ort
- Kein zusätzliches Package nötig
- Einfacher Import: `import { ProjectType } from '@automaker/pg-sync'`

### Q2: Wie erweitern wir bestehende Types?

✅ **Module Augmentation:**

- Bestehende Types bleiben unverändert
- Erweiterungen in separater Datei
- TypeScript merged automatisch

### Q3: Was ist mit Drizzle Schema Types?

✅ **Drizzle Integration:**

- Schema definiert DB-Struktur
- Types werden aus Schema inferiert
- Insert/Select Types automatisch generiert

### Q4: Wie halten wir Frontend/Backend Types synchron?

✅ **Shared Types:**

- Types in `libs/pg-sync/src/types/`
- Export über Package-Index
- Beide Apps importieren gleiche Types

### Q5: Was passiert bei Schema-Änderungen?

✅ **Migration-Strategie:**

- Drizzle Kit für Migrations
- Type-Änderungen automatisch reflektiert
- Breaking Changes dokumentieren

---

## 🔄 Type-Hierarchie

### Basis-Entitäten

```
┌────────────────────────────────────────────────────────────┐
│                      CORE ENTITIES                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Project ◄────────► ProjectMember ◄────────► User        │
│     │                                           │          │
│     │                                           │          │
│     ▼                                           ▼          │
│  Ticket ◄─────────► TicketEvent ◄────────► SyncState     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### Sync-Entitäten

```
┌────────────────────────────────────────────────────────────┐
│                      SYNC ENTITIES                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  SyncEvent                SyncState                        │
│  ├── id                   ├── clientId                     │
│  ├── type                 ├── lastPulledAt                 │
│  ├── entityType           ├── lastPushedAt                 │
│  ├── entityId             └── lastEventId                  │
│  ├── payload                                               │
│  └── createdAt            SyncConfig                       │
│                           ├── enabled                      │
│  OutboxItem               ├── autoSync                     │
│  ├── id                   ├── intervalMs                   │
│  ├── event                └── conflictStrategy             │
│  ├── status                                                │
│  └── retries                                               │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 📋 Type-Definitionen (Konzeptuell)

### 1. Project Types (`project.types.ts`)

**Entität: Project**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | string (UUID) | Primärschlüssel |
| name | string | Projektname |
| slug | string | URL-freundlicher Identifier |
| description | string? | Optionale Beschreibung |
| settings | ProjectSettings | Projekteinstellungen |
| createdAt | Date | Erstellungsdatum |
| updatedAt | Date | Letzte Änderung |

**Entität: ProjectSettings**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| customerAccessEnabled | boolean | Kunden-Board aktiv? |
| customerPassword | string? | Passwort für Kunden |
| defaultTicketStatus | TicketStatus | Standard-Status |
| syncEnabled | boolean | Sync für Projekt aktiv? |

---

### 2. User Types (`user.types.ts`)

**Entität: User**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | string (UUID) | Primärschlüssel |
| email | string | E-Mail (unique) |
| name | string | Anzeigename |
| role | GlobalRole | Globale Rolle |
| avatarUrl | string? | Profilbild |
| createdAt | Date | Erstellungsdatum |

**Enum: GlobalRole**

- `admin` - Systemadministrator
- `member` - Teammitglied
- `customer` - Kunde

**Entität: ProjectMember**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| projectId | string | Fremdschlüssel Project |
| userId | string | Fremdschlüssel User |
| role | ProjectRole | Rolle im Projekt |
| joinedAt | Date | Beitrittsdatum |

**Enum: ProjectRole**

- `owner` - Projektbesitzer
- `admin` - Projektadmin
- `member` - Teammitglied
- `viewer` - Nur Lesen

---

### 3. Ticket Types (`ticket.types.ts`)

**Entität: Ticket**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | string (UUID) | Primärschlüssel |
| projectId | string | Fremdschlüssel Project |
| title | string | Ticket-Titel |
| description | string? | Beschreibung (Markdown) |
| status | TicketStatus | Aktueller Status |
| priority | TicketPriority | Priorität |
| labels | string[] | Labels/Tags |
| createdBy | string | User-ID des Erstellers |
| claimedBy | string? | User-ID wer es bearbeitet |
| claimedAt | Date? | Wann geclaimed |
| completedAt | Date? | Wann abgeschlossen |
| createdAt | Date | Erstellungsdatum |
| updatedAt | Date | Letzte Änderung |

**Enum: TicketStatus**

- `backlog` - Im Backlog
- `todo` - Zu erledigen
- `in_progress` - In Bearbeitung (geclaimed)
- `review` - Im Review
- `done` - Abgeschlossen
- `archived` - Archiviert

**Enum: TicketPriority**

- `low` - Niedrig
- `medium` - Mittel
- `high` - Hoch
- `urgent` - Dringend

---

### 4. Event Types (`event.types.ts`)

**Entität: TicketEvent**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| id | string (UUID) | Primärschlüssel |
| ticketId | string | Fremdschlüssel Ticket |
| projectId | string | Fremdschlüssel Project |
| type | TicketEventType | Event-Typ |
| payload | EventPayload | Event-Daten |
| createdBy | string | User-ID |
| createdAt | Date | Timestamp |

**Enum: TicketEventType**

- `created` - Ticket erstellt
- `updated` - Ticket geändert
- `status_changed` - Status geändert
- `claimed` - Ticket geclaimed
- `unclaimed` - Claim aufgehoben
- `completed` - Abgeschlossen
- `comment_added` - Kommentar hinzugefügt
- `label_added` - Label hinzugefügt
- `label_removed` - Label entfernt

**EventPayload Varianten (Union Type):**

- StatusChangedPayload: { from, to }
- ClaimedPayload: { userId }
- CommentPayload: { content }
- UpdatedPayload: { changes: { field, from, to }[] }

---

### 5. Sync Types (`sync.types.ts`)

**Entität: SyncState**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| clientId | string | Eindeutige Client-ID |
| projectId | string | Projekt-Kontext |
| lastPulledAt | Date | Letzter Pull |
| lastPushedAt | Date | Letzter Push |
| lastEventId | string? | Letztes verarbeitetes Event |
| status | SyncStatus | Aktueller Status |

**Enum: SyncStatus**

- `idle` - Bereit
- `pushing` - Push läuft
- `pulling` - Pull läuft
- `error` - Fehler aufgetreten
- `offline` - Keine Verbindung

**Entität: SyncConfig**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| enabled | boolean | Sync aktiviert |
| autoSync | boolean | Automatischer Sync |
| intervalMs | number | Sync-Intervall |
| conflictStrategy | ConflictStrategy | Konflikt-Auflösung |

**Enum: ConflictStrategy**

- `local_wins` - Lokale Änderung gewinnt
- `remote_wins` - Remote-Änderung gewinnt
- `manual` - Manuelle Auflösung

---

### 6. API Types (`api.types.ts`)

**API Response Wrapper:**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| success | boolean | Erfolg? |
| data | T? | Payload bei Erfolg |
| error | ApiError? | Fehler bei Misserfolg |

**ApiError:**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| code | string | Fehlercode |
| message | string | Nachricht |
| details | unknown? | Zusätzliche Details |

**Pagination:**
| Feld | Typ | Beschreibung |
|------|-----|--------------|
| page | number | Aktuelle Seite |
| limit | number | Items pro Seite |
| total | number | Gesamtanzahl |
| hasMore | boolean | Weitere Seiten? |

---

### 7. Module Augmentation (`augmentation.ts`)

**Erweiterung von @automaker/types Feature:**
| Neues Feld | Typ | Beschreibung |
|------------|-----|--------------|
| syncId | string? | Remote-ID in Postgres |
| syncStatus | SyncStatus? | Sync-Zustand |
| lastSyncedAt | Date? | Letzte Synchronisation |
| remoteVersion | number? | Version auf Server |

---

## 📱 Konkrete Beispiele

### Beispiel: Ticket mit allen Types

```
🎫 Ticket erstellt:
├── id: "abc-123"
├── projectId: "proj-456"
├── title: "Login-Bug fixen"
├── status: "todo"
├── priority: "high"
├── createdBy: "user-789"
└── syncStatus: "pending"

📡 Event generiert:
├── type: "created"
├── ticketId: "abc-123"
├── payload: { title, status, ... }
└── createdAt: "2026-01-06T..."

🔄 Sync-State:
├── clientId: "client-001"
├── lastPushedAt: null (pending)
└── status: "idle"
```

### Beispiel: Module Augmentation Nutzung

```
// Irgendwo im bestehenden Code:
const feature: Feature = getFeature();

// Nach Augmentation verfügbar:
if (feature.syncStatus === 'synced') {
  console.log(`Synced at: ${feature.lastSyncedAt}`);
}
```

---

## ⚡ Type-Sicherheit

### Zod Schemas (optional aber empfohlen)

- Für API-Validierung
- Runtime Type-Checking
- Automatische Type-Inferenz

**Beispiel Schema:**

```
ProjectSchema definiert:
├── name: string, min 1, max 100
├── slug: string, regex für URL
├── description: string, optional, max 1000
└── settings: ProjectSettingsSchema
```

### Drizzle Schema → Types

- Types aus Schema inferieren
- Insert-Types automatisch
- Select-Types automatisch
- Relations typisiert

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                     | Zweck                | ~Zeilen |
| ----------------------------------------- | -------------------- | ------- |
| `libs/pg-sync/src/types/index.ts`         | Export aller Types   | ~30     |
| `libs/pg-sync/src/types/project.types.ts` | Project & Settings   | ~80     |
| `libs/pg-sync/src/types/user.types.ts`    | User & Member        | ~60     |
| `libs/pg-sync/src/types/ticket.types.ts`  | Ticket & Status      | ~120    |
| `libs/pg-sync/src/types/event.types.ts`   | Events & Payloads    | ~100    |
| `libs/pg-sync/src/types/sync.types.ts`    | Sync State & Config  | ~80     |
| `libs/pg-sync/src/types/api.types.ts`     | API Response/Request | ~60     |
| `libs/pg-sync/src/types/augmentation.ts`  | Module Augmentation  | ~30     |

**Gesamt: ~560 Zeilen Type-Definitionen**

---

## ✅ Abschlusskriterien

- [ ] Alle Core-Types definiert
- [ ] Module Augmentation funktioniert
- [ ] API-Types mit Zod validierbar
- [ ] Export über Package-Index
- [ ] TypeScript compiliert ohne Fehler
- [ ] Keine Konflikte mit bestehenden Types

---

## 🔗 Referenzen

- `temp-pg-online-supabase.md` - Datenmodell-Übersicht
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `phase-0.3-erweiterungsstrategie.md` - Integration-Patterns
- `@automaker/types` - Bestehende Types

---

**📌 Nächste Phase:** 1.1 - Datenmodell Design (Drizzle Schema)
