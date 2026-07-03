# SpatialXomics

English | [简体中文](README.md)

SpatialXomics is a mass spectrometry imaging (MSI) data management and analysis platform built with Vue 3, TypeScript, and Vite. It supports imzML dataset upload, browsing, visualization, and user permission management.

## Tech Stack

- **Core Framework**: [Vue 3](https://vuejs.org/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) + [Tailwind CSS v4](https://tailwindcss.com/)
- **State Management**: [Pinia](https://pinia.vuejs.org/)
- **Routing**: [Vue Router](https://router.vuejs.org/)
- **UI Components**: [DaisyUI v5](https://daisyui.com/) + [Heroicons](https://heroicons.com/) + [Iconify](https://iconify.design/)
- **Charts & Visualization**: [ECharts](https://echarts.apache.org/) + [vue3-calendar-heatmap](https://github.com/IhsenBouallegue/vue3-calendar-heatmap) (GitHub commit heatmap)
- **MSI Data Parsing**: [zarrita](https://github.com/manzt/zarrita) (Zarr format reader), @zip.js/zip.js (upload zip packaging), zstddec (zstd decompression), hash-wasm (WebAssembly hashing)
- **Object Storage**: [ali-oss](https://github.com/ali-sdk/ali-oss) (Alibaba Cloud OSS)
- **HTTP Client**: [Axios](https://axios-http.com/) + [qs](https://github.com/ljharb/qs)
- **Encryption**: [Crypto-JS](https://github.com/brix/crypto-js)
- **Region Data**: [i18n-iso-countries](https://github.com/michaelwittig/node-i18n-iso-countries) (country/region lists)
- **Testing**: [Vitest](https://vitest.dev/) (unit tests) + [Playwright](https://playwright.dev/) (E2E tests)
- **Code Quality**: ESLint + Prettier

## Project Structure

```
SpatialXomics/
├── public/                          # Static assets (runtime config.json)
├── src/
│   ├── app/components/              # App-level components (Navbar, NavDrawer)
│   ├── assets/                      # CSS assets (Tailwind/DaisyUI theme)
│   ├── features/                    # Feature-based modules
│   │   ├── assistant/               # Floating AI assistant
│   │   ├── auth/                    # Authentication (login/register/store/API)
│   │   ├── datasets/                # Dataset browsing & management (list/detail/filter/download)
│   │   ├── home/                    # Homepage (Hero/Features/Stats/commit heatmap)
│   │   ├── upload/                  # imzML upload (file selection/compression/resumable upload/OSS)
│   │   ├── users/                   # User management (admin panel/user list/roles)
│   │   └── workspace/               # Workspace & analysis
│   │       ├── analysis/            # Analysis builder (data sources/preprocessing pipelines)
│   │       ├── dashboard/           # Workspace dashboard (tasks/results/activity)
│   │       └── results/             # Result visualization (ion images/spectra/ROI/UMAP)
│   ├── router/                      # Vue Router configuration (incl. route guards)
│   ├── services/                    # Cross-feature services (OSS client, remote Zarr access)
│   ├── shared/                      # Shared modules
│   │   ├── api/                     # HTTP client (Axios wrapper)
│   │   ├── components/              # Common components (IconInput, PaginationBar, Toast, etc.)
│   │   ├── composables/             # Shared composables
│   │   ├── config/                  # App configuration
│   │   ├── constants/                # Constants
│   │   ├── directives/              # Custom directives (scroll reveal, etc.)
│   │   ├── types/                   # Type declarations
│   │   └── utils/                   # Utility functions
│   ├── views/                       # Page views
│   │   └── workspace/               # Workspace pages (WorkspacePage, NewAnalysis, ResultDetail, TaskDetail)
│   ├── workers/                     # Web Workers (ZIP compression)
│   ├── App.vue                      # Root component
│   ├── main.ts                      # Entry point
│   └── style.css                    # Global styles
├── env/                              # Per-environment .env files
├── docker/                           # Docker deployment config (Dockerfile/nginx/entrypoint)
├── docs/                             # Project documentation
├── e2e/                              # E2E test files
├── index.html                       # Entry HTML
├── package.json                     # Project dependencies & scripts
├── vite.config.ts                   # Vite config (incl. API proxy)
├── vitest.config.ts                 # Vitest config
└── playwright.config.ts             # Playwright config
```

## Getting Started

### Requirements

- Node.js ^20.19.0 or >=22.12.0

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create an `.env` file for the relevant mode (e.g. `.env.development`) inside the `env/` directory and set the backend address:

```bash
VITE_BACKEND_URL=http://localhost:8000
```

### Run in Development Mode

```bash
npm run dev
```

The dev server runs on `http://localhost:5173` by default; `/api` requests are automatically proxied to the backend specified by `VITE_BACKEND_URL`.

### Build for Production

```bash
npm run build
```

## Testing

```bash
# Run unit tests
npm run test:unit

# Run E2E tests
npm run test:e2e
```

## Linting & Formatting

```bash
# Lint and auto-fix with ESLint
npm run lint

# Format with Prettier
npm run format
```

## Documentation Site

The project ships a bilingual [VitePress](https://vitepress.dev/) docs site, with sources under `docs/`, sharing the same repo and deployment pipeline:

```bash
npm run docs:dev      # docs site only, defaults to http://localhost:5174/docs/
npm run docs:build    # builds to dist-docs/ at the repo root
```

See [docs/en/dev/doc-maintenance.md](docs/en/dev/doc-maintenance.md) for details.

## Deployment

The project ships with Docker deployment configuration (`docker/Dockerfile`, `nginx.conf.template`, `entrypoint.sh`) and GitHub Actions workflows (`.github/workflows/`) for automated testing and dev/production deployment.

## Features

- **Authentication**: JWT login/registration, profile management, route guards and permission control
- **Dataset Management**: Public dataset browsing, personal dataset management, detail view and download
- **imzML Upload**: imzML file parsing, client-side compression, resumable uploads, multipart upload to Alibaba Cloud OSS
- **Analysis Workspace**: Create analysis tasks, configure data sources and preprocessing pipelines, track task status
- **Result Visualization**: Ion image rendering, mass spectrum display, ROI analysis, UMAP/k-means cluster overlays
- **User Management**: Admin panel, user list, role management and status statistics
- **AI Assistant**: Draggable floating chat window for AI-assisted Q&A
- **Theme Switching**: Light/dark theme support, following system preference
- **Responsive Layout**: Modern UI built with Tailwind CSS + DaisyUI, adapted for mobile and desktop
