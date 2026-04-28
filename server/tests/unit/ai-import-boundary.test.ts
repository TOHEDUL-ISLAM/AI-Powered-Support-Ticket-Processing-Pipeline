// US-3.1: codebase inspection test ensuring Portkey imports stay inside src/ai
import { execFileSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

const SERVER_ROOT = path.resolve(__dirname, '../..');

describe('AI provider import boundary', () => {
  it('only imports portkey-ai from src/ai', () => {
    let output: string;
    try {
      output = execFileSync(
        'grep',
        ['-rn', '--include=*.ts', "from 'portkey-ai'\\|from \"portkey-ai\"\\|require('portkey-ai')\\|require(\"portkey-ai\")", 'src'],
        { cwd: SERVER_ROOT, encoding: 'utf8' },
      );
    } catch (err) {
      // grep exits 1 when no matches found — that would mean no portkey-ai imports at all
      const exitCode = (err as NodeJS.ErrnoException & { status?: number }).status;
      if (exitCode === 1) {
        throw new Error('No portkey-ai imports found anywhere in src/ — expected at least one in src/ai/');
      }
      throw err;
    }

    const matches = output
      .split('\n')
      .filter(Boolean)
      .map((line) => line.split(':')[0]);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((filePath) => filePath.startsWith('src/ai/'))).toBe(true);
  });
});
