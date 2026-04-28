// US-1.5: unit tests for ticket submission Zod schema
import { describe, expect, it } from 'vitest';
import { CreateTicketSchema, formatZodErrors } from '../../src/schemas/ticket.schema';

const VALID = {
  subject: 'Login broken',
  body: 'Cannot log in since yesterday',
  submitter: 'alice',
  tenant_id: 'acme',
};

describe('CreateTicketSchema', () => {
  it('passes when all fields are valid', () => {
    const result = CreateTicketSchema.safeParse(VALID);
    expect(result.success).toBe(true);
  });

  it('strips unknown extra fields', () => {
    const result = CreateTicketSchema.safeParse({ ...VALID, foo: 'bar' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('foo');
    }
  });

  it('fails when subject is missing', () => {
    const result = CreateTicketSchema.safeParse({
      body: VALID.body,
      submitter: VALID.submitter,
      tenant_id: VALID.tenant_id,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = formatZodErrors(result.error);
      expect(issues.some((i) => i.field === 'subject')).toBe(true);
    }
  });

  it('fails when body is an empty string', () => {
    const result = CreateTicketSchema.safeParse({ ...VALID, body: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = formatZodErrors(result.error);
      expect(issues.some((i) => i.field === 'body')).toBe(true);
    }
  });

  it('reports all failing fields when multiple are missing', () => {
    const result = CreateTicketSchema.safeParse({
      submitter: VALID.submitter,
      tenant_id: VALID.tenant_id,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issues = formatZodErrors(result.error);
      const fields = issues.map((i) => i.field);
      expect(fields).toContain('subject');
      expect(fields).toContain('body');
    }
  });
});
