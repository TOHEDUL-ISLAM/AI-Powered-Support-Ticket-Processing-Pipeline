// US-1.1: Vitest config — TypeScript native, no ts-jest needed
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      include: [
        'src/ai/**/*.ts',
        'src/controllers/**/*.ts',
        'src/queue/**/*.ts',
        'src/repositories/**/*.ts',
        'src/schemas/**/*.ts',
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/workers/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/types.ts',
        'src/**/.gitkeep',
        'src/bootstrap.ts',
        'src/server.ts',
        'src/migrations/**',
        'dist/**',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
