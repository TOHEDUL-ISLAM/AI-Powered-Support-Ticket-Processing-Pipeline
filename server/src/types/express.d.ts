// US-1.7: Express request extensions used by middleware
declare namespace Express {
  export interface Request {
    id?: string;
  }
}

