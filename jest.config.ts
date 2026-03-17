import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testTimeout: 30000, // MongoMemoryServer can take time to start
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        // Allow running tests without strict mode to simplify test setup
        strict: false,
      },
    }],
  },
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // Ignore Next.js build output
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

export default config;
