/**
 * 🌐 API Types
 *
 * Typdefinitionen für API Requests und Responses.
 *
 * @see docs/pg-online-sync/tasks/phase-0.4-shared-types.md
 */

// =============================================================================
// 📦 API RESPONSE WRAPPER
// =============================================================================

/**
 * Standard API Response Wrapper
 *
 * Alle API-Endpoints geben dieses Format zurück.
 *
 * @template T - Typ der Payload-Daten
 */
export interface ApiResponse<T = unknown> {
  /** War die Anfrage erfolgreich? */
  success: boolean;
  /** Payload bei Erfolg */
  data?: T;
  /** Fehler bei Misserfolg */
  error?: ApiError;
  /** Optionale Metadaten */
  meta?: ApiMeta;
}

/**
 * API Fehler-Objekt
 */
export interface ApiError {
  /** Fehlercode (z.B. 'NOT_FOUND', 'VALIDATION_ERROR') */
  code: string;
  /** Lesbare Fehlermeldung */
  message: string;
  /** Zusätzliche Details (z.B. Validierungsfehler) */
  details?: unknown;
  /** Stack Trace (nur in Development) */
  stack?: string;
}

/**
 * API Metadaten
 */
export interface ApiMeta {
  /** Request-Dauer in Millisekunden */
  durationMs?: number;
  /** Server-Timestamp */
  timestamp?: string;
  /** Request-ID für Debugging */
  requestId?: string;
}

// =============================================================================
// 📄 PAGINATION
// =============================================================================

/**
 * Pagination Parameter (Request)
 */
export interface PaginationParams {
  /** Seite (1-basiert) */
  page?: number;
  /** Items pro Seite */
  limit?: number;
  /** Sortierung */
  sort?: SortParams;
}

/**
 * Sortierungs-Parameter
 */
export interface SortParams {
  /** Feld zum Sortieren */
  field: string;
  /** Sortierrichtung */
  direction: 'asc' | 'desc';
}

/**
 * Paginated Response
 */
export interface PaginatedResponse<T> {
  /** Items der aktuellen Seite */
  items: T[];
  /** Pagination-Info */
  pagination: PaginationInfo;
}

/**
 * Pagination Info (Response)
 */
export interface PaginationInfo {
  /** Aktuelle Seite */
  page: number;
  /** Items pro Seite */
  limit: number;
  /** Gesamtanzahl Items */
  total: number;
  /** Gesamtanzahl Seiten */
  totalPages: number;
  /** Gibt es eine nächste Seite? */
  hasNext: boolean;
  /** Gibt es eine vorherige Seite? */
  hasPrev: boolean;
}

// =============================================================================
// 🔍 FILTER & SEARCH
// =============================================================================

/**
 * Filter-Parameter für Listen-Endpoints
 */
export interface FilterParams {
  /** Suchbegriff */
  search?: string;
  /** Status-Filter */
  status?: string[];
  /** Projekt-Filter */
  projectId?: string;
  /** Zeitraum-Filter */
  dateRange?: DateRangeFilter;
  /** Erstellt von */
  createdBy?: string;
}

/**
 * Zeitraum-Filter
 */
export interface DateRangeFilter {
  /** Start-Datum (ISO String) */
  from?: string;
  /** End-Datum (ISO String) */
  to?: string;
}

// =============================================================================
// 🔐 AUTH TYPES
// =============================================================================

/**
 * Auth Request (Login)
 */
export interface AuthRequest {
  /** E-Mail */
  email: string;
  /** Passwort */
  password: string;
}

/**
 * Auth Response
 */
export interface AuthResponse {
  /** User-Daten */
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  /** JWT Token */
  token: string;
  /** Token-Ablauf (ISO String) */
  expiresAt: string;
}

/**
 * Projekt-Auth (für Kunden-Board)
 */
export interface ProjectAuthRequest {
  /** Projekt-Slug */
  projectSlug: string;
  /** Projekt-Passwort */
  password: string;
}

/**
 * Projekt-Auth Response
 */
export interface ProjectAuthResponse {
  /** War Authentifizierung erfolgreich? */
  authorized: boolean;
  /** Projekt-Daten (nur bei Erfolg) */
  project?: {
    id: string;
    name: string;
    slug: string;
  };
  /** Session-Token (für Kunden-Board) */
  sessionToken?: string;
}

// =============================================================================
// 🏭 FACTORY FUNCTIONS
// =============================================================================

/**
 * Erstellt eine erfolgreiche API Response
 */
export function createSuccessResponse<T>(data: T, meta?: ApiMeta): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Erstellt eine Fehler API Response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: unknown
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Erstellt eine paginated Response
 */
export function createPaginatedResponse<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
): ApiResponse<PaginatedResponse<T>> {
  const totalPages = Math.ceil(total / limit);

  return createSuccessResponse({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  });
}

// =============================================================================
// 🛡️ ERROR CODES
// =============================================================================

/**
 * Standard API Error Codes
 */
export const API_ERROR_CODES = {
  // 400 Bad Request
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',

  // 401 Unauthorized
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',

  // 403 Forbidden
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',

  // 404 Not Found
  NOT_FOUND: 'NOT_FOUND',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',

  // 409 Conflict
  CONFLICT: 'CONFLICT',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  SYNC_CONFLICT: 'SYNC_CONFLICT',

  // 500 Server Error
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SYNC_ERROR: 'SYNC_ERROR',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
