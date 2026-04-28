// US-7.1: logger contract tests for structured JSON, base fields, levels, and redaction
import { Writable } from 'stream';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../src/logger';

describe('createLogger', () => {
  it('writes parseable JSON with base service context', () => {
    const stream = new CaptureStream();
    const logger = createLogger({ destination: stream, pretty: false });

    logger.info({ event: 'logger.test' });

    const entry = stream.lastJson();
    expect(entry.event).toBe('logger.test');
    expect(entry.service).toBe('ai-ticket-pipeline');
    expect(entry.environment).toBe('test');
    expect(entry.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('redacts sensitive fields from log output', () => {
    const stream = new CaptureStream();
    const logger = createLogger({ destination: stream, pretty: false });

    logger.info({
      event: 'logger.redaction_test',
      password: 'secret-password',
      apiKey: 'secret-api-key',
      authorization: 'Bearer secret-token',
      PORTKEY_API_KEY: 'secret-portkey',
      DATABASE_URL: 'postgres://user:pass@localhost:5432/db',
    });

    const rawOutput = stream.output();
    expect(rawOutput).toContain('[Redacted]');
    expect(rawOutput).not.toContain('secret-password');
    expect(rawOutput).not.toContain('secret-api-key');
    expect(rawOutput).not.toContain('secret-token');
    expect(rawOutput).not.toContain('secret-portkey');
    expect(rawOutput).not.toContain('postgres://user:pass@localhost:5432/db');
  });

  it('respects log level configuration passed to the factory', () => {
    const stream = new CaptureStream();
    const logger = createLogger({ destination: stream, level: 'info', pretty: false });

    logger.debug({ event: 'logger.debug_suppressed' });
    logger.info({ event: 'logger.info_written' });

    const rawOutput = stream.output();
    expect(rawOutput).not.toContain('logger.debug_suppressed');
    expect(rawOutput).toContain('logger.info_written');
  });
});

class CaptureStream extends Writable {
  private readonly chunks: string[] = [];

  _write(chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.chunks.push(chunk.toString('utf8'));
    callback();
  }

  output(): string {
    return this.chunks.join('');
  }

  lastJson(): Record<string, unknown> {
    const lines = this.output()
      .trim()
      .split('\n')
      .filter(Boolean);
    return JSON.parse(lines[lines.length - 1]) as Record<string, unknown>;
  }
}
