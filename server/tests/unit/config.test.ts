// US-1.4: config module unit tests — subprocess-based to test process.exit behaviour
import { spawnSync } from 'child_process';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

const ROOT = path.resolve(__dirname, '../..');
const CONFIG_ENTRY = path.join(ROOT, 'src/config/index.ts');
const TSX_BIN = path.join(ROOT, 'node_modules/.bin/tsx');

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: '3000',
  LOG_LEVEL: 'info',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
  AWS_REGION: 'us-east-1',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  SQS_PHASE1_QUEUE_URL: 'http://localhost:4566/000000000000/phase1Queue',
  SQS_PHASE2_QUEUE_URL: 'http://localhost:4566/000000000000/phase2Queue',
  SQS_PHASE1_DLQ_URL: 'http://localhost:4566/000000000000/phase1DLQ',
  SQS_PHASE2_DLQ_URL: 'http://localhost:4566/000000000000/phase2DLQ',
  PORTKEY_API_KEY: 'pk-test-key',
  PORTKEY_CONFIG_ID: 'pc-test-id',
  PORTKEY_PRIMARY_PROVIDER: 'openrouter',
};

function runConfig(env: NodeJS.ProcessEnv) {
  return spawnSync(TSX_BIN, [CONFIG_ENTRY], {
    env,
    encoding: 'utf8',
    cwd: path.join(ROOT, 'tests'),
  });
}

describe('config module', () => {
  it('exits 0 with a fully valid environment', () => {
    const result = runConfig(VALID_ENV);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('exits 1 and names DATABASE_URL when it is missing', () => {
    const envWithout = { ...VALID_ENV };
    delete envWithout.DATABASE_URL;
    const result = runConfig(envWithout);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('DATABASE_URL');
  });

  it('exits 1 and names PORTKEY_API_KEY when it is missing', () => {
    const envWithout = { ...VALID_ENV };
    delete envWithout.PORTKEY_API_KEY;
    const result = runConfig(envWithout);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PORTKEY_API_KEY');
  });

  it('exits 1 and names PORTKEY_PRIMARY_PROVIDER when it is missing', () => {
    const envWithout = { ...VALID_ENV };
    delete envWithout.PORTKEY_PRIMARY_PROVIDER;
    const result = runConfig(envWithout);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('PORTKEY_PRIMARY_PROVIDER');
  });

  it('does not print the value of a missing secret in stderr', () => {
    const env = { ...VALID_ENV, DATABASE_URL: 'not-a-url' };
    const result = runConfig(env);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('not-a-url');
  });

  it('accepts optional LOCALSTACK_ENDPOINT when present', () => {
    const env = { ...VALID_ENV, LOCALSTACK_ENDPOINT: 'http://localhost:4566' };
    const result = runConfig(env);
    expect(result.status).toBe(0);
  });

  it('exits 0 when LOCALSTACK_ENDPOINT is absent (it is optional)', () => {
    const result = runConfig(VALID_ENV);
    expect(result.status).toBe(0);
  });
});
