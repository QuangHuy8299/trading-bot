// tests/setup.ts
// Jest test setup

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = '123456789';
process.env.TELEGRAM_ADMIN_IDS = '123456789';
process.env.BINANCE_API_KEY = 'test-api-key';
process.env.BINANCE_API_SECRET = 'test-api-secret';
process.env.BINANCE_TESTNET = 'true';
process.env.EXECUTION_ENABLED = 'false';
process.env.AUTO_PROTECT_GLOBALLY_ENABLED = 'false';
process.env.REDIS_URL = 'redis://localhost:6379';

// Global test utilities
global.console = {
  ...console,
  // Suppress console output during tests (uncomment to enable)
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});
