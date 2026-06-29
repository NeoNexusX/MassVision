# Documentation Maintenance

This project's documentation is powered by [VitePress](https://vitepress.dev/). Source files live under `docs/` at the repo root, share the same repository as the frontend SPA, and ship as static files served from the site's `/docs/` subpath. This page covers how to write docs, how to update them, and how to preview your changes locally.

## 1. Directory Layout

```
docs/
├── .vitepress/
│   ├── config.ts          # Site config: nav, sidebar, i18n, build options
│   ├── theme/             # Custom theme (custom.css, etc.)
│   └── cache/             # Local cache (gitignored — leave it alone)
├── en/                    # English docs (default language, no /en in URL)
│   ├── index.md           # English landing page
│   ├── guide/             # User guide
│   └── dev/               # Developer docs (this page lives here)
└── zh/                    # Chinese docs (URL keeps the /zh prefix)
    ├── index.md           # Chinese landing page
    ├── guide/             # User guide
    └── dev/               # Developer docs
```

Key conventions:

- **Language at the top level.** `en/` is the default — its URLs are rewritten to drop the `/en` prefix; `zh/` keeps `/zh`. See `rewrites` in `.vitepress/config.ts`.
- **Category second.** Today there are two: `guide/` (for users) and `dev/` (for contributors). When you add a new category, create the directory in both languages.
- **Filename = URL.** `docs/en/dev/doc-maintenance.md` becomes `/docs/dev/doc-maintenance`. Non-ASCII filenames are allowed (the Chinese side uses them), but the English side should stay in kebab-case.

## 2. Adding or Editing Pages

### 2.1 Edit an Existing Page

Just edit the `.md` file. The dev server (section 4) hot-reloads on save.

### 2.2 Add a New Page

1. **Create the file in both languages**, keeping filenames in sync:
   - `docs/en/guide/export-data.md`
   - `docs/zh/guide/export-data.md`
2. **Register it in the sidebar** in `.vitepress/config.ts`. Without this, the page is reachable by URL but invisible in the sidebar.
   - English: append an entry to `en.sidebar['/guide/'].items`.
   - Chinese: append an entry to `zh.sidebar['/zh/guide/'].items`.
3. **For a brand-new category** (not `guide`/`dev`), also add a top-level `nav` entry and a new `sidebar` key for the route prefix.

### 2.3 Frontmatter

Each `.md` file can start with a YAML frontmatter block. The two most common cases are the `home` layout (landing pages) and tuning `title` / `outline` on a regular page:

```markdown
---
title: Documentation Maintenance
outline: [2, 3]   # Right-hand outline shows h2~h3 only
---
```

Frontmatter is optional — VitePress falls back to the first `#` heading for the title.

## 3. Writing Syntax

### 3.1 Standard Markdown

All CommonMark — headings, lists, tables, code blocks, links, images — works. Always tag code blocks with a language for syntax highlighting:

````markdown
```ts
const x: number = 1
```
````

### 3.2 VitePress Containers

Four callout containers render as colored cards:

```markdown
::: tip Tip
Supplementary helpful info.
:::

::: warning Caution
A common pitfall worth flagging.
:::

::: danger Warning
Destructive / irreversible operations.
:::

::: details Click to expand
Collapsed-by-default content — useful for long command output or configs.
:::
```

### 3.3 Math

`markdown.math` is enabled in `.vitepress/config.ts`. Inline math uses `$...$`, block math uses `$$...$$`:

```markdown
Inline: $E = mc^2$

Block:
$$
\hat{y} = \mathrm{softmax}(Wx + b)
$$
```

### 3.4 Internal Links

- **Relative paths** (preferred): `[View Data](./view-data)` — survives file moves.
- **Absolute paths**: `[View Data](/guide/view-data)` (English) or `[查看数据](/zh/guide/view-data)` (Chinese). Remember the `/zh` prefix for Chinese pages.
- **Cross-language links**: handled by the language switcher in the top-right. Don't hand-write them.

::: warning Dead links break the build
`ignoreDeadLinks` is not enabled in `config.ts`, so `npm run docs:build` fails on any broken link. If you rename or move a file, grep for the old path first.
:::

### 3.5 GitHub-style Extras

- Emoji: `:tada:` → 🎉
- Table of contents: `[[toc]]` anywhere in a page renders its outline
- Code import: `<<< @/path/to/file.ts` inlines a file from the repo

## 4. Previewing Locally

The docs dev server runs on **port 5174** (the frontend SPA uses 5173 — they don't collide).

### 4.1 Docs Only

```bash
npm run docs:dev
```

Open `http://localhost:5174/docs/`. Saving any `.md` file triggers hot reload — no manual refresh needed.

### 4.2 SPA + Docs Together

```bash
npm run dev
```

`run-p` starts both servers in parallel:

- Frontend SPA: `http://localhost:5173/`
- Docs: `http://localhost:5174/docs/`

Use this when you're linking from the docs into the SPA, or want to sanity-check the app after a docs change.

### 4.3 Production-build Preview

The dev server differs from a production build in routing, minification, and `base` handling. Before sending a PR, run:

```bash
npm run docs:build      # outputs to dist-docs/ at the repo root
npm run docs:preview    # serves the static build, still on port 5174
```

Common reasons `docs:build` fails:

1. **Dead links** — a `[xxx](./yyy)` points at a file that no longer exists.
2. **Frontmatter syntax error** — YAML indentation or missing space after `:`.
3. **TS/Vue theme errors** — run `npm run docs:type-check` to check `.vitepress/` types in isolation.

## 5. Deployment Notes

- **Build output**: `dist-docs/` at the repo root (not inside `docs/`).
- **Path prefix**: `base: '/docs/'` must stay in sync with the `location /docs/` block in `docker/nginx.conf.template`. Change both together.
- **Image build**: `docker/Dockerfile` copies `dist-docs/` into the nginx container. You don't need Docker locally — CI handles it.

## 6. Pre-commit Checklist

- [ ] Both languages updated (or the PR explicitly states one side is pending)
- [ ] New pages registered in `config.ts` sidebar
- [ ] `npm run docs:dev` renders as expected
- [ ] `npm run docs:build` passes (no dead links, no frontmatter errors)
- [ ] Screenshots / images uploaded to an image host — do NOT drop them into `public/` or `docs/`, which inflates the bundle
