/**
 * 🚨 Custom Error Classes
 *
 * Zentrale Fehlerklassen für alle Finder/Actions.
 *
 * @see docs/pg-online-sync/tasks/phase-1.2-finder-actions.md
 */

// =============================================================================
// 📋 ERROR CODES
// =============================================================================

/**
 * Alle möglichen Fehler-Codes für Frontend-Handling
 */
export const ERROR_CODES = {
  // Not Found (404)
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  TICKET_NOT_FOUND: 'TICKET_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  SYNC_STATE_NOT_FOUND: 'SYNC_STATE_NOT_FOUND',
  DEPENDENCY_NOT_FOUND: 'DEPENDENCY_NOT_FOUND',

  // Conflict (409)
  VERSION_CONFLICT: 'VERSION_CONFLICT',
  ALREADY_CLAIMED: 'ALREADY_CLAIMED',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CYCLIC_DEPENDENCY: 'CYCLIC_DEPENDENCY',
  DUPLICATE: 'DUPLICATE',

  // Validation (400)
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  SLUG_TAKEN: 'SLUG_TAKEN',
  INVALID_SLUG: 'INVALID_SLUG',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  INVALID_DATA: 'INVALID_DATA',
  SELF_REFERENCE: 'SELF_REFERENCE',
  CROSS_PROJECT: 'CROSS_PROJECT',
  PASSWORD_REQUIRED: 'PASSWORD_REQUIRED',

  // Permission (403)
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NOT_PROJECT_MEMBER: 'NOT_PROJECT_MEMBER',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// =============================================================================
// 🔴 BASE ERROR CLASS
// =============================================================================

/**
 * Basis-Fehlerklasse für alle pg-sync Fehler
 */
export class PgSyncError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PgSyncError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // Prototype-Chain für instanceof korrekt setzen
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialisiert den Fehler für API-Responses
   */
  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// =============================================================================
// 🔍 NOT FOUND ERROR (404)
// =============================================================================

/**
 * Fehler wenn Entity nicht gefunden wurde
 */
export class NotFoundError extends PgSyncError {
  constructor(
    entityType: 'project' | 'ticket' | 'user' | 'event' | 'syncState' | 'dependency',
    identifier: string,
    details?: Record<string, unknown>
  ) {
    const codeMap: Record<string, ErrorCode> = {
      project: 'PROJECT_NOT_FOUND',
      ticket: 'TICKET_NOT_FOUND',
      user: 'USER_NOT_FOUND',
      event: 'EVENT_NOT_FOUND',
      syncState: 'SYNC_STATE_NOT_FOUND',
      dependency: 'DEPENDENCY_NOT_FOUND',
    };

    super(
      `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} mit ID/Identifier '${identifier}' nicht gefunden`,
      codeMap[entityType],
      404,
      { entityType, identifier, ...details }
    );
    this.name = 'NotFoundError';
  }
}

// =============================================================================
// ⚠️ CONFLICT ERROR (409)
// =============================================================================

/**
 * Fehler bei Konflikten (Version, Claiming, etc.)
 */
export class ConflictError extends PgSyncError {
  constructor(
    code:
      | 'VERSION_CONFLICT'
      | 'ALREADY_CLAIMED'
      | 'ALREADY_EXISTS'
      | 'CYCLIC_DEPENDENCY'
      | 'DUPLICATE',
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, code as ErrorCode, 409, details);
    this.name = 'ConflictError';
  }

  /**
   * Factory: Optimistic Locking fehlgeschlagen
   */
  static versionConflict(entityType: string, entityId: string, expectedVersion: number) {
    return new ConflictError(
      'VERSION_CONFLICT',
      `${entityType} wurde von einem anderen Benutzer geändert. Bitte Daten neu laden.`,
      { entityType, entityId, expectedVersion }
    );
  }

  /**
   * Factory: Ticket bereits geclaimed
   */
  static alreadyClaimed(ticketId: string, claimedBy: string) {
    return new ConflictError(
      'ALREADY_CLAIMED',
      `Ticket ist bereits von einem anderen Benutzer in Bearbeitung.`,
      { ticketId, claimedBy }
    );
  }

  /**
   * Factory: Entity existiert bereits
   */
  static alreadyExists(entityType: string, field: string, value: string) {
    return new ConflictError(
      'ALREADY_EXISTS',
      `${entityType} mit ${field} '${value}' existiert bereits.`,
      { entityType, field, value }
    );
  }

  /**
   * Factory: Zyklische Abhängigkeit erkannt (Phase 2.5)
   */
  static cyclicDependency(sourceTicketId: string, targetTicketId: string) {
    return new ConflictError(
      'CYCLIC_DEPENDENCY',
      `Diese Abhängigkeit würde einen Zyklus erzeugen und ist daher nicht erlaubt.`,
      { sourceTicketId, targetTicketId }
    );
  }
}

// =============================================================================
// ❌ VALIDATION ERROR (400)
// =============================================================================

/**
 * Fehler bei ungültigen Daten
 */
export class ValidationError extends PgSyncError {
  constructor(
    code:
      | 'INVALID_STATUS_TRANSITION'
      | 'SLUG_TAKEN'
      | 'INVALID_SLUG'
      | 'EMAIL_TAKEN'
      | 'INVALID_DATA'
      | 'SELF_REFERENCE'
      | 'CROSS_PROJECT'
      | 'PASSWORD_REQUIRED',
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, code as ErrorCode, 400, details);
    this.name = 'ValidationError';
  }

  /**
   * Factory: Ungültiger Status-Übergang
   */
  static invalidStatusTransition(from: string, to: string, validTransitions: string[]) {
    return new ValidationError(
      'INVALID_STATUS_TRANSITION',
      `Status-Übergang von '${from}' zu '${to}' ist nicht erlaubt.`,
      { from, to, validTransitions }
    );
  }

  /**
   * Factory: Slug bereits vergeben
   */
  static slugTaken(slug: string) {
    return new ValidationError('SLUG_TAKEN', `Der Slug '${slug}' ist bereits vergeben.`, { slug });
  }

  /**
   * Factory: E-Mail bereits vergeben
   */
  static emailTaken(email: string) {
    return new ValidationError('EMAIL_TAKEN', `Die E-Mail '${email}' ist bereits registriert.`, {
      email,
    });
  }
}

// =============================================================================
// 🚫 PERMISSION ERROR (403)
// =============================================================================

/**
 * Fehler bei fehlenden Berechtigungen
 */
export class PermissionError extends PgSyncError {
  constructor(
    code: 'PERMISSION_DENIED' | 'NOT_PROJECT_MEMBER',
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message, code, 403, details);
    this.name = 'PermissionError';
  }

  /**
   * Factory: Kein Projekt-Mitglied
   */
  static notProjectMember(projectId: string, userId: string) {
    return new PermissionError('NOT_PROJECT_MEMBER', 'Du bist kein Mitglied dieses Projekts.', {
      projectId,
      userId,
    });
  }

  /**
   * Factory: Allgemeine Berechtigung fehlt
   */
  static permissionDenied(action: string, resource: string) {
    return new PermissionError(
      'PERMISSION_DENIED',
      `Du hast keine Berechtigung für '${action}' auf '${resource}'.`,
      { action, resource }
    );
  }
}

// =============================================================================
// 🛠️ HELPER FUNCTIONS
// =============================================================================

/**
 * Typrüfung für PgSyncError
 */
export function isPgSyncError(error: unknown): error is PgSyncError {
  return error instanceof PgSyncError;
}

/**
 * Extrahiert Error-Informationen (auch für nicht-PgSync-Errors)
 */
export function extractErrorInfo(error: unknown): {
  code: string;
  message: string;
  statusCode: number;
} {
  if (isPgSyncError(error)) {
    return {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: 500,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: 'Ein unbekannter Fehler ist aufgetreten',
    statusCode: 500,
  };
}
