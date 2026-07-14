# Lexic Feature

## URL Parameters

| Parameter         | Default | Description                                                                                                                                        |
| ----------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lexicSingleTile` | `false` | Set to `true` to use a single untiled image instead of tiled WMS requests for the filter overlay (fewer requests, but lower quality at high zoom). |

Example: `https://viewer.swissgeol.ch/?lexicSingleTile=true`

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
