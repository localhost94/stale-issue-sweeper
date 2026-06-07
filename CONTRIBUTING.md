# Contributing to Stale Issue Sweeper

Thank you for considering contributing to Stale Issue Sweeper! We welcome
contributions of all kinds: bug reports, feature requests, documentation
improvements, and code changes.

## Table of Contents

- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Code of Conduct](#code-of-conduct)

---

## Development Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/localhost94/stale-issue-sweeper.git
   cd stale-issue-sweeper
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up environment variables:**

   Copy `.env.example` to `.env` and fill in your GitHub App credentials:

   ```bash
   cp .env.example .env
   ```

4. **Run tests:**

   ```bash
   npm test
   ```

5. **Run the app in development mode:**

   ```bash
   npm run dev
   ```

## Coding Standards

- **Language:** TypeScript with strict mode enabled.
- **Module system:** ES modules (`type: "module"` in `package.json`).
- **Imports:** Use explicit `.js` extensions for relative imports (per NodeNext module resolution).
- **Formatting:** Use Prettier with the following settings:
  - Single quotes
  - Print width: 90
  - Trailing commas: all
- **Linting:** Run `npm run lint` (TypeScript compiler check) before committing.
- **Naming:**
  - Classes: PascalCase
  - Functions/variables: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case (e.g., `commit-diff.ts`)
- **Documentation:** All exported functions and classes must have JSDoc/TSDoc comments.

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`.

Examples:

- `feat(analyzer): add OpenAI LLM provider support`
- `fix(sweeper): handle pagination edge case in scanRepo`
- `docs: update README with new configuration options`

## Pull Request Process

1. Fork the repository and create your branch from `main`.
2. If you're adding code, add or update tests as needed.
3. Ensure all tests pass (`npm test`).
4. Ensure the TypeScript linter passes (`npm run lint`).
5. Update the README and documentation if your changes affect the user-facing
   behavior.
6. Submit a pull request with a clear description of the changes and the
   problem they solve.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md) v2.1.
By participating, you are expected to uphold this code. Please report
unacceptable behavior to the project maintainers.
