# Frontend Architecture

## Directory Responsibilities

- `src/app`: app-level shell, e.g. global navigation and global entry components.
- `src/views`: route pages. They only assemble feature capabilities — no complex business logic here.
- `src/shared`: cross-cutting capabilities reused across business modules. This is where base UI, generic composables, the HTTP client, formatting utilities, and global type declarations live.
- `src/features/<module>`: business modules. Each module is further split into `api`, `components`, `composables`, `services`, `utils`, `types`, `constants` as needed.
- `src/router`: route declarations and route guards.
- `src/workers`: Web Worker entry points.

## Dependency Direction

- `shared` never depends on any `features` module.
- `features` may depend on `shared`, but should not casually reach into another feature's internal files.
- Page components may reference multiple features to compose business flows.
- Within a feature, components should prefer the module's own `composables`, `services`, and `api` rather than piling requests, formatting, and side effects into template components.

## State Boundaries

- Local interaction state (modal open/close, transient input values) lives in the component itself.
- State reused across a page or module goes into a feature composable.
- Truly global state, like authentication, lives in a feature store — e.g. `features/auth/stores/authStore.ts`.
- Server data is owned by `api` and business composables; it isn't dumped directly into a global store.

## Automated Constraints

- `npm run type-check`: TypeScript / Vue type checking.
- `npm run lint:check`: checks code style and directory import boundaries.
- `npm run format:check`: checks Prettier formatting.
- `npm run check`: runs type-check, lint, and unit tests in parallel.

ESLint blocks imports from the old root-level aliases, e.g. `@/utils/*`, `@/components/*`.
New shared code goes in `shared`; new business code goes in the matching `features` module.
