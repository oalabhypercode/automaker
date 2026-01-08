/**
 * 📋 Ticket Validation Schemas
 *
 * Zod-Schemas für Ticket-Validierung.
 * Verwendet für Web-UI Formulare und API-Eingaben.
 *
 * @see docs/pg-online-sync/tasks/phase-2.1-ticket-creation.md
 */

import { z } from 'zod';

// =============================================================================
// 🎭 BASE ENUMS
// =============================================================================

/**
 * Ticket-Status Schema
 */
export const TicketStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'archived',
]);

export type TicketStatusSchemaType = z.infer<typeof TicketStatusSchema>;

/**
 * Ticket-Priorität Schema
 */
export const TicketPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export type TicketPrioritySchemaType = z.infer<typeof TicketPrioritySchema>;

// =============================================================================
// 📝 CREATE TICKET SCHEMA
// =============================================================================

/**
 * Schema für Ticket-Erstellung
 *
 * Verwendet von CreateTicketDialog und API-Endpoints.
 */
export const CreateTicketSchema = z.object({
  /** Projekt-ID (UUID) */
  projectId: z.string().uuid('Ungültige Projekt-ID'),

  /** Ticket-Titel (3-200 Zeichen) */
  title: z
    .string()
    .min(3, 'Titel muss mindestens 3 Zeichen haben')
    .max(200, 'Titel darf maximal 200 Zeichen haben')
    .transform((val) => val.trim()),

  /** Beschreibung (optional, max 10.000 Zeichen) */
  description: z
    .string()
    .max(10000, 'Beschreibung darf maximal 10.000 Zeichen haben')
    .optional()
    .transform((val) => val?.trim() || undefined),

  /** Status (default: todo) */
  status: TicketStatusSchema.default('todo'),

  /** Priorität (default: medium) */
  priority: TicketPrioritySchema.default('medium'),

  /** Labels/Tags */
  labels: z
    .array(z.string().max(50))
    .default([])
    .transform((labels) => labels.map((l) => l.trim().toLowerCase()).filter(Boolean)),

  /** Zugewiesener User (optional) */
  assigneeId: z.string().uuid().nullable().optional(),

  /** Fälligkeitsdatum (optional) */
  dueDate: z.date().nullable().optional(),
});

export type CreateTicketInput = z.input<typeof CreateTicketSchema>;
export type CreateTicketDTO = z.output<typeof CreateTicketSchema>;

// =============================================================================
// 📝 UPDATE TICKET SCHEMA
// =============================================================================

/**
 * Schema für Ticket-Update
 */
export const UpdateTicketSchema = z.object({
  /** Ticket-Titel (3-200 Zeichen) */
  title: z
    .string()
    .min(3, 'Titel muss mindestens 3 Zeichen haben')
    .max(200, 'Titel darf maximal 200 Zeichen haben')
    .transform((val) => val.trim())
    .optional(),

  /** Beschreibung */
  description: z
    .string()
    .max(10000, 'Beschreibung darf maximal 10.000 Zeichen haben')
    .optional()
    .transform((val) => val?.trim()),

  /** Priorität */
  priority: TicketPrioritySchema.optional(),

  /** Labels/Tags */
  labels: z
    .array(z.string().max(50))
    .transform((labels) => labels.map((l) => l.trim().toLowerCase()).filter(Boolean))
    .optional(),
});

export type UpdateTicketInput = z.input<typeof UpdateTicketSchema>;
export type UpdateTicketDTO = z.output<typeof UpdateTicketSchema>;

// =============================================================================
// 📝 STATUS CHANGE SCHEMA
// =============================================================================

/**
 * Schema für Status-Änderung
 */
export const ChangeTicketStatusSchema = z.object({
  /** Ticket-ID */
  ticketId: z.string().uuid('Ungültige Ticket-ID'),

  /** Neuer Status */
  newStatus: TicketStatusSchema,
});

export type ChangeTicketStatusDTO = z.output<typeof ChangeTicketStatusSchema>;

// =============================================================================
// 📝 CLAIM TICKET SCHEMA
// =============================================================================

/**
 * Schema für Ticket-Claim
 */
export const ClaimTicketSchema = z.object({
  /** Ticket-ID */
  ticketId: z.string().uuid('Ungültige Ticket-ID'),
});

export type ClaimTicketDTO = z.output<typeof ClaimTicketSchema>;

// =============================================================================
// 📝 PUBLIC TICKET SCHEMA (Phase 3.4 - Kunden-Ticket-Eingang)
// =============================================================================

/**
 * Ticket-Kategorie für Kunden-Tickets
 */
export const PublicTicketCategorySchema = z.enum([
  'bug', // Fehler
  'feature', // Feature-Wunsch
  'question', // Frage
]);

export type PublicTicketCategory = z.infer<typeof PublicTicketCategorySchema>;

/**
 * Schema für Ticket-Erstellung durch Kunden
 *
 * Vereinfachtes Formular mit Pflichtfeldern:
 * - Titel (was ist das Problem/Wunsch)
 * - Name (wer meldet es)
 * - Kategorie (Bug/Feature/Frage)
 * - Beschreibung (optional, Details)
 */
export const CreatePublicTicketSchema = z.object({
  /** Ticket-Titel (3-200 Zeichen) */
  title: z
    .string()
    .min(3, 'Titel muss mindestens 3 Zeichen haben')
    .max(200, 'Titel darf maximal 200 Zeichen haben')
    .transform((val) => val.trim()),

  /** Beschreibung (optional, max 5.000 Zeichen) */
  description: z
    .string()
    .max(5000, 'Beschreibung darf maximal 5.000 Zeichen haben')
    .optional()
    .transform((val) => val?.trim() || undefined),

  /** Name des Kunden (2-100 Zeichen) */
  creatorName: z
    .string()
    .min(2, 'Bitte gib deinen Namen an')
    .max(100, 'Name darf maximal 100 Zeichen haben')
    .transform((val) => val.trim()),

  /** Kategorie: bug, feature, question */
  category: PublicTicketCategorySchema,
});

export type CreatePublicTicketInput = z.input<typeof CreatePublicTicketSchema>;
export type CreatePublicTicketDTO = z.output<typeof CreatePublicTicketSchema>;

/**
 * Validiert CreatePublicTicket Input
 */
export function validateCreatePublicTicket(data: unknown): CreatePublicTicketDTO {
  return CreatePublicTicketSchema.parse(data);
}

/**
 * Sichere Validierung (gibt Result zurück statt zu werfen)
 */
export function safeValidateCreatePublicTicket(data: unknown) {
  return CreatePublicTicketSchema.safeParse(data);
}

// =============================================================================
// 🔧 VALIDATION HELPERS
// =============================================================================

/**
 * Validiert CreateTicket Input
 */
export function validateCreateTicket(data: unknown): CreateTicketDTO {
  return CreateTicketSchema.parse(data);
}

/**
 * Sichere Validierung (gibt Result zurück statt zu werfen)
 */
export function safeValidateCreateTicket(data: unknown) {
  return CreateTicketSchema.safeParse(data);
}

/**
 * Validiert UpdateTicket Input
 */
export function validateUpdateTicket(data: unknown): UpdateTicketDTO {
  return UpdateTicketSchema.parse(data);
}

/**
 * Extrahiert Fehlermeldungen aus ZodError
 */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.');
    if (!errors[path]) {
      errors[path] = issue.message;
    }
  }

  return errors;
}
