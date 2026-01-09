import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, ImageIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import {
  extractBase64Data,
  fileToBase64,
  formatFileSize,
  generateImageId,
  sanitizeFilename,
  validateImageFile,
} from '@/lib/image-utils';
import {
  usePublicCreateTicket,
  type CreatePublicTicketPayload,
  type PublicTicketCategory,
} from '@/hooks/use-public-project';

const MAX_ATTACHMENTS = 4;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

interface AttachmentDraft {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
  previewUrl: string;
}

interface PublicTicketFormProps {
  slug: string;
}

export function PublicTicketForm({ slug }: PublicTicketFormProps) {
  const createTicket = usePublicCreateTicket(slug);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [creatorName, setCreatorName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<PublicTicketCategory>('feature');
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; creatorName?: string }>({});

  const attachmentCountLabel = useMemo(
    () => `${attachments.length}/${MAX_ATTACHMENTS} images`,
    [attachments.length]
  );

  const addFiles = useCallback(
    async (files: FileList) => {
      const currentCount = attachments.length;
      const newItems: AttachmentDraft[] = [];

      for (const file of Array.from(files)) {
        if (currentCount + newItems.length >= MAX_ATTACHMENTS) {
          toast.error(`Maximum ${MAX_ATTACHMENTS} images allowed.`);
          break;
        }

        const validation = validateImageFile(file, MAX_ATTACHMENT_BYTES);
        if (!validation.isValid) {
          toast.error(validation.error || 'Invalid image file.');
          continue;
        }

        try {
          const dataUrl = await fileToBase64(file);
          const sanitizedName = sanitizeFilename(file.name);
          newItems.push({
            id: generateImageId(),
            filename: sanitizedName,
            mimeType: file.type,
            size: file.size,
            base64: extractBase64Data(dataUrl),
            previewUrl: dataUrl,
          });
        } catch (error) {
          toast.error(`Failed to process ${file.name}`);
        }
      }

      if (newItems.length > 0) {
        setAttachments((prev) => [...prev, ...newItems]);
      }
    },
    [attachments.length]
  );

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (files && files.length > 0) {
        await addFiles(files);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [addFiles]
  );

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      const files = event.dataTransfer.files;
      if (files.length > 0) {
        await addFiles(files);
      }
    },
    [addFiles]
  );

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      const errors: { title?: string; creatorName?: string } = {};

      if (!title.trim()) {
        errors.title = 'Please enter a title.';
      }

      if (!creatorName.trim()) {
        errors.creatorName = 'Please enter your name.';
      }

      setFieldErrors(errors);

      if (Object.keys(errors).length > 0) {
        return;
      }

      const payload: CreatePublicTicketPayload = {
        title: title.trim(),
        description: description.trim() || undefined,
        creatorName: creatorName.trim(),
        category,
        attachments: attachments.map((attachment) => ({
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          base64: attachment.base64,
        })),
      };

      try {
        const result = await createTicket.mutateAsync(payload);
        toast.success(result.message || 'Ticket submitted successfully.');
        if (result.attachmentErrors?.length) {
          result.attachmentErrors.forEach((message) => toast.error(message));
        }

        setTitle('');
        setDescription('');
        setCreatorName('');
        setCategory('feature');
        setAttachments([]);
        setFieldErrors({});
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to submit ticket.';
        toast.error(message);
      }
    },
    [title, description, creatorName, category, attachments, createTicket]
  );

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-border/70 bg-card/60 overflow-hidden"
      >
        {/* Collapsible Header - Always visible */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 md:p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div className="text-left">
                <h2 className="text-sm font-semibold">Submit a request</h2>
                <p className="text-xs text-muted-foreground">Share feedback or report an issue</p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>

        {/* Collapsible Content - Form fields */}
        <CollapsibleContent>
          <div className="border-t border-border/50 p-3 md:p-4 space-y-3">
            {/* Title & Name - 2 columns */}
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="public-ticket-title" className="text-xs">
                  Title *
                </Label>
                <Input
                  id="public-ticket-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Short summary"
                  className={cn('h-8 text-sm', fieldErrors.title && 'border-destructive')}
                />
                {fieldErrors.title && (
                  <p className="text-xs text-destructive">{fieldErrors.title}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="public-ticket-name" className="text-xs">
                  Your name *
                </Label>
                <Input
                  id="public-ticket-name"
                  value={creatorName}
                  onChange={(event) => setCreatorName(event.target.value)}
                  placeholder="How should we address you?"
                  className={cn('h-8 text-sm', fieldErrors.creatorName && 'border-destructive')}
                />
                {fieldErrors.creatorName && (
                  <p className="text-xs text-destructive">{fieldErrors.creatorName}</p>
                )}
              </div>
            </div>

            {/* Category & Description - side by side on desktop */}
            <div className="grid gap-3 md:grid-cols-[200px_1fr]">
              <div className="space-y-1">
                <Label htmlFor="public-ticket-category" className="text-xs">
                  Category
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as PublicTicketCategory)}
                >
                  <SelectTrigger id="public-ticket-category" className="h-8 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feature">Feature request</SelectItem>
                    <SelectItem value="bug">Bug report</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="public-ticket-description" className="text-xs">
                  Description
                </Label>
                <Textarea
                  id="public-ticket-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Add details so we can help faster"
                  rows={2}
                  className="resize-y min-h-[60px] max-h-[200px] text-sm"
                />
              </div>
            </div>

            {/* Attachments - compact */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Attachments</Label>
                <span className="text-xs text-muted-foreground">{attachmentCountLabel}</span>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                className={cn(
                  'rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 transition',
                  isDragOver && 'border-primary/60 bg-primary/5'
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  multiple
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex items-center justify-center gap-3 text-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    Drop images or{' '}
                    <button
                      type="button"
                      className="underline hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      browse
                    </button>
                    {' · '}Max {MAX_ATTACHMENTS}, {formatFileSize(MAX_ATTACHMENT_BYTES)} each
                  </p>
                </div>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="relative group overflow-hidden rounded-md border border-border/60 bg-background"
                    >
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.filename}
                        className="h-16 w-16 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(attachment.id)}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end pt-1">
              <Button type="submit" size="sm" disabled={createTicket.isPending}>
                {createTicket.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit ticket'
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </form>
    </Collapsible>
  );
}
