import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageIcon, Loader2, X } from 'lucide-react';
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
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-border/70 bg-card/60 p-5 md:p-6"
    >
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Submit a request</h2>
        <p className="text-sm text-muted-foreground">
          Share feedback or upload screenshots to help us understand your request.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="public-ticket-title">Title *</Label>
          <Input
            id="public-ticket-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short summary"
            className={fieldErrors.title ? 'border-destructive' : undefined}
          />
          {fieldErrors.title && <p className="text-xs text-destructive">{fieldErrors.title}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="public-ticket-name">Your name *</Label>
          <Input
            id="public-ticket-name"
            value={creatorName}
            onChange={(event) => setCreatorName(event.target.value)}
            placeholder="How should we address you?"
            className={fieldErrors.creatorName ? 'border-destructive' : undefined}
          />
          {fieldErrors.creatorName && (
            <p className="text-xs text-destructive">{fieldErrors.creatorName}</p>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="public-ticket-category">Category</Label>
        <Select
          value={category}
          onValueChange={(value) => setCategory(value as PublicTicketCategory)}
        >
          <SelectTrigger id="public-ticket-category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="feature">Feature request</SelectItem>
            <SelectItem value="bug">Bug report</SelectItem>
            <SelectItem value="question">Question</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 space-y-2">
        <Label htmlFor="public-ticket-description">Description</Label>
        <Textarea
          id="public-ticket-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add details so we can help faster"
          rows={4}
        />
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <Label>Attachments</Label>
          <span className="text-xs text-muted-foreground">{attachmentCountLabel}</span>
        </div>

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={cn(
            'rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 transition',
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

          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Drop images here</p>
              <p className="text-xs text-muted-foreground">
                or{' '}
                <button
                  type="button"
                  className="underline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  browse files
                </button>
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Max {MAX_ATTACHMENTS} images, {formatFileSize(MAX_ATTACHMENT_BYTES)} each
            </p>
          </div>
        </div>

        {attachments.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative overflow-hidden rounded-lg border border-border/60 bg-background"
              >
                <img
                  src={attachment.previewUrl}
                  alt={attachment.filename}
                  className="h-24 w-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(attachment.id)}
                  className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="px-2 py-1 text-xs text-muted-foreground truncate">
                  {attachment.filename}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end">
        <Button type="submit" disabled={createTicket.isPending}>
          {createTicket.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit ticket'
          )}
        </Button>
      </div>
    </form>
  );
}
