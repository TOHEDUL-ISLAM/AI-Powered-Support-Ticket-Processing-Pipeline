// US-3.1 + US-3.2: typed AI gateway errors for worker retry decisions
export type AiGatewayErrorCode =
  | 'gateway_bad_response'
  | 'gateway_contract_error'
  | 'gateway_auth_error'
  | 'gateway_rate_limited'
  | 'gateway_timeout'
  | 'gateway_unavailable'
  | 'gateway_unknown_error';

export class AiGatewayError extends Error {
  constructor(
    readonly code: AiGatewayErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'AiGatewayError';
  }
}
