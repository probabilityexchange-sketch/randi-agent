# End-to-End Tests

This directory contains Playwright end-to-end tests for the Randi Agent Platform.

## Running Tests

```bash
# Run all tests
npm run test:e2e

# Run tests with UI
npx playwright test --ui

# Run specific test file
npx playwright test e2e/example.spec.ts

# Run tests in headed mode (visible browser)
npx playwright test --headed
```

## Writing Tests

See `example.spec.ts` for a test template.

## Test Structure

- `example.spec.ts` - Example test template
- `*.spec.ts` - Test files
