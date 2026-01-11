# Public Board Deployment (Kunden-Portal)

Anleitung zum Deployen der oeffentlichen Kunden-URLs (`/p/:slug`).

---

## Was wird deployed?

**Kurze Antwort: Das komplette Automaker (UI + Server)**

Auch wenn du nur die Public URLs brauchst, musst du beides deployen:

```
/p/projekt-slug (Frontend)
       │
       ▼
/api/public/projects/:slug/* (Backend)
       │
       ▼
Postgres Datenbank
```

**Warum?**

- Frontend stellt nur die UI bereit (`/p/:slug` Route)
- Backend hat die Daten (Projekte, Tickets aus Postgres)
- Ohne Backend = "Project Not Found"

---

## Coolify Deployment

### Schritt 1: Repository verbinden

1. Coolify Dashboard oeffnen
2. "Add Resource" > "Application" > "Docker Compose"
3. GitHub Repository verbinden

### Schritt 2: docker-compose.yml

Die existierende `docker-compose.yml` im Repo funktioniert.
Fuer Production diese Anpassungen:

```yaml
services:
  server:
    build:
      context: .
      dockerfile: Dockerfile
      target: server
    ports:
      - '3008:3008'
    environment:
      # PFLICHT fuer Public Board:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
      - CORS_ORIGIN=${CORS_ORIGIN}

      # Optional (AI Features, nicht fuer Public Board noetig):
      # - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    volumes:
      - automaker-data:/data

  ui:
    build:
      context: .
      dockerfile: Dockerfile
      target: ui
      args:
        - VITE_SERVER_URL=${VITE_SERVER_URL}
    ports:
      - '3007:80'
    depends_on:
      - server

volumes:
  automaker-data:
```

### Schritt 3: Environment Variables

In Coolify unter "Environment":

```bash
# PFLICHT
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=mindestens-32-zeichen-sicherer-string
NODE_ENV=production

# URLs (anpassen!)
CORS_ORIGIN=https://board.deine-domain.de
VITE_SERVER_URL=https://api.deine-domain.de
```

**JWT_SECRET generieren:**

```bash
openssl rand -base64 32
```

### Schritt 4: Domains in Coolify

| Service | Domain                  | Port |
| ------- | ----------------------- | ---- |
| UI      | `board.deine-domain.de` | 80   |
| Server  | `api.deine-domain.de`   | 3008 |

SSL wird automatisch via Let's Encrypt konfiguriert.

### Schritt 5: Deploy

Klicke "Deploy". Fertig.

---

## Datenbank Setup (einmalig)

Falls noch nicht geschehen:

```bash
# Lokal ausfuehren
cd libs/pg-sync
DATABASE_URL="dein-connection-string" npm run db:push
```

---

## Projekte aktivieren

Nach dem Deployment:

1. Oeffne Automaker lokal (oder deine deployed Version)
2. Gehe zu "Online Sync"
3. Waehle Projekt > "Public Access" aktivieren
4. Kunden-URL: `https://board.deine-domain.de/p/projekt-slug`

---

## Troubleshooting

| Problem               | Loesung                                        |
| --------------------- | ---------------------------------------------- |
| "JWT_SECRET required" | `JWT_SECRET` Environment Variable setzen       |
| CORS Fehler           | `CORS_ORIGIN` muss exakt die Frontend-URL sein |
| "Project not found"   | Projekt in Online Sync auf "Public" setzen     |
| Tickets laden nicht   | `DATABASE_URL` pruefen                         |

---

## Zusammenfassung

1. **Docker Compose** in Coolify importieren
2. **4 Environment Variables** setzen: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `VITE_SERVER_URL`
3. **Domains** konfigurieren
4. **Deploy**
5. **Projekte** in Online Sync aktivieren
