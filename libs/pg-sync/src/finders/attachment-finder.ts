/**
 * 📎 Attachment Finder
 *
 * Read-only queries for ticket attachments.
 */

import { inArray } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { ticketAttachments } from '../db/schema/index.js';

// =============================================================================
// 📐 TYPES
// =============================================================================

export interface TicketAttachmentData {
  id: string;
  ticketId: string;
  projectId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
  source: string;
  createdAt: Date;
}

// =============================================================================
// 🔍 FINDERS
// =============================================================================

export async function findTicketAttachmentsByTicketIds(
  ticketIds: string[]
): Promise<TicketAttachmentData[]> {
  if (ticketIds.length === 0) {
    return [];
  }

  const db = getDb();
  const result = await db
    .select({
      id: ticketAttachments.id,
      ticketId: ticketAttachments.ticketId,
      projectId: ticketAttachments.projectId,
      storagePath: ticketAttachments.storagePath,
      filename: ticketAttachments.filename,
      mimeType: ticketAttachments.mimeType,
      size: ticketAttachments.size,
      source: ticketAttachments.source,
      createdAt: ticketAttachments.createdAt,
    })
    .from(ticketAttachments)
    .where(inArray(ticketAttachments.ticketId, ticketIds));

  return result;
}
