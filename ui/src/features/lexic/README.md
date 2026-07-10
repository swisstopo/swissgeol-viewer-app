# Lexic Feature

## URL Parameters

| Parameter          | Default | Description                                                                                                    |
| ------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `lexicSingleTile`  | `true`  | Set to `false` to use tiled WMS requests instead of a single image for the filter overlay (better zoom quality, more network requests). |

Example: `https://viewer.swissgeol.ch/?lexicSingleTile=false`

## OpenAPI Generation

This feature uses Orval to generate the Lexic API client and schema models from the OpenAPI spec.

## Generate

From `ui/`:

```sh
npm run openapi:lexic
```

Watch mode:

```sh
npm run openapi:lexic:watch
```

## Files

- `orval.lexic.config.ts` - Orval project config
- `src/features/lexic/generated/lexic-api.ts` - generated request functions
- `src/features/lexic/generated/lexic-schemas/*` - generated schemas and params
- `src/features/lexic/lexic-orval.mutator.ts` - runtime base URL and `X-API-Key` injection

Do not edit generated files manually. Regenerate them from the OpenAPI source.
