// US-3.1 + US-3.2 + US-4.1: Portkey-backed AI gateway implementation and response normalization
import Portkey from 'portkey-ai';
import { config } from '../config';
import type { ResolutionResult } from '../repositories/resolution.repository';
import type { TriageResult } from '../repositories/triage.repository';
import { AiGatewayError } from './errors';
import { RESOLUTION_SYSTEM_PROMPT, TRIAGE_SYSTEM_PROMPT } from './prompts';
import { parseResolutionGatewayJson, parseTriageGatewayJson } from './schemas';
import type { AiGatewayResponse, AiResolutionInput, AiTicketInput, IAiGateway } from './types';

type PortkeyChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  getHeaders?: () => Record<string, string | null | undefined> | null | undefined;
  provider?: string;
  provider_used?: string;
};

export class PortkeyAiGateway implements IAiGateway {
  readonly primaryProvider: string;

  constructor(
    private readonly client = new Portkey({
      apiKey: config.PORTKEY_API_KEY,
      config: config.PORTKEY_CONFIG_ID,
    }),
    primaryProvider = config.PORTKEY_PRIMARY_PROVIDER,
  ) {
    this.primaryProvider = primaryProvider.toLowerCase();
  }

  async triageTicket(input: AiTicketInput): Promise<AiGatewayResponse<TriageResult>> {
    const response = await this.createChatCompletion([
      { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          ticket_id: input.ticketId,
          subject: input.subject,
          body: input.body,
        }),
      },
    ]);

    return this.normalize(response, parseTriageGatewayJson);
  }

  async draftResolution(input: AiResolutionInput): Promise<AiGatewayResponse<ResolutionResult>> {
    const response = await this.createChatCompletion([
      { role: 'system', content: RESOLUTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          ticket_id: input.ticketId,
          subject: input.subject,
          body: input.body,
          triage: input.triage,
        }),
      },
    ]);

    return this.normalize(response, parseResolutionGatewayJson);
  }

  private async createChatCompletion(
    messages: Array<{ role: string; content: string }>,
  ): Promise<PortkeyChatResponse> {
    try {
      return (await this.client.chat.completions.create({
        messages,
        response_format: { type: 'json_object' },
        temperature: 0,
      })) as PortkeyChatResponse;
    } catch (err) {
      throw mapPortkeyError(err);
    }
  }

  private normalize<T>(
    response: PortkeyChatResponse,
    parseResult: (content: string) => T,
  ): AiGatewayResponse<T> {
    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      throw new AiGatewayError('gateway_bad_response', 'AI gateway returned an empty response', true);
    }

    const provider = extractProvider(response);

    return {
      result: parseResult(content),
      provider,
      primaryProvider: this.primaryProvider,
      fallback: provider !== this.primaryProvider,
    };
  }
}

function extractProvider(response: PortkeyChatResponse): string {
  const headers = response.getHeaders?.() ?? {};
  const provider =
    response.provider_used ??
    response.provider ??
    headers.provider ??
    headers['provider-used'] ??
    headers['provider-name'] ??
    headers['ai-provider'];

  if (!provider) {
    throw new AiGatewayError(
      'gateway_contract_error',
      'AI gateway response did not include the handled provider',
      true,
    );
  }

  return provider.toLowerCase();
}

function mapPortkeyError(err: unknown): AiGatewayError {
  if (err instanceof AiGatewayError) return err;

  const status = typeof (err as { status?: unknown }).status === 'number' ? (err as { status: number }).status : undefined;

  if (status === 401 || status === 403) {
    return new AiGatewayError('gateway_auth_error', 'AI gateway authentication failed', false, status);
  }

  if (status === 429) {
    return new AiGatewayError('gateway_rate_limited', 'AI gateway rate limited the request', true, status);
  }

  if (status && status >= 500) {
    return new AiGatewayError('gateway_unavailable', 'AI gateway is unavailable', true, status);
  }

  const message = err instanceof Error ? err.message : String(err);
  if (message.toLowerCase().includes('timeout')) {
    return new AiGatewayError('gateway_timeout', 'AI gateway request timed out', true, status);
  }

  return new AiGatewayError('gateway_unknown_error', 'AI gateway request failed', true, status);
}
