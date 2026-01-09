import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Search, X } from 'lucide-react';
import type { PublicProjectData, PublicTicket } from '@/hooks/use-public-project';
import { PublicTicketCard } from './public-ticket-card';
import { PublicTicketForm } from './public-ticket-form';
import { cn } from '@/lib/utils';

interface PublicBoardViewProps {
  project: PublicProjectData;
  tickets: PublicTicket[];
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

const BASE_COLUMNS = [
  { id: 'backlog', title: 'Backlog', colorClass: 'bg-[var(--status-backlog)]' },
  { id: 'todo', title: 'Todo', colorClass: 'bg-[var(--status-info)]' },
  { id: 'in_progress', title: 'In Progress', colorClass: 'bg-[var(--status-in-progress)]' },
  { id: 'review', title: 'Review', colorClass: 'bg-[var(--status-warning)]' },
  { id: 'done', title: 'Done', colorClass: 'bg-[var(--status-success)]' },
];
const ARCHIVED_COLUMN = { id: 'archived', title: 'Archived', colorClass: 'bg-muted-foreground/40' };

const COLUMN_GLOW_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  archived: 'bg-gray-500',
};

const COLUMN_BADGE_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  todo: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  done: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function EmptyColumnState({ searchQuery }: { searchQuery?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        'py-8 px-4 rounded-xl',
        'bg-white/5 border border-dashed border-white/10'
      )}
    >
      <div className="text-2xl mb-2">📭</div>
      <p className="text-sm text-muted-foreground text-center">
        {searchQuery ? 'Keine Tickets gefunden' : 'Noch keine Tickets'}
      </p>
      {searchQuery && (
        <p className="text-xs text-muted-foreground/70 mt-1 text-center">
          Versuche eine andere Suche
        </p>
      )}
    </div>
  );
}

export function PublicBoardView({
  project,
  tickets,
  onLogout,
  isLoggingOut = false,
}: PublicBoardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const configuredStatuses = project.publicSettings.visibleStatuses;
  const hasConfiguredStatuses = configuredStatuses.length > 0;
  const visibleStatuses = hasConfiguredStatuses
    ? configuredStatuses
    : BASE_COLUMNS.map((column) => column.id);
  const visibleStatusSet = useMemo(() => new Set(visibleStatuses), [visibleStatuses]);
  const viewLabel = project.publicSettings.allowTicketCreation
    ? 'Customer view'
    : 'Read-only customer view';

  const ticketsToDisplay = useMemo(() => {
    let result = tickets;

    // Filter by visible statuses
    if (hasConfiguredStatuses) {
      result = result.filter((ticket) => visibleStatusSet.has(ticket.status));
    }

    // Filter by search query
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(lowerQuery) ||
          (t.description && t.description.toLowerCase().includes(lowerQuery))
      );
    }

    return result;
  }, [hasConfiguredStatuses, tickets, visibleStatusSet, searchQuery]);

  const shouldShowArchived = hasConfiguredStatuses
    ? visibleStatusSet.has('archived')
    : tickets.some((ticket) => ticket.status === 'archived');

  const columns = useMemo(() => {
    const baseColumns = BASE_COLUMNS.filter((column) => visibleStatusSet.has(column.id));
    return shouldShowArchived ? [...baseColumns, ARCHIVED_COLUMN] : baseColumns;
  }, [shouldShowArchived, visibleStatusSet]);

  const ticketsByStatus = useMemo(() => {
    const buckets = new Map<string, PublicTicket[]>();
    columns.forEach((column) => buckets.set(column.id, []));

    ticketsToDisplay.forEach((ticket) => {
      const bucket = buckets.get(ticket.status);
      if (bucket) bucket.push(ticket);
    });

    buckets.forEach((bucket) => {
      bucket.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });

    return buckets;
  }, [columns, ticketsToDisplay]);

  return (
    <div className="h-screen overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 pb-16">
        <header className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-4">
              {project.logoUrl ? (
                <img
                  src={project.logoUrl}
                  alt={`${project.name} logo`}
                  className="h-14 w-14 rounded-xl border border-border object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-14 w-14 rounded-xl border border-border bg-muted/40 flex items-center justify-center text-sm font-semibold text-muted-foreground">
                  {project.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl md:text-3xl font-semibold">{project.name}</h1>
                {project.description && (
                  <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Mobile Actions: Phone & Search */}
            <div className="flex items-center gap-1 md:hidden">
              <Button variant="ghost" size="icon" asChild className="text-muted-foreground">
                <a href="tel:">
                  <Phone className="h-5 w-5" />
                </a>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                className={cn(
                  'text-muted-foreground',
                  isSearchOpen && 'bg-accent text-accent-foreground'
                )}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Search Input */}
          {isSearchOpen && (
            <div className="md:hidden animate-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Suche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            {/* Desktop Search */}
            <div className="hidden md:block relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {viewLabel}
              </Badge>
              {project.hasPassword && onLogout && (
                <Button variant="outline" size="sm" onClick={onLogout} disabled={isLoggingOut}>
                  {isLoggingOut ? 'Signing out...' : 'Sign out'}
                </Button>
              )}
            </div>
          </div>
        </header>

        {project.publicSettings.introMessage && (
          <section className="mt-6 rounded-2xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground whitespace-pre-wrap">
            {project.publicSettings.introMessage}
          </section>
        )}

        {project.publicSettings.allowTicketCreation && (
          <section className="mt-6">
            <PublicTicketForm slug={project.slug} />
          </section>
        )}

        <section className="mt-8">
          <div
            className={cn(
              'flex gap-4 overflow-x-auto pb-4',
              'scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent',
              'snap-x snap-mandatory md:snap-none'
            )}
          >
            {columns.map((column) => {
              const columnTickets = ticketsByStatus.get(column.id) ?? [];
              return (
                <div
                  key={column.id}
                  className={cn(
                    'min-w-[85vw] md:min-w-[280px] max-w-[90vw] md:max-w-[340px] flex-1',
                    'relative overflow-hidden',
                    'snap-start md:snap-align-none'
                  )}
                >
                  {/* Column Card with Glasmorphism */}
                  <div
                    className={cn(
                      'h-full rounded-2xl',
                      'bg-black/30 backdrop-blur-sm',
                      'border border-white/10',
                      'p-4'
                    )}
                  >
                    {/* Subtle Top-Glow basierend auf Status */}
                    <div
                      className={cn(
                        'absolute top-0 left-1/2 -translate-x-1/2',
                        'w-[200px] h-[100px] rounded-[100%] blur-[60px]',
                        'pointer-events-none',
                        COLUMN_GLOW_COLORS[column.id]
                      )}
                      style={{ opacity: 0.15 }}
                    />

                    {/* Header */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'h-3 w-3 rounded-full',
                              'ring-2 ring-offset-2 ring-offset-black/50',
                              column.colorClass
                            )}
                          />
                          <h2 className="text-sm font-semibold uppercase tracking-wide">
                            {column.title}
                          </h2>
                        </div>
                        <Badge
                          variant="muted"
                          size="sm"
                          className={cn(
                            'min-w-[24px] justify-center',
                            columnTickets.length > 0 && COLUMN_BADGE_COLORS[column.id]
                          )}
                        >
                          {columnTickets.length}
                        </Badge>
                      </div>

                      {/* Separator */}
                      <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4" />

                      {/* Tickets */}
                      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                        {columnTickets.length === 0 ? (
                          <EmptyColumnState searchQuery={searchQuery} />
                        ) : (
                          columnTickets.map((ticket) => (
                            <PublicTicketCard key={ticket.id} ticket={ticket} />
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
