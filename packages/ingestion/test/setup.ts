import { beforeAll, afterAll, vi } from 'vitest';

// Global mocks
vi.mock('node-fetch');

beforeAll(() => {
  console.log('🧪 Ingestion tests initialized for #110');
});

afterAll(() => {
  vi.clearAllMocks();
});