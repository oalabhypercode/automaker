import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, Paperclip, User } from 'lucide-react';
import type { PublicTicket } from '@/hooks/use-public-project';
import { cn } from '@/lib/utils';
import { formatRelativeTime, formatFullDate } from '@/lib/relative-time';
import { CategoryBadge } from './category-badge';

const STATUS_GLOW_COLORS: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  archived: 'bg-gray-500',
};

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; variant: 'muted' | 'info' | 'warning' | 'success' }
> = {
  backlog: {
    label: 'Backlog',
    className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    variant: 'muted',
  },
  todo: {
    label: 'Todo',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    variant: 'info',
  },
  in_progress: {
    label: 'In Progress',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    variant: 'warning',
  },
  review: {
    label: 'Review',
    className: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    variant: 'warning',
  },
  done: {
    label: 'Done',
    className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    variant: 'success',
  },
  archived: {
    label: 'Archived',
    className: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    variant: 'muted',
  },
};

interface TicketImageProps {
  src: string;
  alt: string;
  className?: string;
}

function TicketImage({ src, alt, className }: TicketImageProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/40 text-muted-foreground text-[10px]',
          className
        )}
      >
        Bild
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

export function PublicTicketCard({ ticket }: { ticket: PublicTicket }) {
  const statusConfig = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.backlog;
  const shortId = useMemo(() => ticket.id.slice(0, 8).toUpperCase(), [ticket.id]);
  const relativeTime = formatRelativeTime(ticket.updatedAt);
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
          {/* Glasmorphism Card */}
          <div
            className={cn(
              'relative overflow-hidden rounded-xl',
              'bg-black/40 backdrop-blur-sm',
              'border border-white/10',
              'hover:bg-black/50 hover:border-white/20',
              'hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]',
              'hover:-translate-y-0.5',
              'transition-all duration-300'
            )}
          >
            {/* Subtle Glow Corner */}
            <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/10 blur-2xl pointer-events-none" />

            <div className="p-4 space-y-3 relative">
              {/* Header: ID + Status Badge */}
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-mono">#{shortId}</span>
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium',
                    statusConfig.className
                  )}
                >
                  {statusConfig.label}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-sm font-semibold leading-snug text-foreground">{ticket.title}</h3>

              {/* Meta Line: Creator + Category + Time */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                {ticket.creatorName && (
                  <>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      <span>{ticket.creatorName}</span>
                    </div>
                    {(ticket.category || true) && (
                      <span className="text-muted-foreground/50">·</span>
                    )}
                  </>
                )}

                {ticket.category && (
                  <>
                    <CategoryBadge category={ticket.category} size="sm" />
                    <span className="text-muted-foreground/50">·</span>
                  </>
                )}

                <span>{relativeTime}</span>
              </div>

              {/* Description (clean, no markdown) */}
              {ticket.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
              )}

              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="flex items-center gap-2 pt-1">
                  {previewAttachments.map((attachment) => (
                    <TicketImage
                      key={attachment.id}
                      src={attachment.url}
                      alt={attachment.filename}
                      className="h-10 w-10 rounded-md border border-white/10 object-cover"
                    />
                  ))}
                  {attachments.length > previewAttachments.length && (
                    <span className="text-[10px] text-muted-foreground">
                      +{attachments.length - previewAttachments.length}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </button>
      </DialogTrigger>

      {/* Premium Dialog Content */}
      <DialogContent
        className={cn(
          'relative overflow-hidden',
          'bg-black/80 backdrop-blur-xl',
          'border border-white/10',
          'max-w-xl'
        )}
      >
        {/* Top Glow - Status-basiert */}
        <div
          className={cn(
            'absolute top-[-15%] left-1/2 -translate-x-1/2',
            'w-[400px] h-[200px] rounded-[100%] blur-[80px]',
            'pointer-events-none opacity-20',
            STATUS_GLOW_COLORS[ticket.status] ?? STATUS_GLOW_COLORS.backlog
          )}
        />

        {/* Grain Texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
            mixBlendMode: 'overlay',
          }}
        />

        {/* Content Container */}
        <div className="relative z-10">
          <DialogHeader className="space-y-3">
            {/* Title + Status Badge */}
            <div className="flex items-start justify-between gap-3">
              <DialogTitle className="text-xl font-semibold leading-tight">
                {ticket.title}
              </DialogTitle>
              <Badge variant={statusConfig.variant} size="sm" className="shrink-0">
                {statusConfig.label}
              </Badge>
            </div>

            {/* Ticket ID */}
            <div className="text-xs text-muted-foreground font-mono">#{shortId}</div>

            {/* Meta Box */}
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg flex-wrap',
                'bg-white/5 border border-white/10'
              )}
            >
              {ticket.creatorName && (
                <div className="flex items-center gap-1.5 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{ticket.creatorName}</span>
                </div>
              )}

              {ticket.category && (
                <>
                  {ticket.creatorName && <span className="text-muted-foreground/50">·</span>}
                  <CategoryBadge category={ticket.category} />
                </>
              )}

              <span className="text-muted-foreground/50">·</span>
              <span className="text-sm text-muted-foreground">
                {formatRelativeTime(ticket.updatedAt)}
              </span>
            </div>
          </DialogHeader>

          <div className="my-4 h-px bg-white/10" />

          {/* Description */}
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {ticket.description ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {ticket.description}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground italic">Keine Beschreibung vorhanden.</p>
            )}
          </div>

          {/* Attachments Gallery */}
          {attachments.length > 0 && (
            <div className="space-y-3 mt-4">
              <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Anhänge ({attachments.length})
              </h4>

              <div className="grid gap-3 sm:grid-cols-2">
                {attachments.map((attachment) => (
                  <a
                    key={attachment.id}
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'group block rounded-xl overflow-hidden',
                      'bg-white/5 border border-white/10',
                      'hover:border-white/20 hover:bg-white/10',
                      'transition-all duration-200'
                    )}
                  >
                    <div className="aspect-video relative bg-black/20">
                      <TicketImage
                        src={attachment.url}
                        alt={attachment.filename}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 text-xs text-muted-foreground truncate">
                      {attachment.filename}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="my-4 h-px bg-white/10" />

          {/* Footer */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>Erstellt: {formatFullDate(ticket.createdAt)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
