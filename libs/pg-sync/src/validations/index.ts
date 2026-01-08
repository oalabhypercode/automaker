/**
 * 📋 Validations Index
 *
 * Re-exports aller Zod-Schemas für Validierung.
 */

// Ticket Schemas
export {
  // Enums
  TicketStatusSchema,
  TicketPrioritySchema,
  type TicketStatusSchemaType,
  type TicketPrioritySchemaType,

  // Schemas
  CreateTicketSchema,
  UpdateTicketSchema,
  ChangeTicketStatusSchema,
  ClaimTicketSchema,

  // Phase 3.4: Public Ticket Schema
  PublicTicketCategorySchema,
  CreatePublicTicketSchema,
  type PublicTicketCategory,
  type CreatePublicTicketInput,
  type CreatePublicTicketDTO,

  // Types
  type CreateTicketInput,
  type CreateTicketDTO,
  type UpdateTicketInput,
  type UpdateTicketDTO,
  type ChangeTicketStatusDTO,
  type ClaimTicketDTO,

  // Helpers
  validateCreateTicket,
  safeValidateCreateTicket,
  validateUpdateTicket,
  formatZodErrors,
  // Phase 3.4: Public Ticket Helpers
  validateCreatePublicTicket,
  safeValidateCreatePublicTicket,
} from './ticket.schema.js';
