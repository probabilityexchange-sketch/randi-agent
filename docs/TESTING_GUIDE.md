# Testing Guide

This guide outlines the testing strategy and best practices for the Randi Agent Platform.

## Test Frameworks

### Unit Testing (Vitest)
- Used for unit tests and integration tests
- Located in `src/**/*.test.ts` or `src/**/*.spec.ts`
- Run with `npm run test`

### End-to-End Testing (Playwright)
- Used for browser-based E2E tests
- Located in `e2e/**/*.spec.ts`
- Run with `npm run test:e2e`

## Writing Unit Tests

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('FunctionName', () => {
  describe('when valid input', () => {
    it('should return expected output', () => {
      // Arrange
      const input = 'test';
      
      // Act
      const result = functionName(input);
      
      // Assert
      expect(result).toBe('expected');
    });
  });
  
  describe('when invalid input', () => {
    it('should throw an error', () => {
      // Arrange
      const input = null;
      
      // Act & Assert
      expect(() => functionName(input)).toThrow();
    });
  });
});
```

### Best Practices
- Test one thing per test case
- Use descriptive test names
- Follow Arrange-Act-Assert pattern
- Mock external dependencies
- Test edge cases and error conditions

## Running Tests

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## Coverage Requirements

- Lines: 70%
- Functions: 70%
- Branches: 70%
- Statements: 70%

## CI/CD Integration

Tests are automatically run on:
- Every pull request
- Every push to main branch
- Before deployment
