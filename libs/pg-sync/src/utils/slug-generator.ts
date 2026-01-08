/**
 * 🔗 Slug Generator Utility
 *
 * Generiert URL-freundliche Slugs für Projekte.
 *
 * @see docs/pg-online-sync/tasks/phase-3.1-projekt-urls.md
 */

// =============================================================================
// 📐 TYPES
// =============================================================================

/**
 * Optionen für Slug-Generierung
 */
export interface SlugOptions {
  /** Maximale Länge des Slugs (Default: 50) */
  maxLength?: number;
  /** Erlaubte Zeichen-Regex (Default: alphanumerisch + Bindestrich) */
  allowedChars?: RegExp;
  /** Separator zwischen Wörtern (Default: '-') */
  separator?: string;
}

/**
 * Callback für Uniqueness-Check
 */
export type SlugAvailabilityChecker = (slug: string, excludeId?: string) => Promise<boolean>;

// =============================================================================
// 🚫 RESERVIERTE SLUGS
// =============================================================================

/**
 * Diese Slugs dürfen nicht verwendet werden
 * (System-Routen, API-Endpoints, etc.)
 */
export const RESERVED_SLUGS = new Set([
  // System-Routen
  'admin',
  'api',
  'app',
  'auth',
  'login',
  'logout',
  'signup',
  'register',
  'signin',
  'signout',
  'setup',
  'settings',
  'dashboard',
  'profile',
  'account',
  'user',
  'users',

  // Spezielle Pfade
  'p',
  'public',
  'private',
  'internal',
  'board',
  'boards',
  'project',
  'projects',
  'ticket',
  'tickets',

  // Assets & API
  'assets',
  'static',
  'images',
  'files',
  'uploads',
  'webhooks',
  'health',
  'status',
  'metrics',

  // Sonstige
  'undefined',
  'null',
  'new',
  'edit',
  'delete',
  'create',
  'test',
  'demo',
  'temp',
  'tmp',
]);

// =============================================================================
// 🔧 HELPER FUNCTIONS
// =============================================================================

/**
 * Entfernt diakritische Zeichen (Umlaute, Akzente)
 * z.B. "Müller" → "Muller", "café" → "cafe"
 */
function removeDiacritics(text: string): string {
  // Deutsche Umlaute explizit behandeln (vor NFD-Normalisierung)
  const germanMappings: Record<string, string> = {
    ä: 'ae',
    ö: 'oe',
    ü: 'ue',
    Ä: 'Ae',
    Ö: 'Oe',
    Ü: 'Ue',
    ß: 'ss',
  };

  let result = text;
  for (const [from, to] of Object.entries(germanMappings)) {
    result = result.split(from).join(to);
  }

  // Restliche diakritische Zeichen via NFD-Normalisierung entfernen
  return result.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Prüft ob ein Slug reserviert ist
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

// =============================================================================
// 🔗 SLUG GENERATION
// =============================================================================

/**
 * Generiert einen URL-freundlichen Slug aus einem Namen
 *
 * Transformationen:
 * 1. Umlaute → Ascii (ä→ae, ö→oe, etc.)
 * 2. Lowercase
 * 3. Sonderzeichen → entfernt
 * 4. Leerzeichen/Unterstriche → Bindestriche
 * 5. Mehrfache Bindestriche → einzelner Bindestrich
 * 6. Führende/Trailing Bindestriche → entfernt
 *
 * @example
 * generateSlug("Website Relaunch 2025") // "website-relaunch-2025"
 * generateSlug("Müller GmbH & Co. KG") // "mueller-gmbh-co-kg"
 * generateSlug("  Test___Project  ") // "test-project"
 */
export function generateSlug(name: string, options: SlugOptions = {}): string {
  const { maxLength = 50, separator = '-' } = options;

  if (!name || typeof name !== 'string') {
    return '';
  }

  let slug = name
    // Schritt 1: Diakritische Zeichen behandeln
    .trim()
    .normalize('NFC');

  // Deutsche Umlaute speziell behandeln
  slug = removeDiacritics(slug);

  slug = slug
    // Schritt 2: Lowercase
    .toLowerCase()
    // Schritt 3: Sonderzeichen entfernen (außer alphanumerisch, Leerzeichen, Bindestrich, Unterstrich)
    .replace(/[^\w\s-]/g, '')
    // Schritt 4: Leerzeichen und Unterstriche → Separator
    .replace(/[\s_]+/g, separator)
    // Schritt 5: Mehrfache Separatoren → einzelner Separator
    .replace(new RegExp(`${separator}+`, 'g'), separator)
    // Schritt 6: Führende/Trailing Separatoren entfernen
    .replace(new RegExp(`^${separator}+|${separator}+$`, 'g'), '');

  // Länge begrenzen (nicht mitten im Wort abschneiden)
  if (slug.length > maxLength) {
    slug = slug.substring(0, maxLength);
    // Falls mitten im Wort geschnitten, bis zum letzten Separator zurück
    const lastSeparator = slug.lastIndexOf(separator);
    if (lastSeparator > maxLength * 0.5) {
      slug = slug.substring(0, lastSeparator);
    }
  }

  // Nochmal trailing Separator entfernen (falls durch Längenkürzung entstanden)
  slug = slug.replace(new RegExp(`${separator}+$`, 'g'), '');

  return slug;
}

/**
 * Generiert einen unique Slug durch Anhängen einer Zahl
 *
 * Falls der Basis-Slug bereits existiert:
 * - "my-project" → "my-project-2" → "my-project-3" ...
 *
 * @param baseName - Der ursprüngliche Name
 * @param isAvailable - Callback um Verfügbarkeit zu prüfen
 * @param excludeId - Optional: Projekt-ID ausschließen (für Updates)
 * @param maxAttempts - Maximale Versuche (Default: 100)
 */
export async function generateUniqueSlug(
  baseName: string,
  isAvailable: SlugAvailabilityChecker,
  excludeId?: string,
  maxAttempts: number = 100
): Promise<string> {
  const baseSlug = generateSlug(baseName);

  if (!baseSlug) {
    throw new Error('Cannot generate slug from empty name');
  }

  // Prüfe zuerst reservierte Slugs
  if (isReservedSlug(baseSlug)) {
    // Bei reservierten Slugs direkt mit Suffix starten
    let suffix = 1;
    let candidateSlug = `${baseSlug}-${suffix}`;

    while (suffix <= maxAttempts) {
      if (await isAvailable(candidateSlug, excludeId)) {
        return candidateSlug;
      }
      suffix++;
      candidateSlug = `${baseSlug}-${suffix}`;
    }

    throw new Error(
      `Unable to generate unique slug for reserved word "${baseSlug}" after ${maxAttempts} attempts`
    );
  }

  // Normaler Fall: Erst ohne Suffix probieren
  if (await isAvailable(baseSlug, excludeId)) {
    return baseSlug;
  }

  // Mit Suffix probieren
  let suffix = 2;
  while (suffix <= maxAttempts) {
    const candidateSlug = `${baseSlug}-${suffix}`;

    if (await isAvailable(candidateSlug, excludeId)) {
      return candidateSlug;
    }

    suffix++;
  }

  throw new Error(`Unable to generate unique slug for "${baseName}" after ${maxAttempts} attempts`);
}

/**
 * Validiert ob ein Slug gültig ist
 *
 * Regeln:
 * - Nur lowercase alphanumerisch + Bindestriche
 * - Keine führenden/trailing Bindestriche
 * - Keine doppelten Bindestriche
 * - Mindestens 1 Zeichen
 * - Maximal 50 Zeichen
 * - Nicht reserviert
 */
export function isValidSlug(slug: string): { valid: boolean; error?: string } {
  if (!slug || typeof slug !== 'string') {
    return { valid: false, error: 'Slug cannot be empty' };
  }

  if (slug.length < 1) {
    return { valid: false, error: 'Slug must be at least 1 character' };
  }

  if (slug.length > 50) {
    return { valid: false, error: 'Slug cannot exceed 50 characters' };
  }

  // Nur erlaubte Zeichen
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug can only contain lowercase letters, numbers, and hyphens' };
  }

  // Keine führenden/trailing Bindestriche
  if (slug.startsWith('-') || slug.endsWith('-')) {
    return { valid: false, error: 'Slug cannot start or end with a hyphen' };
  }

  // Keine doppelten Bindestriche
  if (slug.includes('--')) {
    return { valid: false, error: 'Slug cannot contain consecutive hyphens' };
  }

  // Nicht reserviert
  if (isReservedSlug(slug)) {
    return { valid: false, error: `"${slug}" is a reserved word and cannot be used as slug` };
  }

  return { valid: true };
}

/**
 * Normalisiert einen bereits existierenden Slug
 * (für Migrationen oder manuelle Eingaben)
 */
export function normalizeSlug(slug: string): string {
  if (!slug) return '';

  return (
    slug
      .toLowerCase()
      .trim()
      // Nur erlaubte Zeichen behalten
      .replace(/[^a-z0-9-]/g, '-')
      // Mehrfache Bindestriche zusammenführen
      .replace(/-+/g, '-')
      // Führende/Trailing Bindestriche entfernen
      .replace(/^-+|-+$/g, '')
  );
}
