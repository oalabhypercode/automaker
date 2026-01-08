/**
 * 📎 Attachment Actions
 *
 * Create operations for ticket attachments.
 */

import { getDb } from '../db/client.js';
import { ticketAttachments, type DbTicketAttachment } from '../db/schema/index.js';

// =============================================================================
// 📦 TYPES
// =============================================================================

export interface CreateTicketAttachmentData {
  ticketId: string;
  projectId: string;
  storagePath: string;
  filename: string;
  mimeType: string;
  size: number;
  source?: 'customer' | 'internal' | string;
}

// =============================================================================
// 📎 ACTIONS
// =============================================================================

export async function createTicketAttachments(
  attachments: CreateTicketAttachmentData[]
): Promise<DbTicketAttachment[]> {
  if (attachments.length === 0) {
    return [];
  }

  const db = getDb();
  const insertData = attachments.map((attachment) => ({
    ...attachment,
    source: attachment.source ?? 'customer',
  }));

  return db.insert(ticketAttachments).values(insertData).returning();
}
