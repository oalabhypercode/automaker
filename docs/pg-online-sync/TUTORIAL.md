# 🚀 Automaker Online-Sync Tutorial

> **Stand:** 2026-01-08
> **Zielgruppe:** Entwickler, die das Kunden-Board + Supabase Storage einrichten möchten

---

## 📋 Inhaltsverzeichnis

1. [Schnellstart](#-schnellstart)
2. [Voraussetzungen](#-voraussetzungen)
3. [Supabase Setup](#-supabase-setup)
4. [Lokale Konfiguration](#-lokale-konfiguration)
5. [Projekt starten](#-projekt-starten)
6. [Kunden-Board testen](#-kunden-board-testen)
7. [Fehlerbehebung](#-fehlerbehebung)
8. [Q&A](#-qa)

> **Neu hier?** Lies zuerst den [Monorepo Guide](./MONOREPO-GUIDE.md) um zu verstehen wie Automaker aufgebaut ist.

---

## ⚡ Schnellstart

```bash
# 1. Repository klonen (falls noch nicht geschehen)
git clone <repo-url>
cd automaker

# 2. Dependencies installieren
npm install

# 3. Pakete bauen
npm run build:packages

# 4. ENV-Dateien anlegen (Details siehe unten)
cp apps/server/.env.example apps/server/.env
cp libs/pg-sync/.env.example libs/pg-sync/.env

# 5. Starten
npm run dev:web
```

---

## 📦 Voraussetzungen

| Tool    | Version | Prüfen mit      |
| ------- | ------- | --------------- |
| Node.js | 18+     | `node -v`       |
| npm     | 9+      | `npm -v`        |
| Git     | 2.30+   | `git --version` |

### Externe Services

- **Supabase Projekt** (kostenlos unter [supabase.com](https://supabase.com))
- **Postgres-Datenbank** (wird von Supabase bereitgestellt)

---

## 🗄️ Supabase Setup

### Schritt 1: Projekt erstellen

1. Gehe zu [supabase.com](https://supabase.com) → "New Project"
2. Wähle Region (z.B. `eu-central-1` für Deutschland)
3. Notiere dir:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **Service Role Key**: (unter Settings → API → service_role)

### Schritt 2: Storage Bucket anlegen

1. Gehe zu **Storage** im Supabase Dashboard
2. Klicke "New bucket"
3. Name: `public-ticket-attachments`
4. **Public bucket**: NEIN (wir nutzen Signed URLs)
5. Klicke "Create bucket"

### Schritt 3: Datenbank-Tabellen erstellen

Die Tabellen werden automatisch durch Drizzle Migrations erstellt. Falls du manuell migrieren möchtest:

```bash
cd libs/pg-sync
npm run db:migrate
```

> **Hinweis:** Die Migration erstellt alle notwendigen Tabellen (`projects`, `tickets`, `ticket_attachments`, etc.)

---

## ⚙️ Lokale Konfiguration

### Datei 1: `apps/server/.env`

```env
# ============================================
# REQUIRED
# ============================================
ANTHROPIC_API_KEY=sk-ant-...

# ============================================
# POSTGRES/SUPABASE DATABASE
# ============================================
# Hole die URL aus Supabase → Settings → Database → Connection String
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# ============================================
# SUPABASE STORAGE (für Kunden-Uploads)
# ============================================
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=public-ticket-attachments
SUPABASE_SIGNED_URL_TTL=3600

# ============================================
# SECURITY (WICHTIG für Production!)
# ============================================
JWT_SECRET=dein-super-sicheres-secret-min-32-zeichen

# ============================================
# SERVER
# ============================================
PORT=3008
CORS_ORIGIN=http://localhost:3007
```

### Datei 2: `libs/pg-sync/.env`

```env
# Postgres Connection String (gleich wie oben)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres

# Sync Konfiguration
SYNC_ENABLED=true
SYNC_INTERVAL_MS=3600000
SYNC_AUTO_PUSH=true
SYNC_AUTO_PULL=true
SYNC_CONFLICT_STRATEGY=remote_wins
```

---

## 🎬 Projekt starten

> **Tipp:** Für eine detaillierte Erklärung was die Commands machen und wie das Monorepo funktioniert, siehe [Monorepo Guide](./MONOREPO-GUIDE.md).

### Option A: Web-Browser (Empfohlen für Entwicklung)

```bash
npm run dev:web
```

Öffnet:

- **Frontend**: http://localhost:3007 (React + Vite)
- **Backend API**: http://localhost:3008 (Express + WebSocket)

### Option B: Electron Desktop App

```bash
npm run dev:electron
```

### Option C: Mit Debug-Konsole

```bash
npm run dev:electron:debug
```

---

## 🧪 Kunden-Board testen

### 1. Projekt mit Public Access erstellen

1. Öffne Automaker (http://localhost:3007)
2. Klicke in der Sidebar auf **"Online Sync"** (Globe Icon)
3. Du siehst alle online-synchronisierten Projekte
4. Klicke auf ein Projekt um es aufzuklappen
5. Aktiviere **"Public Access"** (Toggle)
6. Der Slug wird automatisch generiert (z.B. `mein-projekt`)
7. Optional: Passwort setzen für geschützten Zugang

### Verfügbare Einstellungen:

| Einstellung               | Beschreibung                                    |
| ------------------------- | ----------------------------------------------- |
| **Public Access**         | Ein/Aus Toggle für den öffentlichen Zugang      |
| **Public URL**            | Der Slug kann angepasst werden                  |
| **Password Protection**   | Optional: Passwort für Zugangsschutz            |
| **Allow Ticket Creation** | Ob Kunden Tickets erstellen dürfen              |
| **Show Comments**         | Öffentliche Kommentare anzeigen                 |
| **Visible Statuses**      | Welche Spalten sichtbar sind (klickbare Badges) |
| **Theme**                 | Dark/Light Theme für das Kunden-Board           |
| **Welcome Message**       | Optionale Begrüßungsnachricht                   |

### 2. Kunden-Board aufrufen

Öffne im Browser:

```
http://localhost:3007/p/mein-projekt
```

### 3. Ticket mit Bild erstellen

1. Im Kunden-Board: "Submit a request" klicken
2. Titel eingeben
3. Optional: Beschreibung hinzufügen
4. **Bilder hochladen** (Drag & Drop oder "browse files")
   - Max 4 Bilder
   - Max 5 MB pro Bild
   - Formate: JPG, PNG, GIF, WebP
5. "Submit ticket" klicken

### 4. Prüfen ob Upload funktioniert

- Das Ticket erscheint sofort im Board
- Bilder werden als Thumbnail angezeigt
- Klick auf Ticket → Detail-Dialog mit allen Bildern

---

## 🔧 Fehlerbehebung

### "Supabase storage is not configured"

**Problem:** Die Supabase ENV-Variablen fehlen oder sind falsch.

**Lösung:**

1. Prüfe `apps/server/.env`:
   ```env
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```
2. Service Role Key (nicht `anon` Key!) verwenden
3. Server neu starten

### "JWT_SECRET environment variable is required"

**Problem:** In Production-Modus ohne JWT_SECRET.

**Lösung:**

```env
JWT_SECRET=dein-super-sicheres-secret-mindestens-32-zeichen-lang
```

### "Upload failed" / Bilder werden nicht gespeichert

**Problem:** Storage Bucket existiert nicht oder falsche Berechtigungen.

**Lösung:**

1. Prüfe ob Bucket `public-ticket-attachments` in Supabase existiert
2. Prüfe ob der Service Role Key korrekt ist
3. Check Server-Logs: `npm run dev:web` und Konsole beobachten

### "Connection refused" bei Datenbank

**Problem:** DATABASE_URL ist falsch oder Firewall blockiert.

**Lösung:**

1. Supabase: Connection Pooler URL verwenden (Port 6543)
2. Bei selbst-gehostetem Postgres: IP-Whitelist prüfen
3. Connection String Format prüfen:
   ```
   postgresql://[user]:[password]@[host]:[port]/[database]
   ```

### Tickets werden nicht synchronisiert

**Problem:** Sync ist deaktiviert oder DB-Verbindung fehlgeschlagen.

**Lösung:**

1. Prüfe `libs/pg-sync/.env`:
   ```env
   SYNC_ENABLED=true
   ```
2. Prüfe ob Migration gelaufen ist: `npm run db:migrate`
3. Manuell Sync triggern über UI oder API

---

## ❓ Q&A

### Allgemein

**Q: Muss ich Supabase nutzen oder geht auch eine andere Postgres-DB?**

A: Für die **Datenbank** kannst du jede Postgres-DB nutzen (Supabase, Coolify, Railway, selbst-gehostet). Für **File Storage** (Bilder) wird aktuell nur Supabase Storage unterstützt. Du könntest aber `supabase-storage.ts` für andere Provider (S3, Cloudflare R2) anpassen.

---

**Q: Wo werden die Bilder gespeichert?**

A: Die Bilder landen in deinem Supabase Storage Bucket unter dem Pfad:

```
projects/{projectId}/tickets/{ticketId}/{uuid}-{filename}
```

In der Datenbank wird nur der **Storage-Pfad** gespeichert, nicht die Datei selbst.

---

**Q: Wie sicher sind die hochgeladenen Bilder?**

A: Sehr sicher!

- Bucket ist **nicht öffentlich**
- Zugriff nur über **Signed URLs** (zeitlich begrenzt, default 1h)
- Upload nur über **Service Role Key** (server-seitig)
- MIME-Type Validation (nur Bilder erlaubt)
- Größenlimit (5 MB pro Datei)

---

**Q: Kann ich die maximale Dateigröße ändern?**

A: Ja, in `apps/server/src/routes/public-projects/index.ts`:

```typescript
const MAX_PUBLIC_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PUBLIC_ATTACHMENTS = 4; // Max 4 Bilder pro Ticket
```

---

### Kunden-Board

**Q: Können Kunden auch Tickets bearbeiten?**

A: Nein, aktuell ist das Kunden-Board **read-only** für bestehende Tickets. Kunden können nur:

- Neue Tickets erstellen
- Status der eigenen Tickets sehen

---

**Q: Wie funktioniert der Passwortschutz?**

A:

1. Im Projekt-Settings aktivierst du "Password protected"
2. Kunde gibt beim ersten Besuch das Passwort ein
3. Ein **JWT-Cookie** wird gesetzt (30 Tage gültig)
4. Danach kein erneutes Einloggen nötig

---

**Q: Welche Status sehen Kunden im Board?**

A: Das ist konfigurierbar! Standard:

- `backlog`, `todo`, `in_progress`, `review`, `done`

Du kannst in den Public Settings auswählen, welche Status sichtbar sein sollen.

---

### Development

**Q: Wie führe ich TypeScript-Checks durch?**

A:

```bash
# Nur Type-Check (ohne Build)
npx tsc --noEmit

# In spezifischem Package
cd libs/pg-sync && npx tsc --noEmit
cd apps/server && npx tsc --noEmit
```

---

**Q: Wie starte ich die Tests?**

A:

```bash
# Alle Tests
npm run test:all

# Server Unit-Tests
npm run test:server

# E2E Tests (mit Browser)
npm run test:headed
```

---

**Q: Wie deploye ich das Projekt?**

A: Deployment-Optionen:

1. **Vercel/Netlify** (nur Frontend) + **Railway/Render** (Backend)
2. **Docker** (beide zusammen)
3. **Self-hosted** (VPS mit Node.js)

Wichtig:

- `NODE_ENV=production` setzen
- Alle ENV-Variablen konfigurieren
- `JWT_SECRET` unbedingt setzen!

---

### Probleme?

**Q: An wen wende ich mich bei Problemen?**

A:

1. **GitHub Issues**: https://github.com/anthropics/claude-code/issues
2. **Projekt-spezifisch**: Siehe `docs/pg-online-sync/` für Architektur-Docs
3. **GLOBAL-TASKLIST**: `docs/pg-online-sync/GLOBAL-TASKLIST.md` für Feature-Status

---

## 📁 Wichtige Dateien-Referenz

| Zweck                     | Datei                                                        |
| ------------------------- | ------------------------------------------------------------ |
| Server ENV                | `apps/server/.env`                                           |
| DB/Sync ENV               | `libs/pg-sync/.env`                                          |
| Supabase Storage Lib      | `apps/server/src/lib/supabase-storage.ts`                    |
| Public API Routes         | `apps/server/src/routes/public-projects/index.ts`            |
| Ticket Attachments Schema | `libs/pg-sync/src/db/schema/tickets.ts`                      |
| Public Ticket Form UI     | `apps/ui/src/components/public-board/public-ticket-form.tsx` |
| Projekt-Übersicht         | `docs/pg-online-sync/GLOBAL-TASKLIST.md`                     |
| **Monorepo Architektur**  | `docs/pg-online-sync/MONOREPO-GUIDE.md`                      |

---

**Viel Erfolg mit deinem Projekt!** 🎉
