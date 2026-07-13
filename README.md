# viewer.swissgeol.ch

![Sliced 3D scene](ui/public/images/readme.png)

## Description

Use viewer.swissgeol.ch to explore geological data across Switzerland - both at the surface and deep underground. You can view existing datasets, combine different sources, and even integrate your own data for a tailored experience.

With viewer.swissgeol.ch, you can...

...get an overview of geological data available across Switzerland

...combine surface and subsurface datasets

...slice through 3D geological models to explore underground structures

...upload and visualize your own geodata

...and much more

## Installation

Follow the steps below to run viewer.swissgeol.ch in your local development environment.

### Prerequisites

- [node.js](https://nodejs.org/en)
- [Rust](https://www.rust-lang.org/)
- [Docker](https://www.docker.com/)

> Note that the development environment is fully dockerized.
> However, we recommend installing every programming language to optimize your experience.

### Set Up the Development Environment

Follow these steps to set up the development environment on your local machine:

#### 1. Install API Dependencies

Navigate to the API directory and download its dependencies:

```bash
cd api && cargo fetch
```

#### 2. Install UI Dependencies

Install the UI's dependencies:

```bash
cd ui && npm install
```

### Start Development Environment

Start the application's Docker containers:

```bash
docker compose up
```

This will automatically install all dockerized dependencies and also initialize the database.

## Usage

The viewer's API and UI are available as Docker images:

- [`ghcr.io/swisstopo/swissgeol-viewer-api`](https://github.com/swisstopo/swissgeol-viewer-suite/pkgs/container/swissgeol-viewer-api)
- [`ghcr.io/swisstopo/swissgeol-viewer-ui`](https://github.com/swisstopo/swissgeol-viewer-suite/pkgs/container/swissgeol-viewer-ui)

A full deployment for [Kubernetes](https://kubernetes.io/) is available as [Helm](https://helm.sh/) charts in [k8s/](./k8s/).

### URL Parameters

A few URL parameters will modify the behavior of the viewer:

- `noLimit` disable the navigation limits (sphere and lava). Use noLimit=false to enforce limits on local dev.
- `ionAssetIds` display some additional Cesium ION 3dtilesets (coma separated list of CesiumIon ids)
- `ionToken` optional token to access Cesium ION 3dtilesets
- `initialScreenSpaceError` define the visual quality (default: 10000)
- `maximumScreenSpaceError` define the visual quality (default: 2.0 except for localhost which is 20.0)
- `ownterrain=false` disables the terrain (mind that their is only data in the swissrectangle)
  `ownterrain=cli_ticino_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Ticino)
  `ownterrain=cli_walensee_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Walensee)
- `swissrectangle=false` do not restrict rendering to the Swiss rectangle
- `norequestrendermode` disable the resource optimizations (will use 100% CPU)
- `inspector` display the Cesium Inspector widget
- `inspector_wireframe` enable the wireframe mode
- `cesiumToolbar` display configuration panel for fog, ambient, background color and terrain underground color
- `lexicSingleTile` Set to `true` to use a single untiled image instead of tiled WMS requests for the filter overlay (fewer requests, but lower quality at high zoom). Default: false

Example: `https://viewer.swissgeol.ch/?lexicSingleTile=true`

## Support

- [swissgeol@swisstopo.ch](mailto:swissgeol@swisstopo.ch)

## Authors & acknowledgements

- [swisstopo](https://www.swisstopo.admin.ch/de)
- [EBP Schweiz AG](https://www.ebp.global/ch-de)

## License

- [BSD 3-Clause](LICENSE)

## Related projects

- [assets.swissgeol.ch](https://assets.swissgeol.ch)
- [boreholes.swissgeol.ch](https://boreholes.swissgeol.ch)
