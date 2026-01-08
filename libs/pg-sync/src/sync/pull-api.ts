/**
 * 🌐 Pull API
 *
 * HTTP-Client für Pull-Operationen.
 * Kommuniziert mit dem Server für Events und neue Tickets.
 *
 * @see docs/pg-online-sync/tasks/phase-1.4-pull-mechanismus.md
 */

import type {
  PullConfig,
  PullRequestParams,
  PullResponsePayload,
  RemoteEvent,
  RemoteTicket,
} from './pull-types.js';

// =============================================================================
// 📐 CONFIGURATION
// =============================================================================

/**
 * Pull API Konfiguration
 */
export interface PullApiConfig {
  /**
   * API Base URL
   */
  baseUrl: string;

  /**
   * Timeout in ms
   * @default 30000
   */
  timeoutMs: number;

  /**
   * Auth-Token Getter
   */
  getAuthToken?: () => Promise<string | null>;

  /**
   * Custom Headers
   */
  customHeaders?: Record<string, string>;
}

/**
 * Pull API Error
 */
export class PullApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly isRetryable: boolean
  ) {
    super(message);
    this.name = 'PullApiError';
  }
}

// =============================================================================
// 🌐 PULL API CLASS
// =============================================================================

/**
 * Pull API Client für Remote-Kommunikation
 *
 * @example
 * ```ts
 * const api = createPullApi({
 *   baseUrl: '/api/pg-sync',
 *   timeoutMs: 30000,
 * });
 *
 * const response = await api.fetchEvents({
 *   projectId: 'proj-123',
 *   since: '2026-01-05T00:00:00Z',
 * });
 * ```
 */
export class PullApi {
  constructor(private readonly config: PullApiConfig) {}

  // ---------------------------------------------------------------------------
  // 📥 FETCH METHODS
  // ---------------------------------------------------------------------------

  /**
   * Holt Events seit einem bestimmten Zeitpunkt
   */
  async fetchEvents(params: PullRequestParams): Promise<PullResponsePayload> {
    const url = this.buildUrl('/pull', {
      projectId: params.projectId,
      since: params.since,
      limit: params.limit?.toString(),
      cursor: params.cursor,
    });

    return this.executeRequest<PullResponsePayload>(url);
  }

  /**
   * Holt nur neue Tickets (ohne Events)
   */
  async fetchNewTickets(projectId: string, since: string): Promise<RemoteTicket[]> {
    const url = this.buildUrl('/pull/tickets', {
      projectId,
      since,
    });

    const response = await this.executeRequest<{
      success: boolean;
      data: { tickets: RemoteTicket[] };
    }>(url);

    return response.data.tickets;
  }

  /**
   * Holt den aktuellen Sync-Status vom Server
   */
  async fetchSyncStatus(projectId: string): Promise<SyncStatusResponse> {
    const url = this.buildUrl('/pull/status', { projectId });
    return this.executeRequest<SyncStatusResponse>(url);
  }

  /**
   * Health-Check für Verbindungstest
   */
  async healthCheck(): Promise<boolean> {
    try {
      const url = this.buildUrl('/health');
      const response = await this.executeRequest<{ status: string }>(url);
      return response.status === 'ok';
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 📥 PAGINATED FETCH
  // ---------------------------------------------------------------------------

  /**
   * Holt alle Events mit automatischer Pagination
   */
  async fetchAllEvents(
    projectId: string,
    since: string,
    onProgress?: (fetched: number, hasMore: boolean) => void
  ): Promise<{ events: RemoteEvent[]; tickets: RemoteTicket[] }> {
    const allEvents: RemoteEvent[] = [];
    const allTickets: RemoteTicket[] = [];
    let cursor: string | null = null;
    let hasMore = true;

    while (hasMore) {
      const response = await this.fetchEvents({
        projectId,
        since,
        cursor: cursor ?? undefined,
      });

      if (!response.success) {
        throw new PullApiError(response.error ?? 'Unknown error', 500, true);
      }

      allEvents.push(...response.data.events);
      allTickets.push(...response.data.newTickets);

      hasMore = response.data.hasMore;
      cursor = response.data.cursor;

      onProgress?.(allEvents.length, hasMore);
    }

    return { events: allEvents, tickets: allTickets };
  }

  // ---------------------------------------------------------------------------
  // 🔧 PRIVATE METHODS
  // ---------------------------------------------------------------------------

  private buildUrl(path: string, params?: Record<string, string | undefined>): string {
    const url = new URL(path, this.ensureBaseUrl());

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.set(key, value);
        }
      });
    }

    return url.toString();
  }

  private ensureBaseUrl(): string {
    const base = this.config.baseUrl;

    // Falls relative URL: Mit Default-Server-URL kombinieren
    // In der Praxis sollte die vollständige URL über Config bereitgestellt werden
    if (base.startsWith('/')) {
      // Default für Entwicklung - in Produktion sollte vollständige URL konfiguriert sein
      return `http://localhost:3000${base}`;
    }

    return base;
  }

  private async executeRequest<T>(url: string): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...this.config.customHeaders,
      };

      // Auth-Token hinzufügen falls verfügbar
      if (this.config.getAuthToken) {
        const token = await this.config.getAuthToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new PullApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          this.isRetryableStatus(response.status)
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof PullApiError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new PullApiError('Request timeout', 408, true);
        }

        throw new PullApiError(error.message, 0, true);
      }

      throw new PullApiError('Unknown error', 0, true);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private isRetryableStatus(status: number): boolean {
    // 5xx Fehler und einige 4xx sind retryable
    return status >= 500 || status === 408 || status === 429;
  }
}

// =============================================================================
// 📊 RESPONSE TYPES
// =============================================================================

/**
 * Sync-Status Response vom Server
 */
export interface SyncStatusResponse {
  success: boolean;
  data: {
    serverTime: string;
    lastEventId: string | null;
    totalEvents: number;
    pendingForClient: number;
  };
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt einen neuen Pull API Client
 */
export function createPullApi(config: PullApiConfig): PullApi {
  return new PullApi(config);
}

/**
 * Erstellt Pull API mit Default-Config
 */
export function createDefaultPullApi(baseUrl = '/api/pg-sync'): PullApi {
  return new PullApi({
    baseUrl,
    timeoutMs: 30_000,
  });
}

/**
 * Pull Config zu API Config konvertieren
 */
export function pullConfigToApiConfig(pullConfig: PullConfig): PullApiConfig {
  return {
    baseUrl: pullConfig.apiBaseUrl,
    timeoutMs: pullConfig.timeoutMs,
  };
}
