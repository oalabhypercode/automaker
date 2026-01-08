/**
 * 🔧 Config Module - Public Exports
 *
 * Exportiert alle Konfigurationsoptionen und Feature-Flags.
 *
 * @see docs/pg-online-sync/tasks/phase-0.3-erweiterungsstrategie.md
 */

// Feature Flags
export {
  getFeatureFlags,
  isFeatureEnabled,
  isSyncEnabled,
  getFeatureFlagsInfo,
  // Testing utilities
  setTestFeatureFlags,
  clearTestFeatureFlags,
  getFeatureFlagValue,
} from './feature-flags.js';

export type { FeatureFlags } from './feature-flags.js';
