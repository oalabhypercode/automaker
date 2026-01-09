/**
 * Format a date string as relative time (e.g., "vor 2h", "vor 3d")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unknown';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;

  return new Intl.DateTimeFormat('de', { dateStyle: 'short' }).format(date);
}

/**
 * Format a date string as full date with time (e.g., "9. Januar 2026, 14:30 Uhr")
 */
export function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return 'Unbekannt';

  return (
    new Intl.DateTimeFormat('de', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date) + ' Uhr'
  );
}
