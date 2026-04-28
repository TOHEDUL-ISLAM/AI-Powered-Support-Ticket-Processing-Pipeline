// US-3.1 + US-3.2: standard AI gateway interface shared by all processing steps
import type { ResolutionResult } from '../repositories/resolution.repository';
import type { TriageResult } from '../repositories/triage.repository';

export interface AiTicketInput {
  ticketId: string;
  subject: string;
  body: string;
}

export interface AiResolutionInput extends AiTicketInput {
  triage: Record<string, unknown>;
}

export interface AiGatewayResponse<T> {
  result: T;
  provider: string;
  primaryProvider: string;
  fallback: boolean;
}

export interface IAiGateway {
  readonly primaryProvider: string;
  triageTicket(input: AiTicketInput): Promise<AiGatewayResponse<TriageResult>>;
  draftResolution(input: AiResolutionInput): Promise<AiGatewayResponse<ResolutionResult>>;
}
