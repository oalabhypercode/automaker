/**
 * 📊 UI Sync Status Manager
 *
 * Verwaltet den UI-sichtbaren Sync-Status für die Anzeige.
 * Aggregiert Status von Scheduler, Network und Operationen.
 *
 * @see docs/pg-online-sync/tasks/phase-1.5-auto-sync.md
 */

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Sync-Zustand für UI
 */
export type UiSyncState = 'idle' | 'syncing' | 'error' | 'offline' | 'paused';

/**
 * Aktuelle Operation
 */
export type CurrentOperation = 'push' | 'pull' | 'both' | null;

/**
 * Toast-Typ für Benachrichtigungen
 */
export type ToastType = 'success' | 'info' | 'warning' | 'error';

/**
 * Toast-Nachricht
 */
export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly title: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly duration?: number;
}

/**
 * UI-sichtbarer Sync-Status
 */
export interface UiSyncStatus {
  /** Aktueller Zustand */
  readonly state: UiSyncState;

  /** Letzter erfolgreicher Sync */
  readonly lastSyncAt: Date | null;

  /** Letzter Fehler */
  readonly lastError: string | null;

  /** Ausstehende Push-Operationen */
  readonly pendingPushCount: number;

  /** Neue Items seit letztem Pull */
  readonly pendingPullCount: number;

  /** Online-Status */
  readonly isOnline: boolean;

  /** Aktuelle Operation */
  readonly currentOperation: CurrentOperation;

  /** Fortschritt (0-100) */
  readonly progress: number;

  /** Nächster geplanter Sync */
  readonly nextSyncAt: Date | null;

  /** Konflikt vorhanden */
  readonly hasConflicts: boolean;
}

/**
 * Status-Update Payload
 */
export type UiSyncStatusUpdate = Partial<UiSyncStatus>;

/**
 * Callback für Status-Änderungen
 */
export type UiSyncStatusCallback = (status: UiSyncStatus) => void;

/**
 * Callback für Toast-Nachrichten
 */
export type ToastCallback = (toast: ToastMessage) => void;

/**
 * Konfiguration für UiSyncStatusManager
 */
export interface UiSyncStatusManagerConfig {
  /** Callback für Status-Änderungen */
  readonly onStatusChange?: UiSyncStatusCallback;

  /** Callback für Toast-Nachrichten */
  readonly onToast?: ToastCallback;

  /** Automatisch Toasts bei relevanten Events */
  readonly autoToast: boolean;

  /** Toast-Dauer in ms (0 = permanent) */
  readonly toastDuration: number;
}

// =============================================================================
// 📊 CONSTANTS
// =============================================================================

/**
 * Standard-Status
 */
export const DEFAULT_UI_SYNC_STATUS: UiSyncStatus = {
  state: 'idle',
  lastSyncAt: null,
  lastError: null,
  pendingPushCount: 0,
  pendingPullCount: 0,
  isOnline: true,
  currentOperation: null,
  progress: 0,
  nextSyncAt: null,
  hasConflicts: false,
} as const;

/**
 * Standard-Konfiguration
 */
export const DEFAULT_UI_STATUS_CONFIG: UiSyncStatusManagerConfig = {
  autoToast: true,
  toastDuration: 5000, // 5 Sekunden
} as const;

// =============================================================================
// 🛠️ UI SYNC STATUS MANAGER CLASS
// =============================================================================

/**
 * UiSyncStatusManager verwaltet den UI-sichtbaren Sync-Status
 *
 * Features:
 * - Aggregierter Status für Header-Anzeige
 * - Toast-Nachrichten für wichtige Events
 * - Relative Zeit-Anzeige (vor X Minuten)
 */
export class UiSyncStatusManager {
  private status: UiSyncStatus = { ...DEFAULT_UI_SYNC_STATUS };
  private statusListeners: Set<UiSyncStatusCallback> = new Set();
  private toastListeners: Set<ToastCallback> = new Set();
  private config: UiSyncStatusManagerConfig;
  private toastIdCounter = 0;

  constructor(config: Partial<UiSyncStatusManagerConfig> = {}) {
    this.config = { ...DEFAULT_UI_STATUS_CONFIG, ...config };

    if (config.onStatusChange) {
      this.statusListeners.add(config.onStatusChange);
    }

    if (config.onToast) {
      this.toastListeners.add(config.onToast);
    }
  }

  // ===========================================================================
  // 📊 STATUS GETTERS
  // ===========================================================================

  /**
   * Gibt den aktuellen Status zurück
   */
  getStatus(): UiSyncStatus {
    return { ...this.status };
  }

  /**
   * Gibt den Zustand zurück
   */
  getState(): UiSyncState {
    return this.status.state;
  }

  /**
   * Prüft ob gerade synchronisiert wird
   */
  isSyncing(): boolean {
    return this.status.state === 'syncing';
  }

  /**
   * Prüft ob online
   */
  isOnline(): boolean {
    return this.status.isOnline;
  }

  /**
   * Gibt relative Zeit seit letztem Sync zurück
   */
  getLastSyncRelative(): string {
    if (!this.status.lastSyncAt) {
      return 'Noch nie';
    }

    return formatRelativeTime(this.status.lastSyncAt);
  }

  /**
   * Gibt relative Zeit bis zum nächsten Sync zurück
   */
  getNextSyncRelative(): string {
    if (!this.status.nextSyncAt) {
      return 'Nicht geplant';
    }

    return formatRelativeTimeFuture(this.status.nextSyncAt);
  }

  // ===========================================================================
  // 📝 STATUS UPDATES
  // ===========================================================================

  /**
   * Aktualisiert den Status
   */
  updateStatus(update: UiSyncStatusUpdate): void {
    this.status = { ...this.status, ...update };
    this.notifyStatusListeners();
  }

  /**
   * Setzt Sync gestartet
   */
  setSyncStarted(operation: CurrentOperation = 'both'): void {
    this.updateStatus({
      state: 'syncing',
      currentOperation: operation,
      progress: 0,
      lastError: null,
    });
  }

  /**
   * Setzt Sync abgeschlossen
   */
  setSyncCompleted(newItemsCount = 0, options?: { nextSyncAt?: Date }): void {
    this.updateStatus({
      state: 'idle',
      currentOperation: null,
      progress: 100,
      lastSyncAt: new Date(),
      lastError: null,
      pendingPullCount: 0,
      nextSyncAt: options?.nextSyncAt ?? null,
    });

    if (this.config.autoToast && newItemsCount > 0) {
      this.showToast(
        'info',
        'Synchronisation abgeschlossen',
        `${newItemsCount} neue ${newItemsCount === 1 ? 'Änderung' : 'Änderungen'} synchronisiert`
      );
    }
  }

  /**
   * Setzt Sync fehlgeschlagen
   */
  setSyncFailed(error: string): void {
    this.updateStatus({
      state: 'error',
      currentOperation: null,
      progress: 0,
      lastError: error,
    });

    if (this.config.autoToast) {
      this.showToast('error', 'Synchronisation fehlgeschlagen', error);
    }
  }

  /**
   * Setzt Online-Status
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.status.isOnline;

    this.updateStatus({
      isOnline,
      state: isOnline ? (this.status.state === 'offline' ? 'idle' : this.status.state) : 'offline',
    });

    if (this.config.autoToast) {
      if (isOnline && wasOffline) {
        this.showToast('info', 'Verbindung wiederhergestellt', 'Sie sind wieder online');
      } else if (!isOnline) {
        this.showToast(
          'warning',
          'Offline',
          'Änderungen werden gespeichert und später synchronisiert'
        );
      }
    }
  }

  /**
   * Setzt ausstehende Push-Operationen
   */
  setPendingPushCount(count: number): void {
    this.updateStatus({ pendingPushCount: count });
  }

  /**
   * Setzt Konflikt-Status
   */
  setHasConflicts(hasConflicts: boolean): void {
    this.updateStatus({ hasConflicts });

    if (this.config.autoToast && hasConflicts) {
      this.showToast(
        'warning',
        'Konflikt erkannt',
        'Bitte überprüfen Sie die widersprüchlichen Änderungen'
      );
    }
  }

  /**
   * Aktualisiert Fortschritt
   */
  setProgress(progress: number): void {
    this.updateStatus({ progress: Math.min(100, Math.max(0, progress)) });
  }

  /**
   * Setzt pausiert
   */
  setPaused(isPaused: boolean): void {
    this.updateStatus({
      state: isPaused ? 'paused' : 'idle',
    });
  }

  // ===========================================================================
  // 🔔 TOASTS
  // ===========================================================================

  /**
   * Zeigt eine Toast-Nachricht
   */
  showToast(type: ToastType, title: string, message: string): void {
    const toast: ToastMessage = {
      id: `toast_${++this.toastIdCounter}`,
      type,
      title,
      message,
      timestamp: new Date(),
      duration: this.config.toastDuration,
    };

    this.notifyToastListeners(toast);
  }

  // ===========================================================================
  // 🔔 LISTENERS
  // ===========================================================================

  /**
   * Registriert einen Status-Listener
   */
  onStatusChange(callback: UiSyncStatusCallback): () => void {
    this.statusListeners.add(callback);

    // Sofort mit aktuellem Status aufrufen
    callback(this.getStatus());

    return () => this.statusListeners.delete(callback);
  }

  /**
   * Entfernt einen Status-Listener
   */
  offStatusChange(callback: UiSyncStatusCallback): void {
    this.statusListeners.delete(callback);
  }

  /**
   * Registriert einen Toast-Listener
   */
  onToast(callback: ToastCallback): () => void {
    this.toastListeners.add(callback);
    return () => this.toastListeners.delete(callback);
  }

  /**
   * Entfernt einen Toast-Listener
   */
  offToast(callback: ToastCallback): void {
    this.toastListeners.delete(callback);
  }

  // ===========================================================================
  // 🧹 CLEANUP
  // ===========================================================================

  /**
   * Setzt den Status zurück
   */
  reset(): void {
    this.status = { ...DEFAULT_UI_SYNC_STATUS };
    this.notifyStatusListeners();
  }

  /**
   * Beendet den Manager
   */
  destroy(): void {
    this.statusListeners.clear();
    this.toastListeners.clear();
  }

  // ===========================================================================
  // 🔧 PRIVATE METHODS
  // ===========================================================================

  /**
   * Benachrichtigt Status-Listener
   */
  private notifyStatusListeners(): void {
    const status = this.getStatus();

    this.statusListeners.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error('[UiSyncStatusManager] Listener error:', error);
      }
    });
  }

  /**
   * Benachrichtigt Toast-Listener
   */
  private notifyToastListeners(toast: ToastMessage): void {
    this.toastListeners.forEach((callback) => {
      try {
        callback(toast);
      } catch (error) {
        console.error('[UiSyncStatusManager] Toast listener error:', error);
      }
    });
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen UiSyncStatusManager
 */
export function createUiSyncStatusManager(
  config?: Partial<UiSyncStatusManagerConfig>
): UiSyncStatusManager {
  return new UiSyncStatusManager(config);
}

// =============================================================================
// 🔧 HELPER FUNCTIONS
// =============================================================================

/**
 * Formatiert relative Zeit (Vergangenheit)
 */
export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'Gerade eben';
  }

  if (minutes < 60) {
    return `Vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  }

  if (hours < 24) {
    return `Vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
  }

  return `Vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

/**
 * Formatiert relative Zeit (Zukunft)
 */
export function formatRelativeTimeFuture(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) {
    return 'Jetzt';
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (minutes < 60) {
    return `In ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  }

  return `In ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;
}

/**
 * Gibt Icon für Status zurück
 */
export function getStatusIcon(state: UiSyncState): string {
  switch (state) {
    case 'idle':
      return '✅';
    case 'syncing':
      return '🔄';
    case 'error':
      return '⚠️';
    case 'offline':
      return '📴';
    case 'paused':
      return '⏸️';
  }
}

/**
 * Gibt Label für Status zurück
 */
export function getStatusLabel(state: UiSyncState): string {
  switch (state) {
    case 'idle':
      return 'Synchronisiert';
    case 'syncing':
      return 'Synchronisiere...';
    case 'error':
      return 'Fehler';
    case 'offline':
      return 'Offline';
    case 'paused':
      return 'Pausiert';
  }
}
