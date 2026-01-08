/**
 * 🔊 Sync Listener
 *
 * Event-basierte Integration in bestehenden Code.
 * Fängt Feature-Events ab und erstellt Outbox-Einträge.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 */

import type { OutboxManager, CreateOutboxEntry } from './outbox-manager.js';
import type {
  PushEventType,
  TicketCreatedPayload,
  TicketUpdatedPayload,
  StatusChangedPayload,
  TicketClaimedPayload,
  TicketUnclaimedPayload,
  TicketCompletedPayload,
  TicketDeletedPayload,
  LabelChangedPayload,
} from './types.js';
import { mapStatusToRemote, mapPriorityToRemote } from './types.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Feature-Daten aus dem lokalen System
 */
export interface LocalFeature {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  labels: string[];
  projectId: string;
  createdAt?: Date;
  updatedAt?: Date;
  version?: number;
}

/**
 * Status-Änderungs-Event
 */
export interface StatusChangeEvent {
  featureId: string;
  projectId: string;
  from: string;
  to: string;
  userId?: string;
}

/**
 * Claim-Event
 */
export interface ClaimEvent {
  featureId: string;
  projectId: string;
  userId: string;
}

/**
 * Unclaim-Event
 */
export interface UnclaimEvent {
  featureId: string;
  projectId: string;
  previousUserId: string;
}

/**
 * Label-Event
 */
export interface LabelEvent {
  featureId: string;
  projectId: string;
  label: string;
  action: 'added' | 'removed';
}

/**
 * Event-Handler Typ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FeatureEventHandler = (data: any) => void | Promise<void>;

/**
 * Event-Typen die der Listener behandelt
 */
export type FeatureEventType =
  | 'feature:created'
  | 'feature:updated'
  | 'feature:deleted'
  | 'feature:statusChanged'
  | 'feature:claimed'
  | 'feature:unclaimed'
  | 'feature:completed'
  | 'feature:labelAdded'
  | 'feature:labelRemoved';

// =============================================================================
// 🔊 SYNC LISTENER CLASS
// =============================================================================

/**
 * SyncListener - Fängt lokale Events ab und erstellt Outbox-Einträge
 *
 * Kann mit beliebigem EventEmitter verwendet werden.
 * Events werden automatisch in Outbox-Einträge konvertiert.
 */
export class SyncListener {
  private readonly outboxManager: OutboxManager;
  private readonly enabled: boolean;
  private readonly handlers: Map<string, FeatureEventHandler> = new Map();

  constructor(outboxManager: OutboxManager, enabled: boolean = true) {
    this.outboxManager = outboxManager;
    this.enabled = enabled;

    // Handler registrieren
    this.registerHandlers();
  }

  // ===========================================================================
  // 📝 HANDLER REGISTRATION
  // ===========================================================================

  /**
   * Registriert alle Event-Handler
   */
  private registerHandlers(): void {
    this.handlers.set('feature:created', this.handleFeatureCreated.bind(this));
    this.handlers.set('feature:updated', this.handleFeatureUpdated.bind(this));
    this.handlers.set('feature:deleted', this.handleFeatureDeleted.bind(this));
    this.handlers.set('feature:statusChanged', this.handleStatusChanged.bind(this));
    this.handlers.set('feature:claimed', this.handleFeatureClaimed.bind(this));
    this.handlers.set('feature:unclaimed', this.handleFeatureUnclaimed.bind(this));
    this.handlers.set('feature:completed', this.handleFeatureCompleted.bind(this));
    this.handlers.set('feature:labelAdded', this.handleLabelAdded.bind(this));
    this.handlers.set('feature:labelRemoved', this.handleLabelRemoved.bind(this));
  }

  /**
   * Gibt Handler für einen Event-Typ zurück
   */
  getHandler(eventType: FeatureEventType): FeatureEventHandler | undefined {
    return this.handlers.get(eventType);
  }

  /**
   * Gibt alle registrierten Event-Typen zurück
   */
  getRegisteredEvents(): FeatureEventType[] {
    return Array.from(this.handlers.keys()) as FeatureEventType[];
  }

  // ===========================================================================
  // 🎫 EVENT HANDLERS
  // ===========================================================================

  /**
   * Handler: Feature erstellt
   */
  async handleFeatureCreated(feature: LocalFeature): Promise<void> {
    if (!this.enabled) return;

    const payload: TicketCreatedPayload = {
      type: 'ticket_created',
      ticket: {
        localId: feature.id,
        title: feature.title,
        description: feature.description,
        status: mapStatusToRemote(feature.status),
        priority: mapPriorityToRemote(feature.priority),
        labels: feature.labels,
      },
    };

    await this.addToOutbox({
      eventType: 'ticket_created',
      entityType: 'ticket',
      entityId: feature.id,
      localId: feature.id,
      projectId: feature.projectId,
      payload,
    });
  }

  /**
   * Handler: Feature aktualisiert
   */
  async handleFeatureUpdated(data: {
    feature: LocalFeature;
    changes: { field: string; oldValue: unknown; newValue: unknown }[];
  }): Promise<void> {
    if (!this.enabled) return;
    if (data.changes.length === 0) return; // Keine Änderungen

    const payload: TicketUpdatedPayload = {
      type: 'ticket_updated',
      ticketId: data.feature.id,
      localId: data.feature.id,
      changes: data.changes,
      version: data.feature.version ?? 1,
    };

    await this.addToOutbox({
      eventType: 'ticket_updated',
      entityType: 'ticket',
      entityId: data.feature.id,
      localId: data.feature.id,
      projectId: data.feature.projectId,
      payload,
    });
  }

  /**
   * Handler: Feature gelöscht
   */
  async handleFeatureDeleted(data: { featureId: string; projectId: string }): Promise<void> {
    if (!this.enabled) return;

    const payload: TicketDeletedPayload = {
      type: 'ticket_deleted',
      ticketId: data.featureId,
      localId: data.featureId,
      timestamp: new Date(),
    };

    await this.addToOutbox({
      eventType: 'ticket_deleted',
      entityType: 'ticket',
      entityId: data.featureId,
      localId: data.featureId,
      projectId: data.projectId,
      payload,
    });
  }

  /**
   * Handler: Status geändert
   */
  async handleStatusChanged(event: StatusChangeEvent): Promise<void> {
    if (!this.enabled) return;

    const payload: StatusChangedPayload = {
      type: 'status_changed',
      ticketId: event.featureId,
      localId: event.featureId,
      from: mapStatusToRemote(event.from),
      to: mapStatusToRemote(event.to),
      timestamp: new Date(),
    };

    await this.addToOutbox({
      eventType: 'status_changed',
      entityType: 'ticket',
      entityId: event.featureId,
      localId: event.featureId,
      projectId: event.projectId,
      payload,
    });
  }

  /**
   * Handler: Feature geclaimed
   */
  async handleFeatureClaimed(event: ClaimEvent): Promise<void> {
    if (!this.enabled) return;

    const payload: TicketClaimedPayload = {
      type: 'ticket_claimed',
      ticketId: event.featureId,
      localId: event.featureId,
      userId: event.userId,
      timestamp: new Date(),
    };

    await this.addToOutbox({
      eventType: 'ticket_claimed',
      entityType: 'ticket',
      entityId: event.featureId,
      localId: event.featureId,
      projectId: event.projectId,
      payload,
    });
  }

  /**
   * Handler: Feature unclaimed
   */
  async handleFeatureUnclaimed(event: UnclaimEvent): Promise<void> {
    if (!this.enabled) return;

    const payload: TicketUnclaimedPayload = {
      type: 'ticket_unclaimed',
      ticketId: event.featureId,
      localId: event.featureId,
      previousUserId: event.previousUserId,
      timestamp: new Date(),
    };

    await this.addToOutbox({
      eventType: 'ticket_unclaimed',
      entityType: 'ticket',
      entityId: event.featureId,
      localId: event.featureId,
      projectId: event.projectId,
      payload,
    });
  }

  /**
   * Handler: Feature abgeschlossen
   */
  async handleFeatureCompleted(data: {
    featureId: string;
    projectId: string;
    userId: string;
  }): Promise<void> {
    if (!this.enabled) return;

    const payload: TicketCompletedPayload = {
      type: 'ticket_completed',
      ticketId: data.featureId,
      localId: data.featureId,
      userId: data.userId,
      timestamp: new Date(),
    };

    await this.addToOutbox({
      eventType: 'ticket_completed',
      entityType: 'ticket',
      entityId: data.featureId,
      localId: data.featureId,
      projectId: data.projectId,
      payload,
    });
  }

  /**
   * Handler: Label hinzugefügt
   */
  async handleLabelAdded(event: LabelEvent): Promise<void> {
    if (!this.enabled) return;

    const payload: LabelChangedPayload = {
      type: 'label_added',
      ticketId: event.featureId,
      localId: event.featureId,
      label: event.label,
    };

    await this.addToOutbox({
      eventType: 'label_added',
      entityType: 'ticket',
      entityId: event.featureId,
      localId: event.featureId,
      projectId: event.projectId,
      payload,
    });
  }

  /**
   * Handler: Label entfernt
   */
  async handleLabelRemoved(event: LabelEvent): Promise<void> {
    if (!this.enabled) return;

    const payload: LabelChangedPayload = {
      type: 'label_removed',
      ticketId: event.featureId,
      localId: event.featureId,
      label: event.label,
    };

    await this.addToOutbox({
      eventType: 'label_removed',
      entityType: 'ticket',
      entityId: event.featureId,
      localId: event.featureId,
      projectId: event.projectId,
      payload,
    });
  }

  // ===========================================================================
  // 📦 OUTBOX
  // ===========================================================================

  /**
   * Fügt Eintrag zur Outbox hinzu
   */
  private async addToOutbox(entry: CreateOutboxEntry): Promise<void> {
    try {
      await this.outboxManager.add(entry);
    } catch (error) {
      // Log error but don't throw - sync should not break main workflow
      console.error('[SyncListener] Failed to add to outbox:', error);
    }
  }

  // ===========================================================================
  // 🔧 UTILS
  // ===========================================================================

  /**
   * Prüft ob der Listener aktiv ist
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// =============================================================================
// 🏭 FACTORY
// =============================================================================

/**
 * Erstellt einen neuen SyncListener
 */
export function createSyncListener(
  outboxManager: OutboxManager,
  enabled: boolean = true
): SyncListener {
  return new SyncListener(outboxManager, enabled);
}

/**
 * Registriert SyncListener an einem EventEmitter
 *
 * Kann mit Node EventEmitter oder Browser CustomEvents verwendet werden.
 */
export function registerSyncListeners(
  listener: SyncListener,
  emitter: {
    on: (event: string, handler: (...args: unknown[]) => void) => void;
  }
): void {
  for (const eventType of listener.getRegisteredEvents()) {
    const handler = listener.getHandler(eventType);
    if (handler) {
      emitter.on(eventType, handler);
    }
  }
}
