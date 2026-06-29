# Icon Guidelines

Icons used to be a mix of raw `<svg>` markup, direct `@heroicons/vue` component imports, and `@iconify/vue` — all three at once. They've been consolidated onto **Iconify only**. This page covers day-to-day usage, what to change when adding a new icon, and why that extra step exists.

## 1. Two Usage Patterns

### 1.1 Semantic business icons: `<SvgIcon type="..." />`

Use this for almost everything. [SvgIcon.vue](https://github.com/NeoNexusX/MassVision/blob/main/src/shared/components/SvgIcon.vue) is a thin, globally-registered wrapper; `type` maps to a semantic name in `ICON_MAP` inside [svgIcons.ts](https://github.com/NeoNexusX/MassVision/blob/main/src/shared/components/svgIcons.ts) (e.g. `warning`, `plus`, `close`), and is type-checked at compile time:

```vue
<SvgIcon type="warning" class="h-5 w-5 text-error" />
```

The benefit: business code never references the underlying icon library directly — swapping icons only touches `svgIcons.ts`.

### 1.2 One-off icons: `<Icon icon="prefix:name" />`

For icons that appear exactly once and won't be reused (e.g. a brand logo), use `@iconify/vue`'s `Icon` component directly — no need to add it to `ICON_MAP`:

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
</script>

<template>
  <Icon icon="simple-icons:github" class="h-5 w-5" />
</template>
```

### 1.3 Which icon set to use

- General UI icons: prefer `heroicons:*` (the project's primary set, already bundled offline).
- Brand / third-party logos (GitHub, WeChat, Alibaba Cloud, ...): use `simple-icons:*`.
- **Don't casually pull in a new icon set** (e.g. `mdi:*`). Even for a single icon, a new set means downloading the whole package and running it through the offline-bundling pipeline — rarely worth it. Search [icon-sets.iconify.design](https://icon-sets.iconify.design/) for a close-enough `heroicons` equivalent first; one almost always exists.

## 2. Why "Offline Bundling"

By default, `@iconify/vue`'s `<Icon icon="prefix:name"/>` falls back to fetching icon data from Iconify's public API (`api.iconify.design`) at runtime whenever the icon isn't already in the local cache. That means the app silently depends on an external network service — invisible on a dev machine with internet access, but any icon that isn't cached renders blank in environments without public internet access.

To avoid that dependency, a build-time script extracts the subset of icons actually used from the official icon-set packages and writes a tens-of-KB bundle file. On startup, the app registers that bundle into Iconify's local cache (`addCollection()`), so nothing is fetched over the network at runtime.

Relevant files:

```
scripts/
├── iconNames.mjs           # Icon name manifest — single source of truth for bundling
└── build-icon-bundle.mjs   # Reads the manifest, extracts the subset from @iconify-json/*, writes the bundle

src/shared/icons/
├── offlineRegistry.ts            # Calls addCollection() on startup, imported from main.ts
└── iconBundle.generated.json     # Generated output, committed to git — don't hand-edit
```

::: tip Why not just import the official package and filter at runtime
That was the first attempt, and it doesn't work: `getIcons()` filtering only happens at **runtime** — the bundler still ships the *entire* raw JSON (heroicons ~630KB, simple-icons ~4.7MB) in the production build, defeating the purpose. Hence generating the trimmed-down subset **before** the build, so only that small file gets imported at runtime.
:::

## 3. Steps to Add a New Icon

This only applies when you need an icon that **isn't already in the manifest**. Using an icon already in `ICON_MAP` requires none of this.

1. **Find the icon name** on [icon-sets.iconify.design](https://icon-sets.iconify.design/) and note the `set:icon-name` (e.g. `heroicons:beaker`).
2. **Add it to the manifest**: edit [scripts/iconNames.mjs](https://github.com/NeoNexusX/MassVision/blob/main/scripts/iconNames.mjs) and append the name to the relevant set's array.
3. **Regenerate the bundle**:
   ```bash
   npm run icons:bundle
   ```
   This rewrites `src/shared/icons/iconBundle.generated.json` in a couple of seconds.
4. **Use it in code**: for a semantic icon, add an entry to `ICON_MAP` in `svgIcons.ts` and use `<SvgIcon type="..."/>`; for a one-off, use `<Icon icon="..."/>` directly.
5. **Commit together**: include the updated `scripts/iconNames.mjs` and `iconBundle.generated.json` in the same commit/PR as the code that uses the new icon.

::: danger Skipping step 2-3 won't show up locally
On a dev machine with internet access, a missing icon silently falls back to fetching from Iconify's public API — it still "looks fine." It only goes blank once deployed somewhere without public internet access. **Check `git status` for a diff in `iconBundle.generated.json`** after adding an icon — if the icon name changed but this file didn't, you forgot to run `icons:bundle`.
:::

## 4. Verifying It's Actually Offline

To confirm a given icon is served from the local cache rather than fetched over the network: open DevTools → Network, filter by `iconify`, and reload the page.

- No requests to `api.iconify.design`: offline bundling is working.
- A request shows up: the icon you're using isn't in `iconBundle.generated.json` yet — check `scripts/iconNames.mjs` for a typo (hyphens are easy to drop).

## 5. Pre-commit Checklist

- [ ] The new icon exists on [icon-sets.iconify.design](https://icon-sets.iconify.design/); prefer `heroicons:*`
- [ ] Added the icon name to `scripts/iconNames.mjs`
- [ ] Ran `npm run icons:bundle` and committed the resulting `iconBundle.generated.json` diff
- [ ] `npm run type-check` / `npm run build` pass
- [ ] Network panel shows no requests to `api.iconify.design`
