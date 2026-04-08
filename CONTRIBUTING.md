# Contributing to TerraMind Core

Thank you for your interest in contributing to TerraMind Core! This guide will help you get started.

## Getting Started

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/YOUR_USERNAME/terramind-core.git`
3. **Install** dependencies: `pnpm install`
4. **Copy** the environment file: `cp .env.example .env`
5. **Start** the dev server: `pnpm dev`

## Development Workflow

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation updates

### Code Style

- TypeScript strict mode is enforced
- Use `const` over `let` where possible
- All API clients must support dependency injection for testing
- Frontend uses vanilla CSS custom properties — no CSS frameworks

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch
```

### Pull Request Process

1. Create a branch from `main`
2. Make your changes with clear commit messages
3. Ensure all tests pass
4. Update documentation if needed
5. Submit a pull request with a description of your changes

## Adding a New Data Source

TerraMind is designed to support additional data sources. To add a new one:

1. **Create a client** in `src/clients/` (see `usgs.ts` as a template)
   - Support dependency injection for `AxiosInstance`
   - Add timeout and error handling
2. **Add normalization** in `src/pipeline/normalizer.ts`
   - Map to `GlobalDisasterEvent` schema
   - Implement severity classification
3. **Register in server** in `src/api/server.ts`
   - Add to `fetchAllEvents()` function
   - Include in source health tracking
4. **Add tests** in `tests/clients.test.ts`
   - Mock HTTP responses
   - Test normalization output
5. **Update Swagger spec** in `src/api/swagger.ts`

## Reporting Issues

Please include:
- Node.js version (`node --version`)
- Operating system
- Steps to reproduce
- Expected vs actual behavior
- Any error messages or console output

## Code of Conduct

Be respectful, constructive, and supportive. We're building tools that help people during disasters — let's maintain that spirit in our interactions.
