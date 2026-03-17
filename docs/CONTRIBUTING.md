# Contributing to Randi Agent Platform

Thank you for your interest in contributing! This guide will help you get started.

## Getting Started

### Prerequisites
- Node.js 20+
- Docker (running)
- Git

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Randi-Agent/agent-platform.git
   cd agent-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your credentials
   ```

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## Development Workflow

### Code Quality

Before committing, ensure your code passes all checks:

```bash
# Format code
npm run format

# Run linter
npm run lint

# Run tests
npm run test
```

### Pre-commit Hooks

Pre-commit hooks are configured to automatically:
- Format staged files with Prettier
- Lint staged files with ESLint

If a hook fails, fix the issues and re-stage your files.

### Branch Naming

Use descriptive branch names:
- `feature/add-new-feature`
- `fix/resolve-bug-description`
- `docs/update-readme`
- `refactor/improve-performance`

### Commit Messages

Follow conventional commits:
```
feat: add new payment integration
fix: resolve wallet connection timeout
docs: update API documentation
refactor: simplify authentication flow
test: add unit tests for credit estimator
```

## Pull Request Process

1. **Create a branch** from `main`
2. **Make your changes** following the code standards
3. **Write tests** for new functionality
4. **Update documentation** as needed
5. **Run all checks** locally before pushing
6. **Create a PR** with a clear description
7. **Address review feedback** promptly

### PR Requirements

- [ ] Code is formatted (`npm run format`)
- [ ] Linter passes (`npm run lint`)
- [ ] Tests pass (`npm run test`)
- [ ] Documentation is updated
- [ ] Changes are tested locally

## Reporting Issues

- Use the appropriate issue template
- Provide clear reproduction steps
- Include relevant error messages and logs
- Specify your environment (Node version, OS, browser)

## Questions?

- Check existing documentation in `/docs`
- Search existing issues
- Ask in the project discussions
