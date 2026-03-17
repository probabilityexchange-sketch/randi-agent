# Code Standards

This document defines the coding standards and style guidelines for the Randi Agent Platform.

## Formatting

- Use `npm run format` to format code
- Use `npm run format:check` to verify formatting without changes
- Use `npm run lint` to check for linting errors
- Use `npm run lint:fix` to auto-fix linting errors
- Pre-commit hooks will automatically format and lint staged files

## TypeScript Guidelines

### Type Safety
- Use strict mode (enabled in tsconfig.json)
- Avoid `any` type; use `unknown` if necessary
- Export types and interfaces for public APIs
- Use interfaces for object shapes, types for unions

### Code Style
- Use `const` over `let` where possible
- Use arrow functions for callbacks and handlers
- Prefer async/await over promise chains
- Use template literals for string interpolation

### Naming Conventions
- Use PascalCase for types, interfaces, and components
- Use camelCase for variables, functions, and methods
- Use UPPER_CASE for constants
- Use kebab-case for file names

## Testing Standards

- Place tests next to the files they test
- Name test files: `*.test.ts` or `*.spec.ts`
- Use describe blocks to group related tests
- Write descriptive test names that explain the expected behavior
- Aim for >70% coverage on critical paths

## Documentation

- Add JSDoc comments to exported functions and types
- Include usage examples for complex APIs
- Keep inline comments focused on "why" not "what"
