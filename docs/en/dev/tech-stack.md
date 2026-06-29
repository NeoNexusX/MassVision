# Tech Stack

This page is for contributors. It summarizes the actual tech stack, directory layout, and dev scripts used by the SpatialXomics frontend. For the business/module dependency boundaries, see [Frontend Architecture](./frontend-architecture).

## 1. Requirements

- Node.js `^20.19.0` or `>=22.12.0`
- Package manager: npm (the repo commits `package-lock.json`)

```bash
npm install
npm run dev   # starts both the SPA (5173) and the docs site (5174)
```

## 2. Core Dependencies

| Category | Dependency | Purpose |
|---|---|---|
| Core framework | Vue 3 + TypeScript | Composition API, SFCs, static typing |
| Build tool | Vite 7 + `@tailwindcss/vite` | Dev server, production build |
| State | Pinia | Global/cross-component state per feature (e.g. `authStore`) |
| Routing | Vue Router | History mode + route guards |
| UI | Tailwind CSS v4 + DaisyUI v5 + Iconify (offline-bundled, see [Icon Guidelines](./icon-guidelines)) | Utility-first styling and components |
| Charts | ECharts, vue3-calendar-heatmap | Stat charts, commit heatmap |
| MSI data | zarrita (Zarr reader), fflate / zstddec (decompression), hash-wasm (file hashing) | Parsing and verifying imzML-derived imaging data |
| Object storage | ali-oss | Alibaba Cloud OSS multipart upload / pre-signed download URLs |
| HTTP | Axios + qs | HTTP client and query-string serialization |
| Crypto | crypto-js | Client-side processing (e.g. password handling before transmission) |
| Region data | i18n-iso-countries | Country/region options in the user profile |
| Docs site | VitePress | Bilingual docs under `docs/`, same repo as the SPA — see [Documentation Maintenance](./doc-maintenance) |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Linting | ESLint 9 (flat config) + Prettier | |

See `package.json` at the repo root for exact version pins.

## 3. Project Structure

```
src/
├── app/components/        # App-level shell components (Navbar, NavDrawer, NavFab)
├── assets/                # Tailwind/DaisyUI theme styles
├── features/              # Modules organized by business domain
│   ├── assistant/         # Floating AI assistant
│   ├── auth/               # Login/register/forgot-password, authStore
│   ├── datasets/            # Dataset browsing, filtering, download
│   ├── home/                # Homepage (stats, commit heatmap)
│   ├── upload/               # imzML upload (compression/hashing/OSS multipart/resume)
│   ├── users/                 # User management (admin panel)
│   └── workspace/             # Analysis workspace
│       ├── analysis/          # Analysis builder (data sources, preprocessing pipelines)
│       ├── dashboard/          # Task/result/activity dashboard
│       └── results/           # Result visualization (ion image/spectrum/ROI/UMAP-KMeans)
├── router/                     # Route declarations and guards
├── services/                    # Cross-feature services (OSS client, remote Zarr access)
├── shared/                       # Reuse layer with no dependency on any feature (api/components/composables/utils/types)
├── views/                         # Route pages that compose feature capabilities
├── workers/                        # Web Workers (imzML compression and other heavy tasks)
└── main.ts / App.vue
```

Each `features/<module>` is further split into `api`, `components`, `composables`, `services`, `stores`, `types`, `utils`. Dependency direction and boundary rules are covered in [Frontend Architecture](./frontend-architecture).

## 4. Common Scripts (see package.json)

| Command | Purpose |
|---|---|
| `npm run dev` | Runs the SPA (`vite`, 5173) and docs site (`vitepress dev`, 5174) in parallel |
| `npm run dev:app` | SPA only |
| `npm run build` | `type-check` + `vite build`, output to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run type-check` | `vue-tsc --build` |
| `npm run lint` / `lint:check` | ESLint with autofix / check-only (includes the directory import-boundary rule) |
| `npm run format` / `format:check` | Prettier format `src/` / check-only |
| `npm run test:unit` | Vitest unit tests (watch mode) |
| `npm run test:unit:run` | Vitest single run (used in CI, `--passWithNoTests`) |
| `npm run test:e2e` | Playwright E2E (requires `build` + `preview` first) |
| `npm run check` | Runs `type-check` + `lint:check` + `test:unit:run` in parallel — used in CI and before sending a PR |
| `npm run docs:dev` / `docs:build` / `docs:preview` | Docs dev/build/preview — see [Documentation Maintenance](./doc-maintenance) |

## 5. CI/CD & Deployment

- **Tests** (`.github/workflows/test.yml`): PRs trigger `npm run check`; a separate job runs `npm run build` + `playwright install` + `npm run test:e2e`, uploading the Playwright report on failure.
- **Deploy** (`deploy-dev.yml` / `deploy-main.yml`): `npm ci` → `npm run check` → build and push a Docker image → deploy to the target server over SSH.
- **Docker**: `docker/Dockerfile` is a multi-stage build that copies both the SPA's `dist/` and the docs site's `dist-docs/` into the nginx image; `docker/nginx.conf.template`'s `location /docs/` must stay in sync with VitePress's `base: '/docs/'`.

## 6. Other Conventions

- Auth uses backend-issued JWTs; the frontend never stores password hashes — `crypto-js` only processes the password client-side before it's sent. Password recovery goes through an email verification code (see `src/features/auth/composables/useForgotPassword.ts`).
- Route-level lazy loading and history-mode fallback are already handled by `vite.config.ts` / `vue-router` and `nginx.conf.template` — no manual `try_files` setup needed.
- Before adding a new dependency or import, check the `shared`/`features` boundary (see [Frontend Architecture](./frontend-architecture)) to avoid circular or out-of-bounds references.
