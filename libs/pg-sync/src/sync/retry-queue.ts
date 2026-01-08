/**
 * 🔄 Retry Queue
 *
 * Verwaltet fehlgeschlagene Sync-Operationen mit Exponential Backoff.
 * Unterstützt automatische Wiederholungsversuche und manuelle Retry-Trigger.
 *
 * @see docs/pg-online-sync/tasks/phase-1.5-auto-sync.md
 */

import { RetryConfig, DEFAULT_RETRY_CONFIG, calculateBackoff, canRetry } from './sync-config.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Typ der fehlgeschlagenen Operation
 */
export type RetryOperationType = 'push' | 'pull' | 'health_check';

/**
 * Ein Element in der Retry-Queue
 */
export interface RetryQueueItem<T = unknown> {
  /** Eindeutige ID */
  readonly id: string;

  /** Typ der Operation */
  readonly type: RetryOperationType;

  /** Projekt-ID (falls zutreffend) */
  readonly projectId: string | null;

  /** Payload der Operation */
  readonly payload: T;

  /** Anzahl bisheriger Versuche */
  readonly attempt: number;

  /** Ursprünglicher Fehler */
  readonly originalError: string;

  /** Zeitpunkt des nächsten Retry */
  readonly nextRetryAt: Date;

  /** Zeitpunkt der Erstellung */
  readonly createdAt: Date;
}

/**
 * Retry-Ergebnis
 */
export interface RetryResult {
  readonly success: boolean;
  readonly itemId: string;
  readonly error?: string;
}

/**
 * Retry-Handler Funktion
 */
export type RetryHandler<T = unknown> = (item: RetryQueueItem<T>) => Promise<boolean>;

/**
 * Event-Typen der Retry-Queue
 */
export type RetryQueueEventType =
  | 'item:added'
  | 'item:success'
  | 'item:failed'
  | 'item:exhausted'
  | 'queue:empty'
  | 'queue:processing';

/**
 * Retry-Queue Event
 */
export interface RetryQueueEvent {
  readonly type: RetryQueueEventType;
  readonly item?: RetryQueueItem;
  readonly error?: string;
}

/**
 * Callback für Queue-Events
 */
export type RetryQueueCallback = (event: RetryQueueEvent) => void;

/**
 * Konfiguration für RetryQueue
 */
export interface RetryQueueConfig {
  /** Retry-Konfiguration */
  readonly retry: RetryConfig;

  /** Automatisch verarbeiten (mit Timer) */
  readonly autoProcess: boolean;

  /** Intervall für automatische Verarbeitung (ms) */
  readonly processInterval: number;
}

// =============================================================================
// 📊 CONSTANTS
// =============================================================================

/**
 * Standard-Konfiguration
 */
export const DEFAULT_RETRY_QUEUE_CONFIG: RetryQueueConfig = {
  retry: DEFAULT_RETRY_CONFIG,
  autoProcess: true,
  processInterval: 5000, // 5 Sekunden
} as const;

// =============================================================================
// 🛠️ RETRY QUEUE CLASS
// =============================================================================

/**
 * RetryQueue verwaltet fehlgeschlagene Operationen
 *
 * Features:
 * - Exponential Backoff für Wiederholungsversuche
 * - Typ-spezifische Handler
 * - Event-Callbacks für Monitoring
 * - Automatische oder manuelle Verarbeitung
 */
export class RetryQueue {
  private queue: Map<string, RetryQueueItem> = new Map();
  private handlers: Map<RetryOperationType, RetryHandler> = new Map();
  private listeners: Set<RetryQueueCallback> = new Set();
  private processTimer: ReturnType<typeof setInterval> | null = null;
  private isProcessing = false;
  private config: RetryQueueConfig;

  constructor(config: Partial<RetryQueueConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_QUEUE_CONFIG, ...config };

    if (this.config.autoProcess) {
      this.startAutoProcess();
    }
  }

  // ===========================================================================
  // 📥 QUEUE MANAGEMENT
  // ===========================================================================

  /**
   * Fügt eine fehlgeschlagene Operation zur Queue hinzu
   */
  add<T>(
    type: RetryOperationType,
    payload: T,
    error: string,
    projectId?: string
  ): RetryQueueItem<T> {
    const id = this.generateId();
    const now = new Date();

    const item: RetryQueueItem<T> = {
      id,
      type,
      projectId: projectId ?? null,
      payload,
      attempt: 0,
      originalError: error,
      nextRetryAt: new Date(now.getTime() + this.config.retry.baseDelay),
      createdAt: now,
    };

    this.queue.set(id, item);
    this.emit({ type: 'item:added', item });

    return item;
  }

  /**
   * Entfernt ein Element aus der Queue
   */
  remove(itemId: string): boolean {
    return this.queue.delete(itemId);
  }

  /**
   * Entfernt alle Elemente eines bestimmten Typs
   */
  removeByType(type: RetryOperationType): number {
    let removed = 0;

    for (const [id, item] of this.queue) {
      if (item.type === type) {
        this.queue.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Entfernt alle Elemente eines Projekts
   */
  removeByProject(projectId: string): number {
    let removed = 0;

    for (const [id, item] of this.queue) {
      if (item.projectId === projectId) {
        this.queue.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Leert die gesamte Queue
   */
  clear(): void {
    this.queue.clear();
    this.emit({ type: 'queue:empty' });
  }

  // ===========================================================================
  // 📊 QUERY
  // ===========================================================================

  /**
   * Gibt die Anzahl der Elemente zurück
   */
  size(): number {
    return this.queue.size;
  }

  /**
   * Prüft ob Queue leer ist
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Gibt alle Elemente zurück
   */
  getAll(): RetryQueueItem[] {
    return Array.from(this.queue.values());
  }

  /**
   * Gibt Elemente nach Typ zurück
   */
  getByType(type: RetryOperationType): RetryQueueItem[] {
    return this.getAll().filter((item) => item.type === type);
  }

  /**
   * Gibt Elemente zurück die bereit für Retry sind
   */
  getReady(): RetryQueueItem[] {
    const now = new Date();
    return this.getAll().filter((item) => item.nextRetryAt <= now);
  }

  /**
   * Gibt die nächste Retry-Zeit zurück
   */
  getNextRetryTime(): Date | null {
    if (this.queue.size === 0) {
      return null;
    }

    let earliest: Date | null = null;

    for (const item of this.queue.values()) {
      if (!earliest || item.nextRetryAt < earliest) {
        earliest = item.nextRetryAt;
      }
    }

    return earliest;
  }

  // ===========================================================================
  // 🔧 HANDLERS
  // ===========================================================================

  /**
   * Registriert einen Handler für einen Operationstyp
   */
  registerHandler<T>(type: RetryOperationType, handler: RetryHandler<T>): void {
    this.handlers.set(type, handler as RetryHandler);
  }

  /**
   * Entfernt einen Handler
   */
  unregisterHandler(type: RetryOperationType): void {
    this.handlers.delete(type);
  }

  // ===========================================================================
  // 🔔 EVENTS
  // ===========================================================================

  /**
   * Registriert einen Event-Listener
   */
  on(callback: RetryQueueCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Entfernt einen Event-Listener
   */
  off(callback: RetryQueueCallback): void {
    this.listeners.delete(callback);
  }

  // ===========================================================================
  // 🔄 PROCESSING
  // ===========================================================================

  /**
   * Verarbeitet alle bereiten Elemente
   */
  async processQueue(): Promise<RetryResult[]> {
    if (this.isProcessing) {
      return [];
    }

    this.isProcessing = true;
    this.emit({ type: 'queue:processing' });

    const ready = this.getReady();
    const results: RetryResult[] = [];

    for (const item of ready) {
      const result = await this.processItem(item);
      results.push(result);
    }

    this.isProcessing = false;

    if (this.isEmpty()) {
      this.emit({ type: 'queue:empty' });
    }

    return results;
  }

  /**
   * Verarbeitet ein einzelnes Element
   */
  async processItem(item: RetryQueueItem): Promise<RetryResult> {
    const handler = this.handlers.get(item.type);

    if (!handler) {
      // Kein Handler: Element entfernen
      this.remove(item.id);
      return { success: false, itemId: item.id, error: 'No handler registered' };
    }

    try {
      const success = await handler(item);

      if (success) {
        this.remove(item.id);
        this.emit({ type: 'item:success', item });
        return { success: true, itemId: item.id };
      } else {
        return this.handleFailure(item, 'Handler returned false');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.handleFailure(item, errorMessage);
    }
  }

  /**
   * Startet automatische Verarbeitung
   */
  startAutoProcess(): void {
    if (this.processTimer) {
      return;
    }

    this.processTimer = setInterval(() => void this.processQueue(), this.config.processInterval);
  }

  /**
   * Stoppt automatische Verarbeitung
   */
  stopAutoProcess(): void {
    if (this.processTimer) {
      clearInterval(this.processTimer);
      this.processTimer = null;
    }
  }

  /**
   * Beendet die Retry-Queue
   */
  destroy(): void {
    this.stopAutoProcess();
    this.queue.clear();
    this.handlers.clear();
    this.listeners.clear();
  }

  // ===========================================================================
  // 🔧 PRIVATE METHODS
  // ===========================================================================

  /**
   * Behandelt einen fehlgeschlagenen Retry-Versuch
   */
  private handleFailure(item: RetryQueueItem, error: string): RetryResult {
    const nextAttempt = item.attempt + 1;

    if (!canRetry(nextAttempt, this.config.retry)) {
      // Max Retries erreicht
      this.remove(item.id);
      this.emit({ type: 'item:exhausted', item, error });
      return { success: false, itemId: item.id, error: 'Max retries exhausted' };
    }

    // Neuer Versuch mit Backoff
    const delay = calculateBackoff(nextAttempt, this.config.retry);
    const updatedItem: RetryQueueItem = {
      ...item,
      attempt: nextAttempt,
      nextRetryAt: new Date(Date.now() + delay),
    };

    this.queue.set(item.id, updatedItem);
    this.emit({ type: 'item:failed', item: updatedItem, error });

    return { success: false, itemId: item.id, error };
  }

  /**
   * Generiert eine eindeutige ID
   */
  private generateId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Emittiert ein Event an alle Listener
   */
  private emit(event: RetryQueueEvent): void {
    this.listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[RetryQueue] Listener error:', error);
      }
    });
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt eine neue RetryQueue
 */
export function createRetryQueue(config?: Partial<RetryQueueConfig>): RetryQueue {
  return new RetryQueue(config);
}
