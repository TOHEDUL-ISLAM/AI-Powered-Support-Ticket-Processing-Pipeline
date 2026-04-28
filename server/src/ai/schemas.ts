// US-3.1 + US-3.2 + US-4.1 + US-4.3: validate AI gateway JSON responses before persistence
import { z } from 'zod';
import type { ResolutionResult } from '../repositories/resolution.repository';
import type { TriageResult } from '../repositories/triage.repository';
import { AiGatewayError } from './errors';

export const TriageGatewayResponseSchema = z.object({
  category: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'frustrated']),
  escalation_needed: z.boolean(),
  routing_target: z.string().min(1),
  summary: z.string().min(1).max(200),
});

export const ResolutionGatewayResponseSchema = z.object({
  customer_reply: z.string().min(1),
  internal_note: z.string().min(1),
  recommended_actions: z.array(z.string().min(1)).min(1).max(5),
});

export function parseTriageGatewayJson(content: string): TriageResult {
  return parseGatewayJson(content, TriageGatewayResponseSchema);
}

export function parseResolutionGatewayJson(content: string): ResolutionResult {
  return parseGatewayJson(content, ResolutionGatewayResponseSchema);
}

function parseGatewayJson<T>(content: string, schema: z.ZodType<T>): T {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new AiGatewayError('gateway_bad_response', 'AI gateway returned invalid JSON', true);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new AiGatewayError('gateway_bad_response', 'AI gateway returned an invalid response shape', true);
  }

  return result.data;
}
