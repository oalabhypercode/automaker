# ⚙️ Phase 1.5: Auto-Sync & Konfiguration

ULTRATHINK

> **Status:** ⏳ Offen
> **Abhängigkeiten:** Phase 1.3 (Push), Phase 1.4 (Pull)
> **Geschätzte Komplexität:** Mittel

---

## 🎯 Ziel dieser Phase

Automatische Synchronisation und Konfigurationsmöglichkeiten:

- Timer-basierter Auto-Sync (stündlich, manuell konfigurierbar)
- Sync bei App-Start
- Konfigurierbare Sync-Einstellungen pro Projekt
- Status-Anzeige und Benachrichtigungen
- Robustes Error-Handling und Retry-Logic

---

## ❓ Proaktive F&A

### Q1: Wie oft soll automatisch synchronisiert werden?

✅ **Konfigurierbare Intervalle:**

- Standard: Alle 60 Minuten
- Optionen: 15min, 30min, 60min, 2h, 4h, manuell
- Pro Projekt einstellbar
- Bei schlechter Verbindung: Exponential Backoff

### Q2: Was passiert bei App-Start?

✅ **Startup-Sync:**

1. Offline-Modus prüfen
2. Wenn online: Auto-Pull ausführen
3. Pending Pushes verarbeiten
4. Status-Update an UI

### Q3: Wie werden Sync-Fehler behandelt?

✅ **Error-Handling:**

- Retry mit Exponential Backoff (1s, 2s, 4s, 8s, max 60s)
- Max 5 Retries pro Operation
- Fehler werden geloggt
- User-Benachrichtigung bei kritischen Fehlern

### Q4: Kann der User Sync deaktivieren?

✅ **Toggle pro Projekt:**

- `syncEnabled: boolean` in Projekt-Settings
- Global: Online-Modus ein/aus
- Offline-First bleibt immer verfügbar

### Q5: Wie wird der Sync-Status angezeigt?

✅ **UI-Elemente:**

- Sync-Icon im Header (letzte Sync-Zeit)
- Tooltip mit Details
- Toast bei Änderungen
- Conflict-Badge wenn Konflikte existieren

### Q6: Background-Sync auch wenn App minimiert?

✅ **Electron-spezifisch:**

- Im Tray weiterlaufen (optional)
- Background-Timer für Auto-Sync
- Notification bei wichtigen Updates

---

## 🏛️ Auto-Sync Architektur

### Komponenten-Übersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                      AUTO-SYNC SYSTEM                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │  Sync Scheduler  │────►│   Sync Engine    │                     │
│  │  (Timer Manager) │     │  (Push + Pull)   │                     │
│  └──────────────────┘     └────────┬─────────┘                     │
│          │                         │                                │
│          │                         │                                │
│  ┌───────▼──────────────────────────▼─────────────────────┐        │
│  │                   SYNC CONFIG                           │        │
│  │  {                                                      │        │
│  │    enabled: true,                                       │        │
│  │    interval: 3600000,  // 1 Stunde                     │        │
│  │    syncOnStart: true,                                   │        │
│  │    pushAutomatically: true,                             │        │
│  │    pullAutomatically: true,                             │        │
│  │    retryConfig: {...}                                   │        │
│  │  }                                                      │        │
│  └─────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐                     │
│  │  Network Monitor │     │  Status Manager  │                     │
│  │  (Online/Offline)│     │  (UI Updates)    │                     │
│  └──────────────────┘     └──────────────────┘                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Sync-Konfiguration

### Settings-Struktur

**Global Settings (`data/settings.json`):**

```
{
  "sync": {
    "enabled": true,
    "defaultInterval": 3600000,
    "syncOnStart": true,
    "notifyOnChanges": true,
    "backgroundSync": false  // Electron-only
  }
}
```

**Projekt-Settings (`.automaker/settings.json`):**

```
{
  "sync": {
    "enabled": true,
    "projectId": "proj-123",
    "interval": 1800000,  // 30 min (überschreibt global)
    "pushAutomatically": true,
    "pullAutomatically": true,
    "conflictStrategy": "remote_wins",  // remote_wins | local_wins | manual
    "lastSyncAt": "2026-01-06T10:00:00Z"
  }
}
```

### Config-Schema (TypeScript)

| Property            | Typ     | Default       | Beschreibung             |
| ------------------- | ------- | ------------- | ------------------------ |
| `enabled`           | boolean | true          | Sync aktiv               |
| `interval`          | number  | 3600000       | Intervall in ms          |
| `syncOnStart`       | boolean | true          | Sync bei App-Start       |
| `pushAutomatically` | boolean | true          | Auto-Push bei Änderungen |
| `pullAutomatically` | boolean | true          | Auto-Pull im Intervall   |
| `conflictStrategy`  | enum    | 'remote_wins' | Konflikt-Auflösung       |
| `retryMaxAttempts`  | number  | 5             | Max Retry-Versuche       |
| `retryBaseDelay`    | number  | 1000          | Basis-Delay in ms        |

---

## 🔄 Sync Scheduler

### Timer-Management

**Scheduler Funktionen:**

| Funktion                                 | Beschreibung            |
| ---------------------------------------- | ----------------------- |
| `startScheduler(projectId)`              | Startet Auto-Sync Timer |
| `stopScheduler(projectId)`               | Stoppt Auto-Sync Timer  |
| `rescheduleSync(projectId, newInterval)` | Ändert Intervall        |
| `triggerImmediateSync(projectId)`        | Sofortiger Sync         |
| `pauseAllSchedulers()`                   | Alle Timer pausieren    |
| `resumeAllSchedulers()`                  | Alle Timer fortsetzen   |

**Scheduler Logic:**

```
class SyncScheduler:
  timers: Map<projectId, NodeJS.Timeout>

  startScheduler(projectId):
    config = getProjectSyncConfig(projectId)
    if not config.enabled: return

    timer = setInterval(
      () => this.executeSync(projectId),
      config.interval
    )
    this.timers.set(projectId, timer)

  executeSync(projectId):
    try:
      // Pull zuerst (remote Änderungen holen)
      await pullService.pullChanges(projectId)

      // Push (lokale Änderungen senden)
      await pushService.pushPendingChanges(projectId)

      emit('sync:auto:complete', { projectId })
    catch error:
      this.handleError(projectId, error)
```

### Exponential Backoff

```
calculateBackoff(attempt):
  baseDelay = 1000  // 1 Sekunde
  maxDelay = 60000  // 1 Minute

  delay = baseDelay * (2 ** attempt)
  jitter = Math.random() * 1000

  return Math.min(delay + jitter, maxDelay)

// Beispiel:
// Attempt 1: ~1s
// Attempt 2: ~2s
// Attempt 3: ~4s
// Attempt 4: ~8s
// Attempt 5: ~16s
```

---

## 🌐 Network Monitor

### Online/Offline Detection

**Web (Browser API):**

```
navigator.onLine  // true/false

window.addEventListener('online', handleOnline)
window.addEventListener('offline', handleOffline)
```

**Electron:**

```
// Im Main Process
const { net } = require('electron')
net.isOnline()

// Oder via Renderer mit preload
ipcRenderer.on('network-status-change', (status) => ...)
```

### Network State Manager

```
class NetworkMonitor:
  isOnline: boolean = true
  listeners: Function[] = []

  init():
    // Browser
    window.addEventListener('online', () => this.setOnline(true))
    window.addEventListener('offline', () => this.setOnline(false))

    // Periodischer Health-Check (optional)
    setInterval(() => this.healthCheck(), 30000)

  setOnline(status):
    if this.isOnline !== status:
      this.isOnline = status
      this.notifyListeners(status)

      if status:
        emit('sync:network:online')
        // Trigger Sync wenn wieder online
        syncScheduler.triggerImmediateSync()
      else:
        emit('sync:network:offline')

  async healthCheck():
    try:
      response = await fetch('/api/health', { timeout: 5000 })
      this.setOnline(response.ok)
    catch:
      this.setOnline(false)
```

---

## 📊 Status Manager

### Sync-Status Struktur

```
interface SyncStatus {
  state: 'idle' | 'syncing' | 'error' | 'offline'
  lastSyncAt: Date | null
  lastError: string | null
  pendingPushCount: number
  pendingPullCount: number
  isOnline: boolean
  currentOperation: 'push' | 'pull' | null
  progress: number  // 0-100
}
```

### Status Updates

**Events emittieren:**

```
// Sync gestartet
emit('sync:status', { state: 'syncing', currentOperation: 'pull' })

// Sync erfolgreich
emit('sync:status', {
  state: 'idle',
  lastSyncAt: new Date(),
  pendingPushCount: 0
})

// Sync Fehler
emit('sync:status', {
  state: 'error',
  lastError: 'Connection timeout'
})

// Offline
emit('sync:status', { state: 'offline', isOnline: false })
```

---

## 🔔 Benachrichtigungen

### Toast-Nachrichten

| Situation        | Toast-Inhalt                                 | Typ     |
| ---------------- | -------------------------------------------- | ------- |
| Sync erfolgreich | "✅ Synchronisation abgeschlossen"           | success |
| Neue Tickets     | "📥 3 neue Tickets synchronisiert"           | info    |
| Sync Fehler      | "⚠️ Synchronisation fehlgeschlagen"          | error   |
| Offline          | "📴 Offline - Änderungen werden gespeichert" | warning |
| Wieder Online    | "🌐 Verbindung wiederhergestellt"            | info    |
| Konflikt         | "⚡ Konflikt erkannt - Überprüfung nötig"    | warning |

### Electron Notifications

```
// Für wichtige Updates (wenn App minimiert)
new Notification({
  title: 'Automaker Sync',
  body: '3 neue Tickets wurden synchronisiert',
  icon: 'path/to/icon.png'
}).show()
```

### Desktop Notification (Web)

```
if ('Notification' in window && Notification.permission === 'granted') {
  new Notification('Automaker Sync', {
    body: '3 neue Tickets synchronisiert',
    icon: '/icon.png'
  })
}
```

---

## 🎛️ UI-Komponenten

### Sync-Status Anzeige im Header

```
┌────────────────────────────────────────────────────────────────┐
│  🏠 Automaker          [Settings] [🔄 Synced 5 min ago] [User] │
└────────────────────────────────────────────────────────────────┘

// Bei Sync:
[🔄 Syncing...]

// Bei Fehler:
[⚠️ Sync Error]

// Offline:
[📴 Offline]
```

### Sync-Status Tooltip (Hover)

```
┌─────────────────────────────────────┐
│  Synchronisation                    │
│  ─────────────────────────────────  │
│  Letzter Sync: Vor 5 Minuten       │
│  Nächster Sync: In 55 Minuten      │
│  Ausstehende Änderungen: 2         │
│                                     │
│  [Jetzt synchronisieren]            │
│  [Einstellungen]                    │
└─────────────────────────────────────┘
```

### Sync-Einstellungen Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ Sync-Einstellungen                                    [×]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Automatische Synchronisation                                   │
│  ─────────────────────────────                                  │
│  [✓] Sync aktiviert                                             │
│                                                                  │
│  Intervall:                                                      │
│  [▼ Alle 60 Minuten        ]                                    │
│        • 15 Minuten                                              │
│        • 30 Minuten                                              │
│        • 60 Minuten (empfohlen)                                  │
│        • 2 Stunden                                               │
│        • 4 Stunden                                               │
│        • Nur manuell                                             │
│                                                                  │
│  [✓] Bei App-Start synchronisieren                              │
│  [✓] Automatisch pushen bei Änderungen                          │
│                                                                  │
│  Konflikt-Auflösung:                                            │
│  [▼ Remote-Änderungen bevorzugen]                               │
│                                                                  │
│  Benachrichtigungen                                              │
│  ─────────────────                                               │
│  [✓] Bei neuen Tickets benachrichtigen                          │
│  [✓] Bei Sync-Fehlern benachrichtigen                           │
│                                                                  │
│                          [Abbrechen] [Speichern]                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📱 Konkrete Beispiele

### Beispiel: App-Start Sync

```
🖥️ User startet Automaker
   ↓
📋 App prüft: syncOnStart = true?
   ↓ Ja
🌐 Network Check: Online?
   ↓ Ja
🔄 Pull ausführen:
   ├── 5 neue Events
   └── 2 neue Tickets
   ↓
📤 Push ausführen:
   └── 1 lokale Änderung
   ↓
✅ "Sync abgeschlossen - 2 neue Tickets"
```

### Beispiel: Auto-Sync im Hintergrund

```
⏰ Timer: 60 Minuten vergangen
   ↓
🔄 Auto-Sync startet (leise im Hintergrund)
   ↓
📥 Pull: 0 neue Events
📤 Push: 0 Änderungen
   ↓
✅ Status-Icon updated: "Synced jetzt"
   (kein Toast, nichts Neues)
```

### Beispiel: Offline → Online

```
📴 User war 2 Stunden offline
   ↓
🔌 Verbindung wiederhergestellt
   ↓
🔔 Event: 'network:online'
   ↓
🔄 Sofortiger Sync:
   ├── Pull: 15 Events, 5 neue Tickets
   └── Push: 10 lokale Änderungen
   ↓
✅ Toast: "📥 5 neue Tickets synchronisiert"
```

---

## ⚡ Error-Handling

### Fehlertypen und Reaktionen

| Fehlertyp          | Ursache            | Reaktion                    |
| ------------------ | ------------------ | --------------------------- |
| `NETWORK_ERROR`    | Keine Verbindung   | Offline-Modus, Retry später |
| `AUTH_ERROR`       | Token abgelaufen   | Re-Auth Dialog              |
| `CONFLICT_ERROR`   | Version Mismatch   | Conflict Resolution         |
| `SERVER_ERROR`     | 5xx Response       | Retry mit Backoff           |
| `VALIDATION_ERROR` | Ungültige Daten    | Log + Skip Item             |
| `TIMEOUT`          | Request zu langsam | Retry mit längerem Timeout  |

### Retry-Queue

```
class RetryQueue:
  queue: Array<{ operation, attempt, nextRetryAt }>

  addToQueue(operation, error):
    attempt = operation.attempt ?? 0

    if attempt >= MAX_RETRIES:
      emit('sync:error:permanent', { operation, error })
      return

    delay = calculateBackoff(attempt)
    nextRetryAt = Date.now() + delay

    this.queue.push({
      operation: { ...operation, attempt: attempt + 1 },
      nextRetryAt
    })

    this.scheduleNext()

  async processQueue():
    for item in this.queue.filter(i => i.nextRetryAt <= Date.now()):
      try:
        await executeOperation(item.operation)
        this.removeFromQueue(item)
      catch error:
        this.addToQueue(item.operation, error)
```

---

## 🧩 Komponenten dieser Phase

### Neue Dateien

| Datei                                                  | Zweck            | ~Zeilen |
| ------------------------------------------------------ | ---------------- | ------- |
| `libs/pg-sync/src/sync/sync-scheduler.ts`              | Timer-Management | ~120    |
| `libs/pg-sync/src/sync/network-monitor.ts`             | Online/Offline   | ~80     |
| `libs/pg-sync/src/sync/sync-status-manager.ts`         | Status-Tracking  | ~100    |
| `libs/pg-sync/src/sync/retry-queue.ts`                 | Retry-Logic      | ~90     |
| `libs/pg-sync/src/sync/sync-config.ts`                 | Config-Schema    | ~60     |
| `libs/pg-sync/src/hooks/use-sync-status.ts`            | React Hook       | ~50     |
| `apps/ui/src/components/sync/sync-indicator.tsx`       | Header-Icon      | ~80     |
| `apps/ui/src/components/sync/sync-settings-dialog.tsx` | Settings UI      | ~180    |

**Gesamt: ~760 Zeilen Code**

### Anpassungen bestehender Dateien

| Datei                               | Änderung                   | ~Zeilen |
| ----------------------------------- | -------------------------- | ------- |
| `apps/ui/src/components/header.tsx` | Sync-Indicator integrieren | +5      |
| `apps/server/src/index.ts`          | Scheduler initialisieren   | +3      |
| `apps/ui/src/store/app-store.ts`    | Sync-Status State          | +20     |

**Minimale Änderungen: ~28 Zeilen total**

---

## 📁 Datei-Struktur nach Phase 1.5

```
libs/pg-sync/
└── src/
    ├── sync/
    │   ├── push-service.ts       # Phase 1.3
    │   ├── pull-service.ts       # Phase 1.4
    │   ├── sync-scheduler.ts     # ⭐ NEU
    │   ├── network-monitor.ts    # ⭐ NEU
    │   ├── sync-status-manager.ts # ⭐ NEU
    │   ├── retry-queue.ts        # ⭐ NEU
    │   └── sync-config.ts        # ⭐ NEU
    └── hooks/
        └── use-sync-status.ts    # ⭐ NEU

apps/ui/src/
└── components/
    └── sync/
        ├── sync-indicator.tsx    # ⭐ NEU
        └── sync-settings-dialog.tsx # ⭐ NEU
```

---

## ✅ Abschlusskriterien

- [ ] Sync-Scheduler funktioniert mit konfigurierbarem Intervall
- [ ] App-Start Sync implementiert
- [ ] Network-Monitor erkennt Online/Offline korrekt
- [ ] Status-Manager trackt Sync-Zustand
- [ ] Retry-Queue mit Exponential Backoff
- [ ] Sync-Indicator im Header
- [ ] Settings-Dialog für Konfiguration
- [ ] Toast-Benachrichtigungen bei relevanten Events
- [ ] Electron-spezifisches Background-Sync (optional)
- [ ] Alle Settings werden persistiert
- [ ] Tests für Scheduler und Retry-Logic

---

## 🔗 Referenzen

- `phase-1.3-push-mechanismus.md` - Push-Service Integration
- `phase-1.4-pull-mechanismus.md` - Pull-Service Integration
- `GLOBAL-TASKLIST.md` - Gesamtübersicht
- `apps/ui/src/store/app-store.ts` - Zustand-Store Referenz

---

**📌 Phase 1 abgeschlossen!** 🎉

**Nächste Phase:** 2.1 - Online Ticket-Erstellung (Interne Web-UI)
