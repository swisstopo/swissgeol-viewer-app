# AGENTS.md — swissgeol-viewer-suite

A 3D geological viewer for Switzerland built on CesiumJS, with a Rust API backend. Uses Docker Compose for development.

## Architecture Overview

Four services wired together:

| Service       | Tech                      | Port                 | Purpose                                 |
| ------------- | ------------------------- | -------------------- | --------------------------------------- |
| `ui`          | TypeScript, Lit, CesiumJS | 8000                 | 3D viewer SPA                           |
| `api`         | Rust (Axum, SQLx)         | 3000 (8480 external) | REST API, layer config, project storage |
| `abbreviator` | External Go service       | 8001                 | URL shortening                          |
| `titiler`     | Python (TiTiler)          | 8481                 | GeoTIFF tile server                     |

The UI dev server proxies `/api` → Rust API and `/abbr` → abbreviator (see `ui/vite.config.ts`). The API reads layer configuration from `layers/layertree.json5` at startup and serves it at `GET /api/layers`. PostgreSQL stores user projects; MinIO (dev) / AWS S3 (prod) stores project assets.

## Developer Workflows

```bash
# Full stack (required before local API/UI work)
docker compose up

# UI dev server (hot-reload, runs inside Docker but can also run directly)
cd ui && npm install && npm start        # http://localhost:8000

# API local dev
cd api && cargo fetch
make run                                 # starts Docker db + minio, runs API natively

# Type-check UI
cd ui && npm run check

# Lint & format UI (ESLint + Prettier; also runs via husky pre-commit)
cd ui && npm run lint:fix

# Run Rust tests / lint
cd api && cargo test && cargo clippy && cargo fmt

# Run E2E tests (Cypress + Cucumber, needs built app)
cd ui && npm run e2e

# Validate layer config (runs API with --validate-only)
cd ui && npm run config:validate

# Extract i18n keys
cd ui && npm run extract-i18n
```

### DB Migrations (sqlx-cli required)

```bash
sqlx migrate add -r <description>   # create reversible migration in api/migrations/
sqlx database reset                  # reset + re-run all migrations
cargo sqlx prepare -- --lib          # regenerate sqlx offline query cache after SQL changes
```

## UI Component Patterns

**Two base classes** — use `CoreElement` for new components, `LitElementI18n` for legacy:

- `CoreElement` (`src/features/core/core-element.element.ts`): handles i18n re-renders, RxJS subscriptions via `this.register()`, and a `willFirstUpdate()` lifecycle hook.
- All UI components are custom elements; older ones use the `ngm-` prefix, newer feature-based ones use the `core-` prefix.

**Feature modules** (`src/features/`): each sub-directory has a `*.module.ts` that side-effect-imports all elements in that feature (e.g., `layer.module.ts`, `core.module.ts`). Import the module file to register its elements.

**Global state** lives in RxJS `BehaviorSubject`-based store classes under `src/store/` (e.g., `MainStore`, `ToolboxStore`, `DashboardStore`). Cross-component data also flows via `@lit/context` (e.g., `clientConfigContext` in `src/context/`).

## Layer Configuration

Layers are defined in JSON5 files under `layers/`. The main file is `layers/layertree.json5`, which uses `includes` to compose from `01-maps_and_models.json5`, `layers_3dtiles.json5`, etc.

Every layer needs at minimum `{ type, id }`. Types: `Wmts`, `Tiles3d`, `Voxel`, `Tiff`, `Earthquakes`. Full property docs in `docs/layer-config/`. Example:

```json5
// layers/layertree.json5
{ includes: ['./layers_3dtiles'] }
// layers_3dtiles.json5 defines layers array with type/id entries
```

Run `npm run config:validate` after editing layer files to catch errors before starting the stack.

## i18n

Four supported languages: `de`, `fr`, `it`, `en` (fallback). Translation files live in `ui/locales/<namespace>/<namespace>.<lang>.json`. Namespaces: `app`, `assets`, `layers`, `layout`, `catalog`, `toolbox`. Language is stored in the `?lang=` URL query param. Run `npm run extract-i18n` after adding `i18next.t('new.key')` calls.

## Build Notes

- `npm run build` runs three steps: `build:static` (generates `dist/env.js`, manuals, versions) → `build:js` (Vite + Babel for decorator/polyfill support).
- Cesium static assets (Workers, ThirdParty, Assets, Widgets) are copied to `dist/cesium/` via `vite-plugin-static-copy`.
- The `src` alias resolves to `ui/src/` — use `import { X } from 'src/features/...'` throughout the UI source.
- Target browsers: last 2 versions of Chrome/Firefox/Safari/Edge + Edge 18 (Babel handles the gap).

## Key Files

| File                     | Purpose                                  |
| ------------------------ | ---------------------------------------- |
| `layers/layertree.json5` | Root layer/group configuration           |
| `ui/src/viewer.ts`       | CesiumJS `Viewer` initialization         |
| `ui/src/ngm-app.ts`      | Root LitElement, wires features together |
| `ui/src/features/`       | Feature-sliced UI modules                |
| `ui/src/store/*.ts`      | RxJS-based global state                  |
| `ui/vite.config.ts`      | Dev proxy config and build pipeline      |
| `api/src/lib.rs`         | Axum router with all `/api/*` routes     |
| `api/migrations/`        | SQL migration files (sqlx)               |
| `k8s/`                   | Helm chart for Kubernetes deployment     |
