import { Router } from 'express';
import {
  findPublicProjectBySlug,
  validateProjectPassword,
  getPublicProjectTickets,
  // Phase 3.4: Public Ticket Creation
  createPublicTicket,
  safeValidateCreatePublicTicket,
  createTicketAttachments,
  findTicketAttachmentsByTicketIds,
  type TicketAttachmentData,
  type CreateTicketAttachmentData,
} from '@automaker/pg-sync';
import jwt from 'jsonwebtoken';
import {
  buildTicketAttachmentPath,
  createSupabaseSignedUrl,
  getSupabaseStorageConfig,
  uploadToSupabaseStorage,
} from '../../lib/supabase-storage.js';

// ============================================================================
// 🔐 SECURITY: JWT Secret Configuration
// ============================================================================
// In production, JWT_SECRET MUST be set. A fallback to a known dev value
// would make customer tokens forgeable. We fail fast on startup.
const JWT_SECRET = process.env.JWT_SECRET;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

if (!JWT_SECRET) {
  if (IS_PRODUCTION) {
    throw new Error(
      '❌ FATAL: JWT_SECRET environment variable is required in production! ' +
        'Set it to a secure random string (min 32 characters).'
    );
  } else {
    console.warn(
      '⚠️  WARNING: JWT_SECRET not set. Using insecure dev fallback. ' +
        'This is acceptable for local development only.'
    );
  }
}

// Use validated secret or dev fallback (only in non-production)
const SIGNING_SECRET = JWT_SECRET || 'dev-secret-do-not-use-in-prod';
const COOKIE_NAME = 'customer-token';

const MAX_PUBLIC_ATTACHMENTS = 4;
const MAX_PUBLIC_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_PUBLIC_ATTACHMENT_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
]);

// =============================================================================
// 🔍 Description Parsing (Phase 5.3)
// =============================================================================

type PublicTicketCategory = 'feature' | 'bug' | 'question';

interface ParsedTicketDescription {
  description: string | null;
  creatorName: string | null;
  category: PublicTicketCategory | null;
}

/**
 * Parst die strukturierte Description eines Public Tickets.
 *
 * Format (aus createPublicTicket):
 * ```
 * **📝 Erstellt von:** {creatorName}
 * **📂 Kategorie:** {emoji} {category}
 *
 * ---
 *
 * {actual description}
 * ```
 */
function parsePublicTicketDescription(rawDescription: string | null): ParsedTicketDescription {
  if (!rawDescription) {
    return { description: null, creatorName: null, category: null };
  }

  // Extract creatorName: **📝 Erstellt von:** {name}
  const creatorMatch = rawDescription.match(/\*\*📝 Erstellt von:\*\*\s*(.+)/);
  const creatorName = creatorMatch?.[1]?.trim() || null;

  // Extract category: **📂 Kategorie:** {emoji} {category}
  const categoryMatch = rawDescription.match(/\*\*📂 Kategorie:\*\*\s*[✨🐛❓]\s*(\w+)/i);
  let category: PublicTicketCategory | null = null;
  if (categoryMatch?.[1]) {
    const rawCategory = categoryMatch[1].toLowerCase();
    if (rawCategory === 'feature' || rawCategory === 'bug' || rawCategory === 'frage') {
      category = rawCategory === 'frage' ? 'question' : (rawCategory as PublicTicketCategory);
    }
  }

  // Extract actual description: everything after "---"
  const separatorIndex = rawDescription.indexOf('---');
  let description: string | null = null;
  if (separatorIndex !== -1) {
    const afterSeparator = rawDescription.slice(separatorIndex + 3).trim();
    // Filter out placeholder text
    if (afterSeparator && afterSeparator !== '_Keine Beschreibung angegeben_') {
      description = afterSeparator;
    }
  } else {
    // No structured format, use raw description
    description = rawDescription;
  }

  return { description, creatorName, category };
}

interface PublicTicketAttachmentInput {
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
}

interface PublicTicketAttachmentResponse {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

function normalizeBase64Payload(value: string): string {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function parsePublicTicketAttachments(raw: unknown): {
  attachments: PublicTicketAttachmentInput[];
  error?: string;
} {
  if (!raw) {
    return { attachments: [] };
  }

  if (!Array.isArray(raw)) {
    return { attachments: [], error: 'Attachments must be an array.' };
  }

  if (raw.length > MAX_PUBLIC_ATTACHMENTS) {
    return {
      attachments: [],
      error: `Maximum ${MAX_PUBLIC_ATTACHMENTS} attachments allowed.`,
    };
  }

  const attachments: PublicTicketAttachmentInput[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      return { attachments: [], error: 'Invalid attachment payload.' };
    }

    const record = item as Partial<PublicTicketAttachmentInput>;
    const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
    const mimeType = typeof record.mimeType === 'string' ? record.mimeType : '';
    const size = typeof record.size === 'number' ? record.size : 0;
    const base64 = typeof record.base64 === 'string' ? record.base64 : '';

    if (!filename) {
      return { attachments: [], error: 'Attachment filename is required.' };
    }

    if (!ALLOWED_PUBLIC_ATTACHMENT_TYPES.has(mimeType)) {
      return { attachments: [], error: `${filename}: Unsupported file type.` };
    }

    if (!Number.isFinite(size) || size <= 0) {
      return { attachments: [], error: `${filename}: Invalid file size.` };
    }

    if (size > MAX_PUBLIC_ATTACHMENT_BYTES) {
      return { attachments: [], error: `${filename}: File too large.` };
    }

    if (!base64) {
      return { attachments: [], error: `${filename}: Missing file data.` };
    }

    attachments.push({
      filename,
      mimeType,
      size,
      base64,
    });
  }

  return { attachments };
}

async function signTicketAttachments(
  attachments: TicketAttachmentData[],
  bucket: string,
  expiresInSeconds: number
): Promise<Array<TicketAttachmentData & { url: string }>> {
  const signedAttachments = await Promise.all(
    attachments.map(async (attachment) => {
      const url = await createSupabaseSignedUrl({
        bucket,
        path: attachment.storagePath,
        expiresInSeconds,
      });

      return {
        ...attachment,
        url,
      };
    })
  );

  return signedAttachments;
}

export function createPublicProjectsRoutes() {
  const router = Router();

  /**
   * GET /:slug/meta
   * Returns public project info (name, hasPassword, etc.)
   * Does NOT return tickets.
   */
  router.get('/:slug/meta', async (req, res) => {
    try {
      const { slug } = req.params;
      const project = await findPublicProjectBySlug(slug);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project); // Returns PublicProjectData
    } catch (error) {
      console.error('Error fetching public project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /:slug/auth
   * Validates password and sets auth cookie.
   *
   * TODO: Rate Limiting
   * ⚠️ This endpoint is vulnerable to brute-force attacks.
   * Rate limiting should be implemented at either:
   * - Infra level (Nginx, Cloudflare, Supabase Edge Functions)
   * - Application level (e.g., express-rate-limit with Redis for multi-instance)
   * Recommendation: Use infra-level rate limiting for scalability.
   */
  router.post('/:slug/auth', async (req, res) => {
    try {
      const { slug } = req.params;
      const password = typeof req.body?.password === 'string' ? req.body.password : '';

      if (!password) {
        return res.status(400).json({ error: 'Password required' });
      }

      // 1. Get Project ID from Slug (we need ID for password check)
      // findPublicProjectBySlug returns ID.
      const project = await findPublicProjectBySlug(slug);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // 2. Validate Password
      const isValid = await validateProjectPassword(project.id, password);

      if (!isValid) {
        return res.status(401).json({ error: 'Invalid password' });
      }

      // 3. Create Token
      const token = jwt.sign(
        { projectId: project.id, slug: project.slug, role: 'customer' },
        SIGNING_SECRET,
        { expiresIn: '30d' }
      );

      // 4. Set Cookie
      res.cookie(`${COOKIE_NAME}-${project.id}`, token, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'lax', // Needed for top-level navigation if strict prevents it
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error authenticating public project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /:slug/logout
   * Clears auth cookie for this public project.
   */
  router.post('/:slug/logout', async (req, res) => {
    try {
      const { slug } = req.params;
      const project = await findPublicProjectBySlug(slug);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.clearCookie(`${COOKIE_NAME}-${project.id}`, {
        httpOnly: true,
        secure: IS_PRODUCTION,
        sameSite: 'lax',
        path: '/',
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error logging out public project:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /:slug/board
   * Returns board data (tickets).
   * Protected: Requires Valid Cookie or No Password.
   */
  router.get('/:slug/board', async (req, res) => {
    try {
      const { slug } = req.params;
      const project = await findPublicProjectBySlug(slug);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Check Access
      let hasAccess = false;

      if (!project.hasPassword) {
        // Public without password
        hasAccess = true;
      } else {
        // Password protected -> Check Cookie
        const cookieName = `${COOKIE_NAME}-${project.id}`;
        const token = req.cookies[cookieName];

        if (token) {
          try {
            const decoded = jwt.verify(token, SIGNING_SECRET) as { projectId: string };
            if (decoded.projectId === project.id) {
              hasAccess = true;
            }
          } catch (err) {
            // Invalid token
          }
        }
      }

      if (!hasAccess) {
        return res.status(401).json({ error: 'Unauthorized', needsLogin: true });
      }

      // Fetch Tickets
      const tickets = await getPublicProjectTickets(project.id, {
        visibleStatuses: project.publicSettings.visibleStatuses,
      });

      const ticketIds = tickets.map((ticket) => ticket.id);
      const attachmentsByTicket = new Map<string, PublicTicketAttachmentResponse[]>();

      if (ticketIds.length > 0) {
        try {
          const { bucket, signedUrlTtlSeconds } = getSupabaseStorageConfig();
          const attachments = await findTicketAttachmentsByTicketIds(ticketIds);

          if (attachments.length > 0) {
            const signedAttachments = await signTicketAttachments(
              attachments,
              bucket,
              signedUrlTtlSeconds
            );

            signedAttachments.forEach((attachment) => {
              const entry = attachmentsByTicket.get(attachment.ticketId) ?? [];
              entry.push({
                id: attachment.id,
                filename: attachment.filename,
                mimeType: attachment.mimeType,
                size: attachment.size,
                url: attachment.url,
              });
              attachmentsByTicket.set(attachment.ticketId, entry);
            });
          }
        } catch (error) {
          console.error('Failed to load ticket attachments:', error);
        }
      }

      res.json({
        project,
        tickets: tickets.map((ticket) => {
          const parsed = parsePublicTicketDescription(ticket.description);
          return {
            ...ticket,
            description: parsed.description,
            creatorName: parsed.creatorName,
            category: parsed.category,
            attachments: attachmentsByTicket.get(ticket.id) ?? [],
          };
        }),
      });
    } catch (error) {
      console.error('Error fetching public board:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /:slug/tickets
   * Creates a new ticket from the customer portal.
   * Protected: Requires Valid Cookie or No Password.
   *
   * Body: { title, description?, creatorName, category }
   *
   * Phase 3.5: Respects publicSettings.allowTicketCreation
   */
  router.post('/:slug/tickets', async (req, res) => {
    try {
      const { slug } = req.params;
      const project = await findPublicProjectBySlug(slug);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Phase 3.5: Check if ticket creation is allowed
      if (!project.publicSettings.allowTicketCreation) {
        return res.status(403).json({
          error: 'Ticket creation is disabled for this project',
          code: 'TICKET_CREATION_DISABLED',
        });
      }

      // Check Access (same as GET /:slug/board)
      let hasAccess = false;

      if (!project.hasPassword) {
        hasAccess = true;
      } else {
        const cookieName = `${COOKIE_NAME}-${project.id}`;
        const token = req.cookies[cookieName];

        if (token) {
          try {
            const decoded = jwt.verify(token, SIGNING_SECRET) as { projectId: string };
            if (decoded.projectId === project.id) {
              hasAccess = true;
            }
          } catch (err) {
            // Invalid token
          }
        }
      }

      if (!hasAccess) {
        return res.status(401).json({ error: 'Unauthorized', needsLogin: true });
      }

      // Validate Input
      const validationResult = safeValidateCreatePublicTicket(req.body);

      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: validationResult.error.flatten().fieldErrors,
        });
      }

      const ticketData = validationResult.data;

      // Validate attachments (optional)
      const attachmentResult = parsePublicTicketAttachments(req.body?.attachments);
      if (attachmentResult.error) {
        return res.status(400).json({
          error: attachmentResult.error,
          code: 'INVALID_ATTACHMENTS',
        });
      }

      let storageConfig: { bucket: string; signedUrlTtlSeconds: number } | null = null;

      if (attachmentResult.attachments.length > 0) {
        try {
          const config = getSupabaseStorageConfig();
          storageConfig = {
            bucket: config.bucket,
            signedUrlTtlSeconds: config.signedUrlTtlSeconds,
          };
        } catch (error) {
          console.error('Supabase storage not configured:', error);
          return res.status(500).json({
            error: 'Supabase storage not configured',
            code: 'STORAGE_NOT_CONFIGURED',
          });
        }
      }

      // Create Ticket
      const ticket = await createPublicTicket(project.id, ticketData);

      let createdAttachments: TicketAttachmentData[] = [];
      const attachmentErrors: string[] = [];

      if (attachmentResult.attachments.length > 0 && storageConfig) {
        const attachmentsToInsert: CreateTicketAttachmentData[] = [];

        for (const attachment of attachmentResult.attachments) {
          const base64Payload = normalizeBase64Payload(attachment.base64);
          let buffer: Buffer;

          try {
            buffer = Buffer.from(base64Payload, 'base64');
          } catch (error) {
            attachmentErrors.push(`${attachment.filename}: Invalid base64 payload.`);
            continue;
          }

          if (buffer.length > MAX_PUBLIC_ATTACHMENT_BYTES) {
            attachmentErrors.push(`${attachment.filename}: File too large.`);
            continue;
          }

          const storagePath = buildTicketAttachmentPath(project.id, ticket.id, attachment.filename);

          try {
            await uploadToSupabaseStorage({
              bucket: storageConfig.bucket,
              path: storagePath,
              contentType: attachment.mimeType,
              body: buffer,
            });

            attachmentsToInsert.push({
              ticketId: ticket.id,
              projectId: project.id,
              storagePath,
              filename: attachment.filename,
              mimeType: attachment.mimeType,
              size: buffer.length,
              source: 'customer',
            });
          } catch (error) {
            console.error('Attachment upload failed:', error);
            attachmentErrors.push(`${attachment.filename}: Upload failed.`);
          }
        }

        if (attachmentsToInsert.length > 0) {
          const inserted = await createTicketAttachments(attachmentsToInsert);
          createdAttachments = inserted as TicketAttachmentData[];
        }
      }

      let signedAttachments: PublicTicketAttachmentResponse[] = [];

      if (createdAttachments.length > 0 && storageConfig) {
        const signed = await signTicketAttachments(
          createdAttachments,
          storageConfig.bucket,
          storageConfig.signedUrlTtlSeconds
        );

        signedAttachments = signed.map((attachment) => ({
          id: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url,
        }));
      }

      res.status(201).json({
        success: true,
        ticket: {
          id: ticket.id,
          title: ticket.title,
          status: ticket.status,
        },
        attachments: signedAttachments,
        attachmentErrors: attachmentErrors.length > 0 ? attachmentErrors : undefined,
        message: 'Danke! Dein Feedback wurde erfolgreich eingereicht.',
      });
    } catch (error) {
      console.error('Error creating public ticket:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
