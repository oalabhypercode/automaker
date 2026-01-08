/**
 * 🌐 Push API
 *
 * HTTP-Client für Push-Requests an den Server.
 * Abstrahiert die API-Kommunikation für den Push-Service.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 */

import type {
  PushRequestPayload,
  PushRequestEvent,
  PushResponsePayload,
  PushResult,
  PushConflict,
  PushConfig,
  DEFAULT_PUSH_CONFIG,
} from './types.js';
import type { DbOutboxItem } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * API Error Response
 */
export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: unknown;
}

/**
 * HTTP Request Optionen
 */
export interface RequestOptions {
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Push API Konfiguration
 */
export interface PushApiConfig {
  baseUrl: string;
  timeout: number;
  authToken?: string;
}

// =============================================================================
// 🌐 PUSH API CLASS
// =============================================================================

/**
 * PushApi - HTTP Client für Push-Operationen
 */
export class PushApi {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private authToken?: string;

  constructor(config: PushApiConfig) {
    this.baseUrl = config.baseUrl;
    this.timeout = config.timeout;
    this.authToken = config.authToken;
  }

  // ===========================================================================
  // 🔑 AUTH
  // ===========================================================================

  /**
   * Setzt den Auth-Token
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Entfernt den Auth-Token
   */
  clearAuthToken(): void {
    this.authToken = undefined;
  }

  // ===========================================================================
  // 📤 PUSH
  // ===========================================================================

  /**
   * Sendet einen Batch von Events an den Server
   */
  async pushEvents(payload: PushRequestPayload): Promise<PushResponsePayload> {
    const response = await this.post<PushResponsePayload>('/push', payload);

    return response;
  }

  /**
   * Pusht ein einzelnes Ticket (erstellen)
   */
  async createTicket(
    projectId: string,
    data: {
      localId: string;
      title: string;
      description: string;
      status: string;
      priority: string;
      labels: string[];
    }
  ): Promise<{ remoteId: string; success: boolean }> {
    const response = await this.post<{ id: string; success: boolean }>(
      `/push/${projectId}/ticket`,
      data
    );

    return {
      remoteId: response.id,
      success: response.success,
    };
  }

  /**
   * Aktualisiert ein Ticket
   */
  async updateTicket(
    projectId: string,
    ticketId: string,
    data: {
      changes: Record<string, unknown>;
      version: number;
    }
  ): Promise<PushResult> {
    return this.patch<PushResult>(`/push/${projectId}/ticket/${ticketId}`, data);
  }

  /**
   * Ändert den Status eines Tickets
   */
  async updateTicketStatus(
    projectId: string,
    ticketId: string,
    data: {
      from: string;
      to: string;
    }
  ): Promise<PushResult> {
    return this.patch<PushResult>(`/push/${projectId}/ticket/${ticketId}/status`, data);
  }

  /**
   * Claimed ein Ticket
   */
  async claimTicket(projectId: string, ticketId: string, userId: string): Promise<PushResult> {
    return this.post<PushResult>(`/push/${projectId}/ticket/${ticketId}/claim`, { userId });
  }

  /**
   * Unclaims ein Ticket
   */
  async unclaimTicket(projectId: string, ticketId: string): Promise<PushResult> {
    return this.post<PushResult>(`/push/${projectId}/ticket/${ticketId}/unclaim`, {});
  }

  // ===========================================================================
  // 🔧 HTTP HELPERS
  // ===========================================================================

  /**
   * POST Request
   */
  private async post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  /**
   * PATCH Request
   */
  private async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('PATCH', path, body);
  }

  /**
   * Allgemeiner HTTP Request
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Parse Response
      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        throw new PushApiError(
          (data.error as string) ?? 'Unknown error',
          response.status,
          data.code as string | undefined,
          data
        );
      }

      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      // Abort/Timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new PushApiError('Request timeout', 408, 'TIMEOUT');
      }

      // Network Error
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new PushApiError('Network error', 0, 'NETWORK_ERROR');
      }

      // Re-throw PushApiErrors
      if (error instanceof PushApiError) {
        throw error;
      }

      // Unknown Error
      throw new PushApiError(
        error instanceof Error ? error.message : 'Unknown error',
        500,
        'UNKNOWN'
      );
    }
  }
}

// =============================================================================
// 🚨 PUSH API ERROR
// =============================================================================

/**
 * Custom Error für Push API Fehler
 */
export class PushApiError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, statusCode: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'PushApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  /**
   * Prüft ob der Fehler ein Netzwerkfehler ist
   */
  isNetworkError(): boolean {
    return this.statusCode === 0 || this.code === 'NETWORK_ERROR';
  }

  /**
   * Prüft ob der Fehler ein Timeout ist
   */
  isTimeout(): boolean {
    return this.statusCode === 408 || this.code === 'TIMEOUT';
  }

  /**
   * Prüft ob der Fehler ein Konflikt ist
   */
  isConflict(): boolean {
    return this.statusCode === 409;
  }

  /**
   * Prüft ob der Fehler ein Auth-Fehler ist
   */
  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403;
  }

  /**
   * Prüft ob der Fehler ein Server-Fehler ist
   */
  isServerError(): boolean {
    return this.statusCode >= 500;
  }

  /**
   * Prüft ob ein Retry sinnvoll ist
   */
  isRetryable(): boolean {
    return this.isNetworkError() || this.isTimeout() || this.isServerError();
  }
}

// =============================================================================
// 🏭 FACTORY
// =============================================================================

/**
 * Erstellt eine neue PushApi Instanz
 */
export function createPushApi(config?: Partial<PushApiConfig>): PushApi {
  return new PushApi({
    baseUrl: config?.baseUrl ?? '/api/pg-sync',
    timeout: config?.timeout ?? 30_000,
    authToken: config?.authToken,
  });
}

// =============================================================================
// 🔧 HELPERS
// =============================================================================

/**
 * Konvertiert Outbox-Items zu Push-Events
 */
export function outboxItemsToPushEvents(items: DbOutboxItem[]): PushRequestEvent[] {
  return items.map((item) => {
    const payload = item.payload as unknown as Record<string, unknown>;
    return {
      id: item.id,
      type: item.eventType as PushRequestEvent['type'],
      entityId: item.entityId,
      localId: (payload?.localId as string) ?? item.entityId,
      payload,
      createdAt: item.createdAt.toISOString(),
    };
  });
}

/**
 * Gruppiert Outbox-Items nach Projekt
 */
export function groupOutboxByProject(items: DbOutboxItem[]): Map<string, DbOutboxItem[]> {
  const grouped = new Map<string, DbOutboxItem[]>();

  for (const item of items) {
    const payload = item.payload as unknown as Record<string, unknown>;
    const projectId = payload?.projectId as string | undefined;

    if (!projectId) continue;

    const existing = grouped.get(projectId) ?? [];
    existing.push(item);
    grouped.set(projectId, existing);
  }

  return grouped;
}
