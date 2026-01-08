# 🏗️ Phase 0.1: Architektur-Entscheidung

ULTRATHINK

> **Status:** ✅ ERLEDIGT (2026-01-07)
> **Abhängigkeiten:** Keine
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Entscheidung treffen, wie das Projekt strukturiert wird, um:

- Minimale Merge-Konflikte mit dem Public Automaker Repo zu haben
- Maximale Wiederverwendung von bestehendem Code
- Klare Trennung zwischen Offline-Kern und Online-Erweiterung

---

## ❓ Proaktive F&A

### Q1: Submodule, Fork oder separates Projekt?

✅ **Empfehlung: Fork mit separatem Package**

- Automaker bleibt als Fork bestehen
- Neue Funktionalität in `libs/pg-sync/` als neues Package
- Upstream-Changes können einfach gemerged werden
- Keine Submodule-Komplexität

### Q2: Wo werden Merge-Konflikte entstehen?

✅ **Potenzielle Konfliktstellen:**

- `package.json` (neue Dependencies) → Lösung: Dependencies in neuem Package
- `apps/server/src/` (neue Routes) → Lösung: Plugin-System oder Event-Hooks
- `apps/ui/src/` (neue Views) → Lösung: Lazy-Loading neuer Komponenten

### Q3: Wie integriert sich das neue Package?

✅ **Integration über Events:**

- Bestehender Code emittiert Events (z.B. `ticket:created`)
- Neues Package registriert Listener
- Keine Änderung am bestehenden Code nötig

### Q4: Was passiert bei Upstream-Updates?

✅ **Update-Strategie:**

```
1. git fetch upstream
2. git merge upstream/main
3. Konflikte nur in wenigen Dateien (wenn überhaupt)
4. Neue Funktionalität bleibt unberührt
```

### Q5: Wie wird deployed?

✅ **Zwei Deployment-Targets:**

- **Lokal (Electron):** Offline-First, Sync optional
- **Online (Web):** Postgres-Backend, volle Sync-Funktionalität

---

## 🔄 Optionen-Analyse

### Option A: Git Submodule ❌

```
automaker/
└── submodules/
    └── pg-sync/     # Separates Repo
```

**Nachteile:**

- Komplexe Git-Workflows
- Schwierige Versionierung
- CI/CD-Probleme

### Option B: Separates Monorepo ❌

```
automaker-online/
├── packages/
│   └── automaker/   # Kopie/Fork
└── packages/
    └── pg-sync/
```

**Nachteile:**

- Code-Duplizierung
- Sync-Aufwand mit Upstream
- Inkonsistenzen

### Option C: Fork mit neuem Package ✅ (EMPFOHLEN)

```
automaker/              # Fork
├── apps/
│   ├── ui/            # Minimal angepasst
│   └── server/        # Minimal angepasst
└── libs/
    ├── types/         # Original
    ├── utils/         # Original
    └── pg-sync/       # NEU - Alle Online-Funktionalität
```

**Vorteile:**

- Klare Trennung
- Einfaches Upstream-Merging
- Wiederverwendung der Monorepo-Infrastruktur
- KI kann einfach erweitern (neue Dateien statt Änderungen)

---

## 📋 Entscheidungsmatrix

| Kriterium          | Submodule    | Separates Repo | Fork + Package |
| ------------------ | ------------ | -------------- | -------------- |
| Merge-Konflikte    | ⚠️ Mittel    | ❌ Hoch        | ✅ Minimal     |
| Komplexität        | ❌ Hoch      | ⚠️ Mittel      | ✅ Niedrig     |
| Wiederverwendung   | ⚠️ Mittel    | ❌ Niedrig     | ✅ Hoch        |
| CI/CD Integration  | ❌ Schwierig | ⚠️ Aufwändig   | ✅ Einfach     |
| KI-Erweiterbarkeit | ⚠️ Mittel    | ⚠️ Mittel      | ✅ Hoch        |

---

## 🏛️ Finale Architektur-Entscheidung

### Struktur

```
automaker/                          # Fork des Public Repos
├── .github/                        # CI/CD (minimal anpassen)
├── apps/
│   ├── ui/
│   │   └── src/
│   │       └── routes/
│   │           └── _online/        # NEU: Online-Routes (lazy)
│   └── server/
│       └── src/
│           └── routes/
│               └── pg-sync/        # NEU: Sync-API Routes
└── libs/
    ├── types/                      # Original
    ├── utils/                      # Original
    ├── ...                         # Original Packages
    └── pg-sync/                    # NEU: Alles Online-bezogene
        ├── package.json
        └── src/
            ├── types/
            ├── db/
            ├── finders/
            ├── actions/
            ├── sync/
            └── hooks/
```

### Integration Points (minimal invasiv)

**1. Server-seitig:**

```
apps/server/src/index.ts
→ Nur 1 Zeile hinzufügen: import { registerPgSyncRoutes } from '@automaker/pg-sync'
→ registerPgSyncRoutes(app) am Ende
```

**2. UI-seitig:**

```
apps/ui/src/routes/__root.tsx
→ Optional: Lazy-load der Online-Komponenten
→ Kein Änderung wenn offline-only
```

**3. Event-basierte Integration:**

```
Bestehend: eventEmitter.emit('feature:updated', feature)
Neu: pg-sync registriert Listener und synced automatisch
```

---

## 📱 Konkrete Beispiele

### Beispiel: Neues Ticket erstellt

```
🖥️ Lokal: User erstellt Ticket im Offline-Board
📡 Event: 'ticket:created' wird emittiert
🔄 pg-sync: Listener fängt Event, speichert in Outbox
⏰ Sync: Bei nächstem Push wird Ticket zu Postgres gesynced
☁️ Online: Alle sehen das neue Ticket
```

### Beispiel: Upstream-Update holen

```
$ git fetch upstream
$ git merge upstream/main

Konflikte: 0-2 Dateien (wenn überhaupt)
→ package.json (Dependencies mergen)
→ evtl. tsconfig Pfade

libs/pg-sync/ bleibt komplett unberührt!
```

---

## ⚡ Performance & Risiken

### Risiken

| Risiko              | Wahrscheinlichkeit | Mitigation                   |
| ------------------- | ------------------ | ---------------------------- |
| Upstream bricht API | Niedrig            | Tests für Integration Points |
| Package-Konflikte   | Niedrig            | Isolierte Dependencies       |
| Build-Probleme      | Mittel             | CI prüft beide Targets       |

### Performance

- Lazy-Loading für Online-Komponenten: ~50KB extra
- Sync-Service als Worker: Kein UI-Blocking
- Inkrementeller Sync: Nur Deltas übertragen

---

## 🧩 Komponenten dieser Phase

### 1. Entscheidungsdokumentation (dieses Dokument)

- Optionen dokumentieren
- Entscheidung begründen
- Architektur skizzieren

### 2. Keine Code-Implementierung in dieser Phase

- Reine Planungs-/Entscheidungsphase

---

## ✅ Abschlusskriterien

- [x] Architektur-Entscheidung dokumentiert ✅
- [x] Teamabstimmung erfolgt ✅
- [x] Risiken identifiziert ✅
- [x] Nächste Phasen können starten ✅

---

## 🔗 Referenzen

- `temp-pg-online-supabase.md` - Original-Anforderungen
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `CLAUDE.md` - Automaker-Architektur

---

**📌 Nächste Phase:** 0.2 - Postgres/Supabase Setup
