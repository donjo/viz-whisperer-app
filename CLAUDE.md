# Deno Development Best Practices

## Package Management
- Use `deno add` to add dependencies (not `deno install`)
- Prefer JSR (JavaScript Registry) packages when available: `deno add @std/assert`
- For npm packages, use the `npm:` prefix: `deno add npm:express`
- Manage all dependencies in `deno.json` imports field for centralization
- Use `deno.lock` for dependency integrity

## Module Imports
- Always include full file extensions in local imports (e.g., `./utils.ts` not `./utils`)
- Use ECMAScript modules exclusively
- Centralize third-party imports in `deno.json`:
  ```json
  {
    "imports": {
      "@std/assert": "jsr:@std/assert@^1.0.0",
      "lodash": "npm:lodash@^4.17.21"
    }
  }
  ```

## Development Workflow
- Use `deno task` for running scripts defined in `deno.json`
- Leverage built-in TypeScript support without configuration
- Use built-in tools:
  - `deno fmt` for code formatting
  - `deno lint` for linting
  - `deno test` for testing
  - `deno check` for type checking

## Configuration (deno.json)
- Keep configuration minimal, leverage Deno defaults
- Define tasks for common operations:
  ```json
  {
    "tasks": {
      "dev": "deno run --watch --allow-net --allow-read --allow-env main.ts",
      "test": "deno test --allow-net",
      "build": "deno compile --allow-net --allow-read main.ts"
    }
  }
  ```

## Security Best Practices
- Run with minimal permissions, add only what's needed
- Common permission flags:
  - `--allow-net` for network access
  - `--allow-read` for file system reads
  - `--allow-write` for file system writes
  - `--allow-env` for environment variables
  - `--allow-run` for subprocess execution

## Standard Library Usage
- Prefer Deno's standard library over third-party alternatives
- Common std modules:
  - `@std/path` for path operations
  - `@std/fs` for file system operations
  - `@std/http` for HTTP utilities
  - `@std/testing` for test utilities

## Performance Tips
- Use `--cached-only` flag for offline development
- Leverage `deno compile` for creating executables
- Use `--watch` flag during development for auto-reload

## Project-Specific Instructions
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.