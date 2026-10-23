import { defineConfig } from 'orval';

// Generates the committed Angular client from the committed spec (ADR 0004). Runs on npm prestart/prebuild.
export default defineConfig({
  api: {
    input: '../backend/openapi.json',
    output: {
      target: 'src/app/api/generated/api.ts',
      schemas: 'src/app/api/generated/model',
      mode: 'tags-split',
      client: 'angular',
      clean: true,
      override: {
        angular: { retrievalClient: 'both' },
      },
    },
  },
});
