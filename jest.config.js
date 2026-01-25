module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/**/__tests__/**/*.test.js'],
  verbose: true,
  collectCoverageFrom: [
    'src/main/**/*.js',
    '!**/bundle.js',
    '!**/__tests__/**'
  ]
};
