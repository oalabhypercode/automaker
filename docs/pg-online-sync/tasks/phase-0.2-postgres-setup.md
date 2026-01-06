# 🗄️ Phase 0.2: Postgres/Supabase Setup & Konfiguration

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 0.1 (Architektur-Entscheidung)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Postgres-Datenbank aufsetzen und konfigurieren für:

- Zentrale Datenspeicherung aller Projekte/Tickets
- Supabase oder Coolify als Hosting
- Sichere Verbindung von Lokal und Online-Clients
- Grundlegende Tabellen-Struktur

---

## ❓ Proaktive F&A

### Q1: Supabase oder selbst gehostetes Postgres (Coolify)?

✅ **Empfehlung: Supabase für Start, Coolify als Alternative**

- Supabase bietet: Auth, Realtime, Storage out-of-the-box
- Coolify bietet: Volle Kontrolle, keine Vendor-Lock-in
- Beide nutzen Postgres → Migration einfach

### Q2: Wie verbinden sich lokale Clients?

✅ **Verbindungs-Strategie:**

- Lokale App speichert Connection-String in `.env.local`
- Online-App nutzt Umgebungsvariablen
- Supabase Client SDK für einfache Integration

### Q3: Was ist mit Row-Level Security (RLS)?

✅ **RLS-Strategie:**

- Aktivieren für alle Tabellen
- Policies pro Rolle (Admin, Mitarbeiter, Kunde)
- Service-Key für Server-seitige Operationen

### Q4: Wie werden Secrets verwaltet?

✅ **Secret-Management:**

- `.env.local` für lokale Entwicklung (nicht committed)
- Umgebungsvariablen in Deployment-Plattform
- Supabase Service-Key nur server-seitig

### Q5: Backup-Strategie?

✅ **Backups:**

- Supabase: Automatische tägliche Backups
- Coolify: pg_dump Cron-Job einrichten
- Point-in-time Recovery für kritische Daten

---

## 🔄 Setup-Optionen

### Option A: Supabase Cloud ✅ (EMPFOHLEN für Start)

```
Vorteile:
├── Schnelles Setup (5 Min)
├── Eingebaute Auth
├── Realtime Subscriptions
├── Dashboard & SQL Editor
└── Generous Free Tier

Nachteile:
├── Vendor Lock-in (mitigierbar)
└── Latenz je nach Region
```

### Option B: Coolify Self-Hosted

```
Vorteile:
├── Volle Kontrolle
├── Keine Kosten (außer Server)
├── Eigene Region/Server
└── DSGVO-Compliance einfacher

Nachteile:
├── Mehr Setup-Aufwand
├── Eigene Wartung
└── Auth/Realtime selbst bauen
```

---

## 📋 Tasks für diese Phase

### Task 0.2.1: Supabase Projekt erstellen

**Ziel:** Neues Supabase-Projekt anlegen

**Schritte:**

1. Auf supabase.com einloggen/registrieren
2. Neues Projekt erstellen
3. Region wählen (EU für DSGVO)
4. Projekt-Name: `automaker-sync`
5. Starkes Datenbankpasswort generieren
6. Warten bis Projekt provisioniert

**Ergebnis:**

- Project URL: `https://xxxxx.supabase.co`
- Anon Key: `eyJhbGci...`
- Service Key: `eyJhbGci...` (geheim!)

---

### Task 0.2.2: Datenbank-Schema initial erstellen

**Ziel:** Grundlegende Tabellen für das Sync-System

**Tabellen (Übersicht):**

| Tabelle           | Zweck         | Wichtige Spalten                          |
| ----------------- | ------------- | ----------------------------------------- |
| `projects`        | Projekte      | id, name, slug, created_at                |
| `users`           | Benutzer      | id, email, name, role                     |
| `project_members` | Zuordnung     | project_id, user_id, role                 |
| `tickets`         | Tickets       | id, project_id, title, status, claimed_by |
| `ticket_events`   | History       | id, ticket_id, type, payload, created_at  |
| `sync_state`      | Sync-Tracking | client_id, last_sync_at, last_event_id    |

**Konzeptuelle Struktur (kein Code):**

- `projects`: Enthält alle Projekte mit eindeutigem Slug für URLs
- `users`: Benutzer mit Rollen (admin, member, customer)
- `project_members`: N:M Beziehung zwischen Projekten und Usern
- `tickets`: Kernentität mit Status und Claim-Tracking
- `ticket_events`: Event-Sourcing für History und Sync
- `sync_state`: Pro Client den letzten Sync-Stand

---

### Task 0.2.3: Row-Level Security (RLS) einrichten

**Ziel:** Sichere Datenbankzugriffe auf Zeilenebene

**Policies (konzeptuell):**

| Tabelle         | Policy | Beschreibung                                      |
| --------------- | ------ | ------------------------------------------------- |
| `projects`      | SELECT | User sieht nur Projekte, wo er Member ist         |
| `tickets`       | SELECT | User sieht nur Tickets seiner Projekte            |
| `tickets`       | UPDATE | User kann nur eigene Claims ändern                |
| `ticket_events` | INSERT | Jeder authentifizierte User kann Events erstellen |

**Rollen-Hierarchie:**

```
admin
├── Sieht alle Projekte
├── Kann alle Tickets bearbeiten
└── Kann User verwalten

member
├── Sieht zugewiesene Projekte
├── Kann Tickets claimen/bearbeiten
└── Kann neue Tickets erstellen

customer
├── Sieht nur sein Projekt
├── Kann eigene Tickets erstellen
└── Kann nur Status sehen (nicht bearbeiten)
```

---

### Task 0.2.4: Environment-Variablen konfigurieren

**Ziel:** Sichere Konfiguration für alle Umgebungen

**Neue Variablen:**

```
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci... (nur Server!)

# Sync-Konfiguration
SYNC_ENABLED=true
SYNC_INTERVAL_MS=3600000  # 1 Stunde
SYNC_AUTO_PUSH=true
SYNC_AUTO_PULL=true
```

**Dateien zu erstellen/erweitern:**

- `libs/pg-sync/.env.example` - Template für Entwickler
- `apps/server/.env.local` - Server-Konfiguration (nicht committed)
- `apps/ui/.env.local` - UI-Konfiguration (nicht committed)

---

### Task 0.2.5: Supabase Client einrichten

**Ziel:** Wiederverwendbaren Client für Datenbankzugriffe

**Komponenten (konzeptuell):**

- `createSupabaseClient()`: Factory für Browser/Server
- `createSupabaseAdmin()`: Admin-Client mit Service-Key
- Automatische Token-Refresh-Logik
- Error-Handling mit Retry

**Dateien zu erstellen:**

- `libs/pg-sync/src/db/client.ts` (~150 Zeilen)
- `libs/pg-sync/src/db/types.ts` (~50 Zeilen)

---

## 📱 Konkrete Beispiele

### Beispiel: Projekt-Setup in Supabase

```
🌐 Dashboard: Neues Projekt "automaker-sync"
📍 Region: eu-central-1 (Frankfurt)
🔑 Password: Generiert und sicher gespeichert
⏱️ Setup: ~2 Minuten Provisionierung
✅ Bereit: URL und Keys verfügbar
```

### Beispiel: Erste Tabelle erstellen

```
📊 SQL Editor in Supabase öffnen
📝 CREATE TABLE projects (...)
▶️ Run ausführen
✅ Tabelle erstellt
🔒 RLS aktivieren: ALTER TABLE projects ENABLE ROW LEVEL SECURITY
```

---

## ⚡ Performance & Sicherheit

### Sicherheits-Checkliste

- [ ] Service-Key NIEMALS im Frontend
- [ ] RLS für ALLE Tabellen aktiviert
- [ ] Starke Passwörter generiert
- [ ] .env.local in .gitignore
- [ ] CORS nur für eigene Domains

### Performance-Überlegungen

- Connection-Pooling aktivieren (Supabase hat PgBouncer)
- Indizes für häufige Queries (project_id, created_at)
- Batch-Inserts für Events statt Einzel-Inserts

---

## 🧩 Komponenten dieser Phase

### Neue Dateien (konzeptuell)

| Datei                           | Zweck                   | ~Zeilen |
| ------------------------------- | ----------------------- | ------- |
| `libs/pg-sync/src/db/client.ts` | Supabase Client Factory | ~150    |
| `libs/pg-sync/src/db/types.ts`  | DB-Typen (generated)    | ~50     |
| `libs/pg-sync/.env.example`     | Env-Template            | ~20     |

### Supabase Dashboard-Arbeit

- Projekt erstellen
- SQL-Migrations ausführen
- RLS-Policies einrichten
- Keys exportieren

---

## ✅ Abschlusskriterien

- [ ] Supabase-Projekt erstellt und erreichbar
- [ ] Alle Tabellen angelegt (leer, aber Schema steht)
- [ ] RLS-Policies aktiv
- [ ] Environment-Variablen dokumentiert
- [ ] Client-Setup getestet (einfacher Query funktioniert)

---

## 🔗 Referenzen

- `temp-pg-online-supabase.md` - Original-Anforderungen
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `phase-0.1-architektur-entscheidung.md` - Vorherige Phase
- Supabase Docs: https://supabase.com/docs

---

**📌 Nächste Phase:** 0.3 - Erweiterungsstrategie
