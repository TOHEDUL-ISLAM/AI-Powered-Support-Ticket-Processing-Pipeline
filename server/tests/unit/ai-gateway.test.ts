// US-4.1: triage schema validation — enum constraints, summary length, and 5 ticket-type fixtures
import { describe, expect, it, vi } from 'vitest';
import {
  AiGatewayError,
  PortkeyAiGateway,
  parseResolutionGatewayJson,
  parseTriageGatewayJson,
} from '../../src/ai';

const validTriage = {
  category: 'billing',
  priority: 'high' as const,
  sentiment: 'frustrated' as const,
  escalation_needed: true,
  routing_target: 'billing',
  summary: 'Customer cannot access invoice.',
};

describe('parseTriageGatewayJson', () => {
  describe('valid inputs', () => {
    it('parses a complete valid triage response', () => {
      const result = parseTriageGatewayJson(JSON.stringify(validTriage));
      expect(result).toEqual(validTriage);
    });

    it.each(['low', 'medium', 'high', 'critical'] as const)(
      'accepts priority "%s"',
      (priority) => {
        const result = parseTriageGatewayJson(
          JSON.stringify({ ...validTriage, priority }),
        );
        expect(result.priority).toBe(priority);
      },
    );

    it.each(['positive', 'neutral', 'negative', 'frustrated'] as const)(
      'accepts sentiment "%s"',
      (sentiment) => {
        const result = parseTriageGatewayJson(
          JSON.stringify({ ...validTriage, sentiment }),
        );
        expect(result.sentiment).toBe(sentiment);
      },
    );

    it('accepts a summary of exactly 200 characters', () => {
      const summary = 'a'.repeat(200);
      const result = parseTriageGatewayJson(JSON.stringify({ ...validTriage, summary }));
      expect(result.summary.length).toBe(200);
    });
  });

  describe('five ticket-type fixtures', () => {
    it('ticket type: billing dispute', () => {
      const result = parseTriageGatewayJson(
        JSON.stringify({
          category: 'billing',
          priority: 'high',
          sentiment: 'frustrated',
          escalation_needed: false,
          routing_target: 'billing',
          summary: 'Customer was charged twice for the same subscription month.',
        }),
      );
      expect(result.category).toBe('billing');
      expect(result.priority).toBe('high');
    });

    it('ticket type: technical outage', () => {
      const result = parseTriageGatewayJson(
        JSON.stringify({
          category: 'technical',
          priority: 'critical',
          sentiment: 'frustrated',
          escalation_needed: true,
          routing_target: 'tier2',
          summary: 'Production API returning 503 errors for all requests since 14:00 UTC.',
        }),
      );
      expect(result.priority).toBe('critical');
      expect(result.escalation_needed).toBe(true);
    });

    it('ticket type: account access', () => {
      const result = parseTriageGatewayJson(
        JSON.stringify({
          category: 'account_access',
          priority: 'medium',
          sentiment: 'neutral',
          escalation_needed: false,
          routing_target: 'tier1',
          summary: 'User forgot password and is unable to reset via email link.',
        }),
      );
      expect(result.category).toBe('account_access');
      expect(result.sentiment).toBe('neutral');
    });

    it('ticket type: feature request', () => {
      const result = parseTriageGatewayJson(
        JSON.stringify({
          category: 'feature_request',
          priority: 'low',
          sentiment: 'positive',
          escalation_needed: false,
          routing_target: 'product',
          summary: 'Customer requesting CSV export for the analytics dashboard.',
        }),
      );
      expect(result.priority).toBe('low');
      expect(result.sentiment).toBe('positive');
    });

    it('ticket type: security concern', () => {
      const result = parseTriageGatewayJson(
        JSON.stringify({
          category: 'security',
          priority: 'critical',
          sentiment: 'frustrated',
          escalation_needed: true,
          routing_target: 'security',
          summary: 'Suspicious login attempts detected from unknown IP addresses.',
        }),
      );
      expect(result.escalation_needed).toBe(true);
      expect(result.routing_target).toBe('security');
    });
  });

  describe('invalid inputs — must throw retryable AiGatewayError', () => {
    it('throws for invalid JSON', () => {
      expect(() => parseTriageGatewayJson('not-json')).toThrow(AiGatewayError);
      try {
        parseTriageGatewayJson('not-json');
      } catch (err) {
        expect((err as AiGatewayError).code).toBe('gateway_bad_response');
        expect((err as AiGatewayError).retryable).toBe(true);
      }
    });

    it('throws for invalid priority value', () => {
      expect(() =>
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, priority: 'urgent' })),
      ).toThrow(AiGatewayError);
      try {
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, priority: 'urgent' }));
      } catch (err) {
        expect((err as AiGatewayError).code).toBe('gateway_bad_response');
        expect((err as AiGatewayError).retryable).toBe(true);
      }
    });

    it('throws for invalid sentiment value', () => {
      expect(() =>
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, sentiment: 'angry' })),
      ).toThrow(AiGatewayError);
    });

    it('throws for summary exceeding 200 characters', () => {
      const longSummary = 'a'.repeat(201);
      expect(() =>
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, summary: longSummary })),
      ).toThrow(AiGatewayError);
      try {
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, summary: longSummary }));
      } catch (err) {
        expect((err as AiGatewayError).code).toBe('gateway_bad_response');
        expect((err as AiGatewayError).retryable).toBe(true);
      }
    });

    it('throws when category field is missing', () => {
      const withoutCategory: Partial<typeof validTriage> = { ...validTriage };
      delete withoutCategory.category;
      expect(() => parseTriageGatewayJson(JSON.stringify(withoutCategory))).toThrow(AiGatewayError);
    });

    it('throws when escalation_needed field is missing', () => {
      const without: Partial<typeof validTriage> = { ...validTriage };
      delete without.escalation_needed;
      expect(() => parseTriageGatewayJson(JSON.stringify(without))).toThrow(AiGatewayError);
    });

    it('throws when summary is an empty string', () => {
      expect(() =>
        parseTriageGatewayJson(JSON.stringify({ ...validTriage, summary: '' })),
      ).toThrow(AiGatewayError);
    });
  });
});

const validResolution = {
  customer_reply: 'Thank you for contacting us. We will resolve this shortly.',
  internal_note: 'Assign to billing queue. Customer charged twice.',
  recommended_actions: ['Verify charge in Stripe', 'Issue refund if duplicate confirmed'],
};

describe('parseResolutionGatewayJson', () => {
  describe('valid inputs', () => {
    it('parses a valid resolution response', () => {
      const result = parseResolutionGatewayJson(JSON.stringify(validResolution));
      expect(result.recommended_actions).toHaveLength(2);
    });

    it('accepts exactly 1 recommended action', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({ ...validResolution, recommended_actions: ['Review the account'] }),
      );
      expect(result.recommended_actions).toHaveLength(1);
    });

    it('accepts exactly 5 recommended actions', () => {
      const actions = ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5'];
      const result = parseResolutionGatewayJson(
        JSON.stringify({ ...validResolution, recommended_actions: actions }),
      );
      expect(result.recommended_actions).toHaveLength(5);
    });
  });

  describe('five ticket-type fixtures', () => {
    it('ticket type: billing dispute resolution', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({
          customer_reply:
            'We apologise for the duplicate charge. Our billing team will issue a full refund within 3–5 business days.',
          internal_note: 'Confirm duplicate in Stripe. Process refund. Close after confirmation.',
          recommended_actions: ['Verify duplicate charge in Stripe', 'Issue refund', 'Send confirmation email'],
        }),
      );
      expect(result.customer_reply).toContain('refund');
      expect(result.recommended_actions.length).toBeGreaterThanOrEqual(1);
    });

    it('ticket type: technical outage resolution', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({
          customer_reply:
            'We are aware of the API issue and our team is working on a fix. We will update you within the hour.',
          internal_note: 'P1 incident — escalate to on-call engineer immediately.',
          recommended_actions: ['Page on-call engineer', 'Open incident channel', 'Update status page'],
        }),
      );
      expect(result.recommended_actions).toHaveLength(3);
    });

    it('ticket type: account access resolution', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({
          customer_reply:
            'We have sent a new password reset link to your registered email address. Please check your spam folder if you do not see it.',
          internal_note: 'Manual reset sent. Monitor for follow-up.',
          recommended_actions: ['Send manual password reset', 'Verify email address on file'],
        }),
      );
      expect(result.internal_note).toBeTruthy();
    });

    it('ticket type: feature request resolution', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({
          customer_reply:
            'Thank you for this suggestion. We have logged it with our product team for consideration in a future release.',
          internal_note: 'Log in product backlog. Low priority.',
          recommended_actions: ['Log in product backlog'],
        }),
      );
      expect(result.recommended_actions).toHaveLength(1);
    });

    it('ticket type: security concern resolution', () => {
      const result = parseResolutionGatewayJson(
        JSON.stringify({
          customer_reply:
            'We take security seriously. We have temporarily locked the account and our security team will review the activity within 24 hours.',
          internal_note: 'Escalate to security team. Lock account. Review login logs.',
          recommended_actions: [
            'Lock account immediately',
            'Escalate to security team',
            'Review login history',
            'Notify user of outcome',
          ],
        }),
      );
      expect(result.recommended_actions).toHaveLength(4);
    });
  });

  describe('invalid inputs — must throw retryable AiGatewayError', () => {
    it('throws for 0 recommended actions', () => {
      expect(() =>
        parseResolutionGatewayJson(JSON.stringify({ ...validResolution, recommended_actions: [] })),
      ).toThrow(AiGatewayError);
    });

    it('throws for 6 recommended actions', () => {
      const actions = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
      expect(() =>
        parseResolutionGatewayJson(JSON.stringify({ ...validResolution, recommended_actions: actions })),
      ).toThrow(AiGatewayError);
      try {
        parseResolutionGatewayJson(JSON.stringify({ ...validResolution, recommended_actions: actions }));
      } catch (err) {
        expect((err as AiGatewayError).code).toBe('gateway_bad_response');
        expect((err as AiGatewayError).retryable).toBe(true);
      }
    });

    it('throws when customer_reply is missing', () => {
      const without: Partial<typeof validResolution> = { ...validResolution };
      delete without.customer_reply;
      expect(() => parseResolutionGatewayJson(JSON.stringify(without))).toThrow(AiGatewayError);
    });

    it('throws when internal_note is missing', () => {
      const without: Partial<typeof validResolution> = { ...validResolution };
      delete without.internal_note;
      expect(() => parseResolutionGatewayJson(JSON.stringify(without))).toThrow(AiGatewayError);
    });

    it('throws when customer_reply is empty string', () => {
      expect(() =>
        parseResolutionGatewayJson(JSON.stringify({ ...validResolution, customer_reply: '' })),
      ).toThrow(AiGatewayError);
    });
  });
});

describe('PortkeyAiGateway', () => {
  it('normalizes a successful triage response with provider metadata', async () => {
    const client = makePortkeyClient({
      choices: [{ message: { content: JSON.stringify(validTriage) } }],
      provider_used: 'openrouter',
    });
    const gateway = new PortkeyAiGateway(client as never, 'openrouter');

    const result = await gateway.triageTicket({
      ticketId: 'ticket-1',
      subject: 'Invoice unavailable',
      body: 'I cannot open my invoice.',
    });

    expect(result).toEqual({
      result: validTriage,
      provider: 'openrouter',
      primaryProvider: 'openrouter',
      fallback: false,
    });
    expect(client.chat.completions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    );
  });

  it('marks fallback true when a non-primary provider handles resolution', async () => {
    const client = makePortkeyClient({
      choices: [{ message: { content: JSON.stringify(validResolution) } }],
      provider: 'openai',
    });
    const gateway = new PortkeyAiGateway(client as never, 'openrouter');

    const result = await gateway.draftResolution({
      ticketId: 'ticket-1',
      subject: 'Invoice unavailable',
      body: 'I cannot open my invoice.',
      triage: validTriage,
    });

    expect(result.provider).toBe('openai');
    expect(result.primaryProvider).toBe('openrouter');
    expect(result.fallback).toBe(true);
    expect(result.result).toEqual(validResolution);
  });

  it('extracts provider metadata from response headers', async () => {
    const client = makePortkeyClient({
      choices: [{ message: { content: JSON.stringify(validTriage) } }],
      getHeaders: () => ({ 'provider-used': 'Groq' }),
    });
    const gateway = new PortkeyAiGateway(client as never, 'openrouter');

    const result = await gateway.triageTicket({
      ticketId: 'ticket-1',
      subject: 'Invoice unavailable',
      body: 'I cannot open my invoice.',
    });

    expect(result.provider).toBe('groq');
    expect(result.fallback).toBe(true);
  });

  it('throws a retryable contract error when provider metadata is missing', async () => {
    const client = makePortkeyClient({
      choices: [{ message: { content: JSON.stringify(validTriage) } }],
    });
    const gateway = new PortkeyAiGateway(client as never, 'openrouter');

    await expect(
      gateway.triageTicket({
        ticketId: 'ticket-1',
        subject: 'Invoice unavailable',
        body: 'I cannot open my invoice.',
      }),
    ).rejects.toMatchObject({
      code: 'gateway_contract_error',
      retryable: true,
    });
  });

  it('maps rate limit SDK failures to typed retryable gateway errors', async () => {
    const client = makePortkeyClient(Promise.reject({ status: 429 }));
    const gateway = new PortkeyAiGateway(client as never, 'openrouter');

    await expect(
      gateway.triageTicket({
        ticketId: 'ticket-1',
        subject: 'Invoice unavailable',
        body: 'I cannot open my invoice.',
      }),
    ).rejects.toMatchObject({
      code: 'gateway_rate_limited',
      retryable: true,
      status: 429,
    });
  });
});

function makePortkeyClient(response: unknown) {
  const create =
    response instanceof Promise
      ? vi.fn().mockReturnValue(response)
      : vi.fn().mockResolvedValue(response);

  return {
    chat: {
      completions: {
        create,
      },
    },
  };
}
