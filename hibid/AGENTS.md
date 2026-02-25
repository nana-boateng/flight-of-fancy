# AGENTS.md - Development Guidelines

This project uses **Bun** as the runtime and package manager.

## Build / Run / Test Commands

```bash
# Run the main application
bun run index.ts

# Run a single test file
bun test run <test-file-path>

# Run a specific test by name
bun test run <test-file-path> -t "test name"

# Run all tests
bun test

# Add a script to package.json
bun pkg add script
```

## Project Structure

```
/root/hibid/
├── src/              # Source code
├── test/             # Test files (*.test.ts)
├── index.ts          # Entry point
├── package.json      # Dependencies
└── tsconfig.json     # TypeScript config
```

## Code Style Guidelines

### General

- Use **Bun** for all operations (not npm/yarn/pnpm)
- Use **bun:sqlite** for SQLite, **Bun.sql** for PostgreSQL
- Use **Bun.serve()** for HTTP servers (not express)
- Use built-in **WebSocket** (not ws)
- **bun test** for testing (not jest/vitest)

### TypeScript

- Strict mode is enabled in tsconfig.json
- Use explicit return types for exported functions
- Enable `noUncheckedIndexedAccess` - always check array bounds
- Use `noImplicitOverride` for class methods

### Naming Conventions

- **Files**: kebab-case (`user-service.ts`)
- **Classes**: PascalCase (`UserService`)
- **Functions/variables**: camelCase (`getUserById`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Interfaces**: PascalCase with `I` prefix optional (`User` not `IUser`)

### Imports

- Use path aliases if configured
- Import types with `import type { ... }` when only using types
- Use `bun:test` for test imports

### Error Handling

- Use try/catch with specific error types
- Never silently swallow errors
- Return typed results (Result<T, E>) for operations that can fail
- Log errors with appropriate context

### Testing

- Test files: `*.test.ts` in `/test` directory
- Use `bun:test` assertions
- Group related tests with `describe()`
- Use descriptive test names: "should return user when valid id provided"

### Formatting

- 2 spaces for indentation
- Single quotes for strings
- Trailing commas
- Semicolons required
- Max line length: 100

### Security

- Never commit secrets/keys to repository
- Use environment variables for sensitive data
- Validate all external input
- Sanitize data before displaying

## Adding Dependencies

```bash
# Add runtime dependency
bun add <package>

# Add dev dependency
bun add -d <package>

# Add types
bun add -d @types/<package>
```

## Environment

- Bun automatically loads `.env` files
- Use `Bun.env` to access environment variables
