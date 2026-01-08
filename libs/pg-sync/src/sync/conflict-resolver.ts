/**
 * ⚔️ Conflict Resolver
 *
 * Behandelt Konflikte beim Push und Pull.
 * Unterstützt verschiedene Strategien: local_wins, remote_wins, manual.
 *
 * @see docs/pg-online-sync/tasks/phase-1.3-push-mechanismus.md
 */

import type { PushConflict, ConflictType, ConflictResolutionStrategy } from './types.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Ergebnis der Konflikt-Auflösung
 */
export interface ConflictResolution {
  resolved: boolean;
  action: ConflictAction;
  message: string;
  requiresUserInput: boolean;
}

/**
 * Aktion nach Konflikt-Auflösung
 */
export type ConflictAction =
  | 'use_local' // Lokale Version pushen (force)
  | 'use_remote' // Remote Version akzeptieren
  | 'merge' // Merge (wenn möglich)
  | 'skip' // Event überspringen
  | 'ask_user'; // User entscheiden lassen

/**
 * Konflikt-Details für UI
 */
export interface ConflictDetails {
  conflict: PushConflict;
  localData: unknown;
  remoteData: unknown;
  suggestedAction: ConflictAction;
}

/**
 * User-Entscheidung für Konflikt
 */
export interface UserConflictDecision {
  conflictId: string;
  action: 'use_local' | 'use_remote' | 'skip';
}

// =============================================================================
// ⚔️ CONFLICT RESOLVER CLASS
// =============================================================================

/**
 * ConflictResolver - Zentrale Konflikt-Behandlung
 */
export class ConflictResolver {
  private readonly strategy: ConflictResolutionStrategy;
  private pendingConflicts: Map<string, ConflictDetails> = new Map();

  constructor(strategy: ConflictResolutionStrategy = 'remote_wins') {
    this.strategy = strategy;
  }

  // ===========================================================================
  // 🔄 RESOLUTION
  // ===========================================================================

  /**
   * Löst einen Konflikt basierend auf der konfigurierten Strategie
   */
  resolve(conflict: PushConflict): ConflictResolution {
    // Bei manueller Strategie immer User fragen
    if (this.strategy === 'manual') {
      return this.createManualResolution(conflict);
    }

    // Strategie-basierte Auflösung
    switch (conflict.type) {
      case 'version_mismatch':
        return this.resolveVersionMismatch(conflict);

      case 'already_claimed':
        return this.resolveAlreadyClaimed(conflict);

      case 'not_found':
        return this.resolveNotFound(conflict);

      case 'permission_denied':
        return this.resolvePermissionDenied(conflict);

      case 'invalid_status_transition':
        return this.resolveInvalidStatusTransition(conflict);

      default:
        return this.resolveUnknown(conflict);
    }
  }

  /**
   * Batch-Auflösung mehrerer Konflikte
   */
  resolveAll(conflicts: PushConflict[]): Map<string, ConflictResolution> {
    const resolutions = new Map<string, ConflictResolution>();

    for (const conflict of conflicts) {
      resolutions.set(conflict.eventId, this.resolve(conflict));
    }

    return resolutions;
  }

  // ===========================================================================
  // 🔧 SPECIFIC RESOLVERS
  // ===========================================================================

  /**
   * Versions-Konflikt: Remote wurde zwischenzeitlich geändert
   */
  private resolveVersionMismatch(conflict: PushConflict): ConflictResolution {
    if (this.strategy === 'local_wins') {
      return {
        resolved: true,
        action: 'use_local',
        message: 'Lokale Version wird übernommen (Force-Update)',
        requiresUserInput: false,
      };
    }

    // Default: remote_wins
    return {
      resolved: true,
      action: 'use_remote',
      message: 'Remote-Version ist neuer, lokale Änderung verworfen',
      requiresUserInput: false,
    };
  }

  /**
   * Claim-Konflikt: Ticket bereits von anderem User geclaimed
   */
  private resolveAlreadyClaimed(conflict: PushConflict): ConflictResolution {
    // Bei Claim-Konflikten immer Remote gewinnen lassen
    // da Claim-Status kritisch ist
    return {
      resolved: true,
      action: 'use_remote',
      message: `Ticket bereits von anderem User geclaimed`,
      requiresUserInput: false,
    };
  }

  /**
   * Not Found: Ticket existiert remote nicht (mehr)
   */
  private resolveNotFound(conflict: PushConflict): ConflictResolution {
    if (this.strategy === 'local_wins') {
      // Lokales Ticket als neu erstellen
      return {
        resolved: true,
        action: 'use_local',
        message: 'Ticket wird remote neu erstellt',
        requiresUserInput: false,
      };
    }

    // Default: Event überspringen, lokales Ticket löschen/archivieren
    return {
      resolved: true,
      action: 'skip',
      message: 'Ticket existiert remote nicht mehr, lokale Referenz verwaist',
      requiresUserInput: false,
    };
  }

  /**
   * Permission Denied: Keine Berechtigung für diese Aktion
   */
  private resolvePermissionDenied(conflict: PushConflict): ConflictResolution {
    // Permissions können nicht überschrieben werden
    return {
      resolved: true,
      action: 'skip',
      message: 'Keine Berechtigung für diese Aktion',
      requiresUserInput: false,
    };
  }

  /**
   * Invalid Status Transition: Ungültiger Statuswechsel
   */
  private resolveInvalidStatusTransition(conflict: PushConflict): ConflictResolution {
    // Status-Übergang nicht erlaubt
    return {
      resolved: true,
      action: 'use_remote',
      message: 'Statuswechsel nicht erlaubt, aktuelle Remote-Status übernommen',
      requiresUserInput: false,
    };
  }

  /**
   * Unbekannter Konflikt-Typ
   */
  private resolveUnknown(conflict: PushConflict): ConflictResolution {
    // Sicherheitshalber Remote bevorzugen
    return {
      resolved: true,
      action: 'use_remote',
      message: `Unbekannter Konflikt: ${conflict.type}`,
      requiresUserInput: false,
    };
  }

  /**
   * Manuelle Auflösung erforderlich
   */
  private createManualResolution(conflict: PushConflict): ConflictResolution {
    return {
      resolved: false,
      action: 'ask_user',
      message: 'Konflikt erfordert manuelle Auflösung',
      requiresUserInput: true,
    };
  }

  // ===========================================================================
  // 👤 MANUAL RESOLUTION
  // ===========================================================================

  /**
   * Registriert einen Konflikt für manuelle Auflösung
   */
  registerPendingConflict(conflict: PushConflict, localData: unknown, remoteData: unknown): void {
    const suggestedAction = this.getSuggestedAction(conflict);

    this.pendingConflicts.set(conflict.eventId, {
      conflict,
      localData,
      remoteData,
      suggestedAction,
    });
  }

  /**
   * Holt alle ausstehenden Konflikte
   */
  getPendingConflicts(): ConflictDetails[] {
    return Array.from(this.pendingConflicts.values());
  }

  /**
   * Prüft ob Konflikte auf Auflösung warten
   */
  hasPendingConflicts(): boolean {
    return this.pendingConflicts.size > 0;
  }

  /**
   * Wendet User-Entscheidung an
   */
  applyUserDecision(decision: UserConflictDecision): ConflictResolution {
    const details = this.pendingConflicts.get(decision.conflictId);

    if (!details) {
      return {
        resolved: false,
        action: 'skip',
        message: 'Konflikt nicht gefunden',
        requiresUserInput: false,
      };
    }

    // Konflikt aus pending entfernen
    this.pendingConflicts.delete(decision.conflictId);

    return {
      resolved: true,
      action: decision.action,
      message: `User hat "${decision.action}" gewählt`,
      requiresUserInput: false,
    };
  }

  /**
   * Löscht alle pending Konflikte
   */
  clearPendingConflicts(): void {
    this.pendingConflicts.clear();
  }

  // ===========================================================================
  // 🔧 HELPERS
  // ===========================================================================

  /**
   * Ermittelt vorgeschlagene Aktion basierend auf Konflikt-Typ
   */
  private getSuggestedAction(conflict: PushConflict): ConflictAction {
    switch (conflict.type) {
      case 'version_mismatch':
        return 'use_remote';
      case 'already_claimed':
        return 'use_remote';
      case 'not_found':
        return 'skip';
      case 'permission_denied':
        return 'skip';
      case 'invalid_status_transition':
        return 'use_remote';
      default:
        return 'use_remote';
    }
  }

  /**
   * Gibt aktuelle Strategie zurück
   */
  getStrategy(): ConflictResolutionStrategy {
    return this.strategy;
  }
}

// =============================================================================
// 🏭 FACTORY
// =============================================================================

/**
 * Erstellt einen neuen ConflictResolver
 */
export function createConflictResolver(
  strategy: ConflictResolutionStrategy = 'remote_wins'
): ConflictResolver {
  return new ConflictResolver(strategy);
}
