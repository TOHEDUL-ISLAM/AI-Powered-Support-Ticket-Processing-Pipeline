// US-1.5: Zod schema for ticket submission request
import { z } from 'zod';

export const CreateTicketSchema = z.object({
  subject: z.string().min(1, 'subject is required'),
  body: z.string().min(1, 'body is required'),
  submitter: z.string().min(1, 'submitter is required'),
  tenant_id: z.string().min(1, 'tenant_id is required'),
});

export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

export function formatZodErrors(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: String(issue.path[0] ?? 'unknown'),
    message: issue.message,
  }));
}
