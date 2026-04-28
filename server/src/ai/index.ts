// US-3.1 + US-3.2 + US-4.1: public AI gateway boundary exports
export { AiGatewayError } from './errors';
export type { AiGatewayErrorCode } from './errors';
export { PortkeyAiGateway } from './portkey.gateway';
export { RESOLUTION_SYSTEM_PROMPT, TRIAGE_SYSTEM_PROMPT } from './prompts';
export {
  ResolutionGatewayResponseSchema,
  TriageGatewayResponseSchema,
  parseResolutionGatewayJson,
  parseTriageGatewayJson,
} from './schemas';
export type { AiGatewayResponse, AiResolutionInput, AiTicketInput, IAiGateway } from './types';
