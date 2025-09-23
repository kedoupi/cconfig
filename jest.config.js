module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js',
  ],

  // Test setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],

  // Coverage configuration
  collectCoverage: false, // Enable with --coverage flag
  collectCoverageFrom: [
    'bin/**/*.js',
    'lib/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Module configuration
  moduleFileExtensions: ['js', 'json'],
  moduleDirectories: ['node_modules', 'src'],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: false,

  // Transform configuration
  transform: {},

  // Global setup/teardown
  globalSetup: undefined,
  globalTeardown: undefined,

  // Test result processor
  testResultsProcessor: undefined,

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Notify mode
  notify: false,
  notifyMode: 'failure-change',

  // Watch plugins
  watchPlugins: [],
};
