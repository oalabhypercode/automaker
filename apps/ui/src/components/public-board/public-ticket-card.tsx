import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { PublicTicket } from '@/hooks/use-public-project';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'Todo',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  archived: 'Archived',
};

const STATUS_BADGE: Record<string, 'muted' | 'info' | 'warning' | 'success'> = {
  backlog: 'muted',
  todo: 'info',
  in_progress: 'warning',
  review: 'warning',
  done: 'success',
  archived: 'muted',
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(date);
}

export function PublicTicketCard({ ticket }: { ticket: PublicTicket }) {
  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status;
  const badgeVariant = STATUS_BADGE[ticket.status] ?? 'muted';
  const shortId = useMemo(() => ticket.id.slice(0, 8).toUpperCase(), [ticket.id]);
  const updatedAt = formatDate(ticket.updatedAt);
  const attachments = ticket.attachments ?? [];
  const previewAttachments = attachments.slice(0, 3);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl'
          )}
        >
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>#{shortId}</span>
                <Badge variant={badgeVariant} size="sm">
                  {statusLabel}
                </Badge>
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-snug">{ticket.title}</h3>
                {ticket.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {ticket.description}
                  </p>
                )}
              </div>
              {attachments.length > 0 && (
                <div className="flex items-center gap-2">
                  {previewAttachments.map((attachment) => (
                    <img
                      key={attachment.id}
                      src={attachment.url}
                      alt={attachment.filename}
                      className="h-10 w-10 rounded-md border border-border object-cover"
                      loading="lazy"
                    />
                  ))}
                  {attachments.length > previewAttachments.length && (
                    <span className="text-[11px] text-muted-foreground">
                      +{attachments.length - previewAttachments.length} more
                    </span>
                  )}
                </div>
              )}
              <div className="text-[11px] text-muted-foreground">Updated {updatedAt}</div>
            </CardContent>
          </Card>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{ticket.title}</span>
            <Badge variant={badgeVariant} size="sm">
              {statusLabel}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Ticket #{shortId} · Updated {updatedAt}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3 text-sm text-foreground">
          {ticket.description ? (
            <p className="whitespace-pre-wrap">{ticket.description}</p>
          ) : (
            <p className="text-muted-foreground">No description provided.</p>
          )}
          {attachments.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Attachments</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-border/60 bg-background p-2 hover:border-border"
                  >
                    <img
                      src={attachment.url}
                      alt={attachment.filename}
                      className="h-32 w-full rounded-md object-cover"
                      loading="lazy"
                    />
                    <div className="mt-2 text-xs text-muted-foreground truncate">
                      {attachment.filename}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Created {formatDate(ticket.createdAt)}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
