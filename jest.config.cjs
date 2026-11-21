module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.[tj]s$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', decorators: true },
          transform: { legacyDecorator: true, decoratorMetadata: true },
        },
        module: { type: 'commonjs' },
      },
    ],
  },
  transformIgnorePatterns: [],
  moduleFileExtensions: ['js', 'json', 'ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@fs/cms-contracts$': '<rootDir>/../packages/cms-contracts/src/index.ts',
  },
  setupFiles: ['<rootDir>/test/setup.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
};
