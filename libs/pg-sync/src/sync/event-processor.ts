/**
 * 🔄 Event Processor
 *
 * Verarbeitet Events vom Server und wendet sie auf lokale Features an.
 * Handler für verschiedene Event-Typen (ticket_created, status_changed, etc.)
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type { PushEventType } from './types.js';
import type {
  RemoteEvent,
  RemoteTicket,
  EventProcessResult,
  EventHandler,
  EventHandlerRegistry,
  LocalFeatureData,
} from './pull-types.js';
import type { FeatureMapper } from './feature-mapper.js';
import type { IdMapper } from './id-mapper.js';

// =============================================================================
// 📐 CONFIGURATION
// =============================================================================

/**
 * Event Processor Konfiguration
 */
export interface EventProcessorConfig {
  /**
   * Feature Mapper für Konvertierung
   */
  featureMapper: FeatureMapper;

  /**
   * ID Mapper für Remote ↔ Local Mapping
   */
  idMapper: IdMapper;

  /**
   * Callback zum Laden eines lokalen Features
   */
  loadFeature: (localId: string) => Promise<LocalFeatureData | null>;

  /**
   * Callback zum Speichern eines Features
   */
  saveFeature: (feature: LocalFeatureData) => Promise<void>;

  /**
   * Callback zum Erstellen eines neuen Features
   */
  createFeature: (feature: LocalFeatureData) => Promise<string>;

  /**
   * Callback für Feature-Suche via Remote-ID
   */
  findFeatureByRemoteId: (remoteId: string) => Promise<LocalFeatureData | null>;
}

// =============================================================================
// 🔄 EVENT PROCESSOR CLASS
// =============================================================================

/**
 * Event Processor für Server-Events
 *
 * @example
 * ```ts
 * const processor = createEventProcessor({
 *   featureMapper,
 *   idMapper,
 *   loadFeature: (id) => featureService.load(id),
 *   saveFeature: (f) => featureService.save(f),
 *   createFeature: (f) => featureService.create(f),
 *   findFeatureByRemoteId: (id) => featureService.findByRemoteId(id),
 * });
 *
 * const results = await processor.processEvents(events);
 * ```
 */
export class EventProcessor {
  private handlers: EventHandlerRegistry = {};

  constructor(private readonly config: EventProcessorConfig) {
    this.registerDefaultHandlers();
  }

  // ---------------------------------------------------------------------------
  // 🔄 MAIN PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Verarbeitet mehrere Events der Reihe nach
   */
  async processEvents(events: RemoteEvent[]): Promise<EventProcessResult[]> {
    const results: EventProcessResult[] = [];

    for (const event of events) {
      const result = await this.processEvent(event);
      results.push(result);
    }

    return results;
  }

  /**
   * Verarbeitet ein einzelnes Event
   */
  async processEvent(event: RemoteEvent): Promise<EventProcessResult> {
    const handler = this.handlers[event.type];

    if (!handler) {
      return {
        eventId: event.id,
        success: false,
        action: 'skipped',
        error: `No handler for event type: ${event.type}`,
      };
    }

    try {
      return await handler(event);
    } catch (error) {
      return {
        eventId: event.id,
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verarbeitet neue Tickets (nicht aus Events, sondern direkt)
   */
  async processNewTicket(ticket: RemoteTicket): Promise<EventProcessResult> {
    try {
      // Prüfen ob bereits lokal existiert
      const existingLocal = await this.findLocalFeature(ticket.id);

      if (existingLocal) {
        // Update statt Create
        return await this.updateLocalFeature(existingLocal, ticket);
      }

      // Neues Feature erstellen
      return await this.createLocalFeature(ticket);
    } catch (error) {
      return {
        eventId: ticket.id,
        success: false,
        action: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 🔧 HANDLER REGISTRATION
  // ---------------------------------------------------------------------------

  /**
   * Registriert einen Handler für einen Event-Typ
   */
  registerHandler(type: PushEventType, handler: EventHandler): void {
    this.handlers[type] = handler;
  }

  /**
   * Gibt alle registrierten Handler-Typen zurück
   */
  getRegisteredTypes(): PushEventType[] {
    return Object.keys(this.handlers) as PushEventType[];
  }

  // ---------------------------------------------------------------------------
  // 📋 DEFAULT HANDLERS
  // ---------------------------------------------------------------------------

  private registerDefaultHandlers(): void {
    // Ticket Created
    this.handlers.ticket_created = async (event) => {
      const payload = event.payload as { ticket?: RemoteTicket };
      const ticket = payload.ticket;

      if (!ticket) {
        return this.skipResult(event.id, 'Missing ticket in payload');
      }

      return this.processNewTicket(ticket);
    };

    // Ticket Updated
    this.handlers.ticket_updated = async (event) => {
      const payload = event.payload as {
        ticketId?: string;
        changes?: Record<string, unknown>;
      };

      if (!payload.ticketId) {
        return this.skipResult(event.id, 'Missing ticketId in payload');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      // Änderungen anwenden
      const updated = this.applyPayloadChanges(local, payload.changes ?? {});
      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Status Changed
    this.handlers.status_changed = async (event) => {
      const payload = event.payload as {
        ticketId?: string;
        to?: string;
      };

      if (!payload.ticketId || !payload.to) {
        return this.skipResult(event.id, 'Missing ticketId or status');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      // Status updaten
      const updated: LocalFeatureData = {
        ...local,
        status: this.mapRemoteStatus(payload.to),
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Ticket Claimed
    this.handlers.ticket_claimed = async (event) => {
      const payload = event.payload as {
        ticketId?: string;
        userId?: string;
        timestamp?: string;
      };

      if (!payload.ticketId) {
        return this.skipResult(event.id, 'Missing ticketId');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      const updated: LocalFeatureData = {
        ...local,
        claimedBy: payload.userId ?? null,
        claimedAt: payload.timestamp ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Ticket Unclaimed
    this.handlers.ticket_unclaimed = async (event) => {
      const payload = event.payload as { ticketId?: string };

      if (!payload.ticketId) {
        return this.skipResult(event.id, 'Missing ticketId');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      const updated: LocalFeatureData = {
        ...local,
        claimedBy: null,
        claimedAt: null,
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Ticket Completed
    this.handlers.ticket_completed = async (event) => {
      const payload = event.payload as { ticketId?: string };

      if (!payload.ticketId) {
        return this.skipResult(event.id, 'Missing ticketId');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      const updated: LocalFeatureData = {
        ...local,
        status: 'done',
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Ticket Deleted
    this.handlers.ticket_deleted = async (event) => {
      const payload = event.payload as { ticketId?: string };

      if (!payload.ticketId) {
        return this.skipResult(event.id, 'Missing ticketId');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      // Archivieren statt löschen
      const updated: LocalFeatureData = {
        ...local,
        status: 'archived',
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Label Added
    this.handlers.label_added = async (event) => {
      const payload = event.payload as { ticketId?: string; label?: string };

      if (!payload.ticketId || !payload.label) {
        return this.skipResult(event.id, 'Missing ticketId or label');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      // Label hinzufügen (falls nicht vorhanden)
      const labels = local.labels.includes(payload.label)
        ? local.labels
        : [...local.labels, payload.label];

      const updated: LocalFeatureData = {
        ...local,
        labels,
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };

    // Label Removed
    this.handlers.label_removed = async (event) => {
      const payload = event.payload as { ticketId?: string; label?: string };

      if (!payload.ticketId || !payload.label) {
        return this.skipResult(event.id, 'Missing ticketId or label');
      }

      const local = await this.findLocalFeature(payload.ticketId);

      if (!local) {
        return this.skipResult(event.id, 'Local feature not found');
      }

      // Label entfernen
      const labels = local.labels.filter((l) => l !== payload.label);

      const updated: LocalFeatureData = {
        ...local,
        labels,
        updatedAt: new Date().toISOString(),
      };

      await this.config.saveFeature(updated);

      return {
        eventId: event.id,
        success: true,
        action: 'updated',
        localId: local.id,
      };
    };
  }

  // ---------------------------------------------------------------------------
  // 🔧 HELPER METHODS
  // ---------------------------------------------------------------------------

  private async findLocalFeature(remoteId: string): Promise<LocalFeatureData | null> {
    // Erst im ID-Mapper nachschauen
    const localId = this.config.idMapper.getLocalId(remoteId);

    if (localId) {
      return this.config.loadFeature(localId);
    }

    // Fallback: Direkt nach Remote-ID suchen
    return this.config.findFeatureByRemoteId(remoteId);
  }

  private async createLocalFeature(ticket: RemoteTicket): Promise<EventProcessResult> {
    const feature = this.config.featureMapper.mapTicketToFeature(ticket);
    const localId = await this.config.createFeature(feature);

    // ID-Mapping speichern
    this.config.idMapper.setMapping(localId, ticket.id);

    return {
      eventId: ticket.id,
      success: true,
      action: 'created',
      localId,
    };
  }

  private async updateLocalFeature(
    local: LocalFeatureData,
    ticket: RemoteTicket
  ): Promise<EventProcessResult> {
    // Prüfen ob Update nötig
    if (!this.config.featureMapper.needsUpdate(local, ticket)) {
      return {
        eventId: ticket.id,
        success: true,
        action: 'skipped',
        localId: local.id,
      };
    }

    // Konflikt-Check
    if (this.config.featureMapper.hasConflict(local, ticket)) {
      return {
        eventId: ticket.id,
        success: false,
        action: 'conflict',
        localId: local.id,
        error: 'Local changes conflict with remote',
      };
    }

    // Changes extrahieren und anwenden
    const changes = this.config.featureMapper.extractChanges(local, ticket);
    const updated = this.config.featureMapper.applyChanges(local, changes);

    await this.config.saveFeature(updated);

    return {
      eventId: ticket.id,
      success: true,
      action: 'updated',
      localId: local.id,
    };
  }

  private applyPayloadChanges(
    feature: LocalFeatureData,
    changes: Record<string, unknown>
  ): LocalFeatureData {
    const updated = { ...feature };

    if (typeof changes.title === 'string') {
      updated.title = changes.title;
    }

    if (typeof changes.description === 'string') {
      updated.description = changes.description;
    }

    if (typeof changes.status === 'string') {
      updated.status = this.mapRemoteStatus(changes.status);
    }

    if (typeof changes.priority === 'string') {
      updated.priority = changes.priority;
    }

    if (Array.isArray(changes.labels)) {
      updated.labels = changes.labels as string[];
    }

    updated.updatedAt = new Date().toISOString();
    updated.lastSyncedAt = new Date().toISOString();
    updated.syncStatus = 'synced';

    return updated;
  }

  private mapRemoteStatus(remoteStatus: string): string {
    const mapping: Record<string, string> = {
      backlog: 'backlog',
      todo: 'todo',
      in_progress: 'in-progress',
      review: 'review',
      done: 'done',
      archived: 'archived',
    };

    return mapping[remoteStatus] ?? remoteStatus;
  }

  private skipResult(eventId: string, reason: string): EventProcessResult {
    return {
      eventId,
      success: true,
      action: 'skipped',
      error: reason,
    };
  }
}

// =============================================================================
// 🏭 FACTORY FUNCTION
// =============================================================================

/**
 * Erstellt einen neuen Event Processor
 */
export function createEventProcessor(config: EventProcessorConfig): EventProcessor {
  return new EventProcessor(config);
}
