/**
 * 🧰 Utilities Index
 *
 * Zentrale Exports für Utility-Funktionen.
 *
 * @see docs/pg-online-sync/tasks/phase-3.1-projekt-urls.md
 */

// =============================================================================
// 🔗 SLUG UTILITIES
// =============================================================================

export {
  // Main Functions
  generateSlug,
  generateUniqueSlug,
  isValidSlug,
  normalizeSlug,
  // Helper
  isReservedSlug,
  // Constants
  RESERVED_SLUGS,
  // Types
  type SlugOptions,
  type SlugAvailabilityChecker,
} from './slug-generator.js';
