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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8">
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
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnTickets = ticketsByStatus.get(column.id) ?? [];
              return (
                <div key={column.id} className="min-w-[260px] max-w-[320px] flex-1">
                  <div className="rounded-2xl border border-border/70 bg-card/60 p-4 h-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', column.colorClass)} />
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {column.title}
                        </h2>
                      </div>
                      <Badge variant="muted" size="sm">
                        {columnTickets.length}
                      </Badge>
                    </div>
                    <div className="mt-4 space-y-3">
                      {columnTickets.length === 0 ? (
                        <div className="text-xs text-muted-foreground">
                          {searchQuery
                            ? 'No tickets found matching your search.'
                            : 'No tickets right now.'}
                        </div>
                      ) : (
                        columnTickets.map((ticket) => (
                          <PublicTicketCard key={ticket.id} ticket={ticket} />
                        ))
                      )}
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
