/**
 * ⏰ Sync Scheduler
 *
 * Timer-basiertes Auto-Sync Management.
 * Koordiniert Push/Pull-Operationen im konfigurierten Intervall.
 *
 * @see docs/pg-online-sync/tasks/phase-1.5-auto-sync.md
 */

import {
  SyncConfig,
  ProjectSyncConfig,
  GlobalSyncConfig,
  getEffectiveInterval,
  isSyncEnabled,
  createSyncConfig,
  createProjectSyncConfig,
} from './sync-config.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Sync-Trigger für Event-Tracking
 */
export type SyncTriggerType = 'auto' | 'manual' | 'startup' | 'network_recovery';

/**
 * Status eines Scheduler-Timers
 */
export interface SchedulerTimerStatus {
  readonly projectId: string;
  readonly isActive: boolean;
  readonly interval: number;
  readonly nextSyncAt: Date | null;
  readonly lastSyncAt: Date | null;
}

/**
 * Sync-Aktion die vom Scheduler ausgeführt wird
 */
export interface SyncAction {
  /** Projekt-ID */
  readonly projectId: string;

  /** Trigger-Typ */
  readonly trigger: SyncTriggerType;

  /** Push ausführen? */
  readonly shouldPush: boolean;

  /** Pull ausführen? */
  readonly shouldPull: boolean;
}

/**
 * Ergebnis einer Sync-Aktion
 */
export interface SyncActionResult {
  readonly projectId: string;
  readonly success: boolean;
  readonly pushSuccess: boolean | null;
  readonly pullSuccess: boolean | null;
  readonly error?: string;
  readonly duration: number;
  readonly timestamp: Date;
}

/**
 * Callback für Sync-Aktionen
 */
export type SyncExecutor = (action: SyncAction) => Promise<SyncActionResult>;

/**
 * Event-Typen des Schedulers
 */
export type SchedulerEventType =
  | 'scheduler:started'
  | 'scheduler:stopped'
  | 'scheduler:paused'
  | 'scheduler:resumed'
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed';

/**
 * Scheduler Event
 */
export interface SchedulerEvent {
  readonly type: SchedulerEventType;
  readonly projectId?: string;
  readonly trigger?: SyncTriggerType;
  readonly result?: SyncActionResult;
  readonly error?: string;
  readonly timestamp: Date;
}

/**
 * Callback für Scheduler-Events
 */
export type SchedulerEventCallback = (event: SchedulerEvent) => void;

/**
 * Timer-Info für internes Tracking
 */
interface TimerInfo {
  timer: ReturnType<typeof setInterval>;
  config: ProjectSyncConfig;
  lastSyncAt: Date | null;
  nextSyncAt: Date;
}

/**
 * Konfiguration für SyncScheduler
 */
export interface SyncSchedulerConfig {
  /** Globale Sync-Konfiguration */
  readonly globalConfig: GlobalSyncConfig;

  /** Sync-Executor (führt Push/Pull aus) */
  readonly executor: SyncExecutor;

  /** Callback für Events */
  readonly onEvent?: SchedulerEventCallback;
}

// =============================================================================
// 🛠️ SYNC SCHEDULER CLASS
// =============================================================================

/**
 * SyncScheduler verwaltet Timer-basierte Synchronisation
 *
 * Features:
 * - Pro-Projekt Timer-Management
 * - Startup-Sync
 * - Pause/Resume aller Timer
 * - Immediate Sync Trigger
 */
export class SyncScheduler {
  private timers: Map<string, TimerInfo> = new Map();
  private listeners: Set<SchedulerEventCallback> = new Set();
  private isPaused = false;
  private globalConfig: GlobalSyncConfig;
  private executor: SyncExecutor;

  constructor(config: SyncSchedulerConfig) {
    this.globalConfig = config.globalConfig;
    this.executor = config.executor;

    if (config.onEvent) {
      this.listeners.add(config.onEvent);
    }
  }

  // ===========================================================================
  // ⏰ SCHEDULER MANAGEMENT
  // ===========================================================================

  /**
   * Startet den Scheduler für ein Projekt
   */
  startScheduler(projectConfig: ProjectSyncConfig): void {
    const projectId = projectConfig.projectId;

    // Bestehenden Timer stoppen
    this.stopScheduler(projectId);

    // Config zusammenführen und Intervall berechnen
    const config = createSyncConfig(this.globalConfig, projectConfig);
    const interval = getEffectiveInterval(config);

    // Kein Timer bei Intervall 0 oder deaktiviert
    if (interval === 0 || !isSyncEnabled(config)) {
      return;
    }

    // Timer starten
    const timer = setInterval(() => void this.executeAutoSync(projectId), interval);

    const now = new Date();

    this.timers.set(projectId, {
      timer,
      config: projectConfig,
      lastSyncAt: null,
      nextSyncAt: new Date(now.getTime() + interval),
    });

    this.emit({
      type: 'scheduler:started',
      projectId,
      timestamp: now,
    });
  }

  /**
   * Stoppt den Scheduler für ein Projekt
   */
  stopScheduler(projectId: string): void {
    const timerInfo = this.timers.get(projectId);

    if (!timerInfo) {
      return;
    }

    clearInterval(timerInfo.timer);
    this.timers.delete(projectId);

    this.emit({
      type: 'scheduler:stopped',
      projectId,
      timestamp: new Date(),
    });
  }

  /**
   * Aktualisiert das Intervall für ein Projekt
   */
  rescheduleSync(projectId: string, newConfig: ProjectSyncConfig): void {
    this.stopScheduler(projectId);
    this.startScheduler(newConfig);
  }

  /**
   * Pausiert alle Scheduler
   */
  pauseAllSchedulers(): void {
    if (this.isPaused) {
      return;
    }

    for (const [, timerInfo] of this.timers) {
      clearInterval(timerInfo.timer);
    }

    this.isPaused = true;

    this.emit({
      type: 'scheduler:paused',
      timestamp: new Date(),
    });
  }

  /**
   * Setzt alle Scheduler fort
   */
  resumeAllSchedulers(): void {
    if (!this.isPaused) {
      return;
    }

    const projects = Array.from(this.timers.entries());

    // Alte Timer-Infos speichern und Timer neu starten
    for (const [projectId, timerInfo] of projects) {
      this.startScheduler(timerInfo.config);
    }

    this.isPaused = false;

    this.emit({
      type: 'scheduler:resumed',
      timestamp: new Date(),
    });
  }

  // ===========================================================================
  // 🔄 SYNC EXECUTION
  // ===========================================================================

  /**
   * Führt sofortigen Sync für ein Projekt aus
   */
  async triggerImmediateSync(
    projectId: string,
    trigger: SyncTriggerType = 'manual'
  ): Promise<SyncActionResult> {
    return this.executeSync(projectId, trigger);
  }

  /**
   * Führt Startup-Sync für alle registrierten Projekte aus
   */
  async executeStartupSync(): Promise<SyncActionResult[]> {
    if (!this.globalConfig.syncOnStart) {
      return [];
    }

    const results: SyncActionResult[] = [];

    for (const projectId of this.timers.keys()) {
      const result = await this.executeSync(projectId, 'startup');
      results.push(result);
    }

    return results;
  }

  /**
   * Führt Sync nach Netzwerk-Recovery für alle Projekte aus
   */
  async executeNetworkRecoverySync(): Promise<SyncActionResult[]> {
    const results: SyncActionResult[] = [];

    for (const projectId of this.timers.keys()) {
      const result = await this.executeSync(projectId, 'network_recovery');
      results.push(result);
    }

    return results;
  }

  // ===========================================================================
  // 📊 STATUS
  // ===========================================================================

  /**
   * Gibt den Status für ein Projekt zurück
   */
  getTimerStatus(projectId: string): SchedulerTimerStatus | null {
    const timerInfo = this.timers.get(projectId);

    if (!timerInfo) {
      return null;
    }

    const config = createSyncConfig(this.globalConfig, timerInfo.config);

    return {
      projectId,
      isActive: !this.isPaused,
      interval: getEffectiveInterval(config),
      nextSyncAt: this.isPaused ? null : timerInfo.nextSyncAt,
      lastSyncAt: timerInfo.lastSyncAt,
    };
  }

  /**
   * Gibt den Status aller Timer zurück
   */
  getAllTimerStatus(): SchedulerTimerStatus[] {
    return Array.from(this.timers.keys())
      .map((projectId) => this.getTimerStatus(projectId))
      .filter((status): status is SchedulerTimerStatus => status !== null);
  }

  /**
   * Prüft ob ein Projekt registriert ist
   */
  isScheduled(projectId: string): boolean {
    return this.timers.has(projectId);
  }

  /**
   * Prüft ob Scheduler pausiert ist
   */
  isPausedState(): boolean {
    return this.isPaused;
  }

  // ===========================================================================
  // 🔔 EVENTS
  // ===========================================================================

  /**
   * Registriert einen Event-Listener
   */
  on(callback: SchedulerEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Entfernt einen Event-Listener
   */
  off(callback: SchedulerEventCallback): void {
    this.listeners.delete(callback);
  }

  // ===========================================================================
  // 🧹 CLEANUP
  // ===========================================================================

  /**
   * Beendet den Scheduler und alle Timer
   */
  destroy(): void {
    for (const projectId of this.timers.keys()) {
      this.stopScheduler(projectId);
    }

    this.listeners.clear();
  }

  // ===========================================================================
  // 🔧 PRIVATE METHODS
  // ===========================================================================

  /**
   * Führt Auto-Sync aus (Timer-Callback)
   */
  private async executeAutoSync(projectId: string): Promise<void> {
    if (this.isPaused) {
      return;
    }

    await this.executeSync(projectId, 'auto');
  }

  /**
   * Führt Sync aus und aktualisiert Timer-Info
   */
  private async executeSync(
    projectId: string,
    trigger: SyncTriggerType
  ): Promise<SyncActionResult> {
    const timerInfo = this.timers.get(projectId);
    const config = timerInfo?.config ?? createProjectSyncConfig(projectId);

    const action: SyncAction = {
      projectId,
      trigger,
      shouldPush: config.pushAutomatically,
      shouldPull: config.pullAutomatically,
    };

    this.emit({
      type: 'sync:started',
      projectId,
      trigger,
      timestamp: new Date(),
    });

    const startTime = Date.now();

    try {
      const result = await this.executor(action);

      // Timer-Info aktualisieren
      if (timerInfo) {
        const syncConfig = createSyncConfig(this.globalConfig, config);
        const interval = getEffectiveInterval(syncConfig);
        const now = new Date();

        timerInfo.lastSyncAt = now;
        timerInfo.nextSyncAt = new Date(now.getTime() + interval);
      }

      this.emit({
        type: 'sync:completed',
        projectId,
        trigger,
        result,
        timestamp: new Date(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: SyncActionResult = {
        projectId,
        success: false,
        pushSuccess: null,
        pullSuccess: null,
        error: errorMessage,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };

      this.emit({
        type: 'sync:failed',
        projectId,
        trigger,
        result,
        error: errorMessage,
        timestamp: new Date(),
      });

      return result;
    }
  }

  /**
   * Emittiert ein Event an alle Listener
   */
  private emit(event: SchedulerEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[SyncScheduler] Listener error:', error);
      }
    });
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen SyncScheduler
 */
export function createSyncScheduler(config: SyncSchedulerConfig): SyncScheduler {
  return new SyncScheduler(config);
}

/**
 * Erstellt einen SyncScheduler mit Standard-Konfiguration
 */
export function createDefaultSyncScheduler(executor: SyncExecutor): SyncScheduler {
  const { DEFAULT_GLOBAL_CONFIG } = require('./sync-config.js') as {
    DEFAULT_GLOBAL_CONFIG: GlobalSyncConfig;
  };

  return new SyncScheduler({
    globalConfig: DEFAULT_GLOBAL_CONFIG,
    executor,
  });
}
