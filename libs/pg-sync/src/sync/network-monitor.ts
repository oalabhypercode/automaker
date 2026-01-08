/**
 * 🌐 Network Monitor
 *
 * Überwacht den Online/Offline-Status der Anwendung.
 * Unterstützt Browser und Electron Umgebungen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.5-auto-sync.md
 */

// Deklaration für Browser-APIs in Node.js-Umgebung
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const window: any;
declare const navigator: any;

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Netzwerk-Status
 */
export type NetworkStatus = 'online' | 'offline' | 'unknown';

/**
 * Netzwerk-Event
 */
export interface NetworkEvent {
  readonly status: NetworkStatus;
  readonly timestamp: Date;
  readonly previousStatus: NetworkStatus | null;
}

/**
 * Callback für Netzwerk-Status-Änderungen
 */
export type NetworkStatusCallback = (event: NetworkEvent) => void;

/**
 * Konfiguration für Network Monitor
 */
export interface NetworkMonitorConfig {
  /** Health-Check URL (optional) */
  readonly healthCheckUrl?: string;

  /** Health-Check Intervall in ms (0 = deaktiviert) */
  readonly healthCheckInterval: number;

  /** Timeout für Health-Checks in ms */
  readonly healthCheckTimeout: number;

  /** Callback bei Status-Änderung */
  readonly onStatusChange?: NetworkStatusCallback;
}

// =============================================================================
// 📊 CONSTANTS
// =============================================================================

/**
 * Standard-Konfiguration
 */
export const DEFAULT_NETWORK_CONFIG: NetworkMonitorConfig = {
  healthCheckUrl: undefined, // Optional
  healthCheckInterval: 30000, // 30 Sekunden
  healthCheckTimeout: 5000, // 5 Sekunden
} as const;

// =============================================================================
// 🛠️ NETWORK MONITOR CLASS
// =============================================================================

/**
 * NetworkMonitor überwacht den Netzwerkstatus
 *
 * Features:
 * - Browser Online/Offline Events
 * - Optionaler Health-Check mit konfigurierbarer URL
 * - Event-Callbacks für Status-Änderungen
 */
export class NetworkMonitor {
  private status: NetworkStatus = 'unknown';
  private previousStatus: NetworkStatus | null = null;
  private listeners: Set<NetworkStatusCallback> = new Set();
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private config: NetworkMonitorConfig;
  private isInitialized = false;

  constructor(config: Partial<NetworkMonitorConfig> = {}) {
    this.config = { ...DEFAULT_NETWORK_CONFIG, ...config };

    if (config.onStatusChange) {
      this.listeners.add(config.onStatusChange);
    }
  }

  // ===========================================================================
  // 🔧 INITIALIZATION
  // ===========================================================================

  /**
   * Initialisiert den Network Monitor
   * Registriert Event-Listener und startet Health-Checks
   */
  init(): void {
    if (this.isInitialized) {
      return;
    }

    // Initial Status ermitteln
    this.updateStatus(this.detectInitialStatus());

    // Browser Events registrieren (wenn verfügbar)
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }

    // Health-Check Timer starten (wenn konfiguriert)
    if (this.config.healthCheckInterval > 0 && this.config.healthCheckUrl) {
      this.startHealthCheck();
    }

    this.isInitialized = true;
  }

  /**
   * Beendet den Network Monitor
   * Entfernt Event-Listener und stoppt Health-Checks
   */
  destroy(): void {
    if (!this.isInitialized) {
      return;
    }

    // Browser Events entfernen
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }

    // Health-Check stoppen
    this.stopHealthCheck();

    // Listener entfernen
    this.listeners.clear();

    this.isInitialized = false;
  }

  // ===========================================================================
  // 📊 STATUS
  // ===========================================================================

  /**
   * Gibt den aktuellen Netzwerk-Status zurück
   */
  getStatus(): NetworkStatus {
    return this.status;
  }

  /**
   * Prüft ob online
   */
  isOnline(): boolean {
    return this.status === 'online';
  }

  /**
   * Prüft ob offline
   */
  isOffline(): boolean {
    return this.status === 'offline';
  }

  // ===========================================================================
  // 🔔 LISTENERS
  // ===========================================================================

  /**
   * Registriert einen Callback für Status-Änderungen
   */
  onStatusChange(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);

    // Unsubscribe-Funktion zurückgeben
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Entfernt einen Status-Change-Callback
   */
  offStatusChange(callback: NetworkStatusCallback): void {
    this.listeners.delete(callback);
  }

  // ===========================================================================
  // 🔄 HEALTH CHECK
  // ===========================================================================

  /**
   * Führt einen manuellen Health-Check durch
   */
  async checkHealth(): Promise<boolean> {
    if (!this.config.healthCheckUrl) {
      // Ohne Health-Check URL: Browser-Status verwenden
      return this.detectInitialStatus() === 'online';
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.healthCheckTimeout);

      const response = await fetch(this.config.healthCheckUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const isOnline = response.ok;
      this.updateStatus(isOnline ? 'online' : 'offline');

      return isOnline;
    } catch (error) {
      // Bei Fehler: Offline setzen
      this.updateStatus('offline');
      return false;
    }
  }

  // ===========================================================================
  // 🔧 PRIVATE METHODS
  // ===========================================================================

  /**
   * Handler für Browser 'online' Event
   */
  private handleOnline = (): void => {
    this.updateStatus('online');
  };

  /**
   * Handler für Browser 'offline' Event
   */
  private handleOffline = (): void => {
    this.updateStatus('offline');
  };

  /**
   * Ermittelt den initialen Netzwerk-Status
   */
  private detectInitialStatus(): NetworkStatus {
    if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
      return navigator.onLine ? 'online' : 'offline';
    }
    return 'unknown';
  }

  /**
   * Aktualisiert den Status und benachrichtigt Listener
   */
  private updateStatus(newStatus: NetworkStatus): void {
    if (this.status === newStatus) {
      return;
    }

    this.previousStatus = this.status;
    this.status = newStatus;

    const event: NetworkEvent = {
      status: newStatus,
      timestamp: new Date(),
      previousStatus: this.previousStatus,
    };

    this.notifyListeners(event);
  }

  /**
   * Benachrichtigt alle registrierten Listener
   */
  private notifyListeners(event: NetworkEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[NetworkMonitor] Listener error:', error);
      }
    });
  }

  /**
   * Startet den Health-Check Timer
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return;
    }

    this.healthCheckTimer = setInterval(
      () => void this.checkHealth(),
      this.config.healthCheckInterval
    );
  }

  /**
   * Stoppt den Health-Check Timer
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen NetworkMonitor
 */
export function createNetworkMonitor(config?: Partial<NetworkMonitorConfig>): NetworkMonitor {
  return new NetworkMonitor(config);
}

/**
 * Singleton-Instanz für globale Verwendung
 */
let globalNetworkMonitor: NetworkMonitor | null = null;

/**
 * Gibt die globale NetworkMonitor-Instanz zurück (Singleton)
 */
export function getNetworkMonitor(): NetworkMonitor {
  if (!globalNetworkMonitor) {
    globalNetworkMonitor = createNetworkMonitor();
    globalNetworkMonitor.init();
  }
  return globalNetworkMonitor;
}

/**
 * Setzt die globale NetworkMonitor-Instanz zurück (für Tests)
 */
export function resetNetworkMonitor(): void {
  if (globalNetworkMonitor) {
    globalNetworkMonitor.destroy();
    globalNetworkMonitor = null;
  }
}
