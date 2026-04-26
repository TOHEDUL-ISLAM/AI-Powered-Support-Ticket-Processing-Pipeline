// US-2.1: extend Express Request with request-id field set in app middleware
declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}
export {};

