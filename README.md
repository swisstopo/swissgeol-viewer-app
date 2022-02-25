# Swissgeol viewer


## A Geology 3D viewer

Swissgeol is the new geology 3D viewer of [Swisstopo](https://swisstopo.ch), available at https://viewer.swissgeol.ch and developed by [Camptocamp](https://www.camptocamp.com/).
It is Open Source and based on the Open Source CesiumJS 3D library.

You are welcome to use and adapt this software for your own uses; see [LICENSE](./LICENSE). If you want to get started off rapidly, Camptocamp offers [support and expertise](https://www.camptocamp.com/geospatial_solutions) to meet your needs rapidly.


## Your own version: getting started

```bash
git clone https://github.com/swissgeol/ngm.git
cd ngm
make run
```

open http://localhost:8000


## Developing/deploying the Swisstopo version

See [DEVELOPING.md](./DEVELOPING.md).
See [DEPLOY_VIEWER.md](./DEPLOY_VIEWER.md).
See [DEPLOY_ABBREVIATOR.md](./DEPLOY_ABBREVIATOR.md).


## URL Parameters

A few URL parameters will modify the behavior of the viewer:

- `noLimit` disable the navigation limits (sphere and lava). Use noLimit=false to enforce limits on local dev.
- `assetIds` display some additional Cesium ION 3dtilesets (coma separated list of CesiumIon ids)
- `initialScreenSpaceError` define the visual quality (default: 10000)
- `maximumScreenSpaceError` define the visual quality (default: 2.0 except for localhost which is 20.0)
- `ownterrain=false` disables the terrain (mind that their is only data in the swissrectangle)
  `ownterrain=cli_ticino_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Ticino)
  `ownterrain=cli_walensee_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Walensee)
- `swissrectangle=false` do not restrict rendering to the Swiss rectangle
- `norequestrendermode` disable the resource optimizations (will use 100% CPU)
- `inspector` display the Cesium Inspector widget
- `inspector_wireframe` enable the wireframe mode
- `preserveDrawingBuffer` allow to read canvas from the DOM, probably helping hotjar record the canvas
- `date` a date to be used for illumination (default to "2018-06-21T10:00:00.000Z")
- `light` a white light source from infinity (ex: 1-2-0-1000 will have direction (1, 2, 0) and intensity 1000)
- `cesiumToolbar` display configuration panel for fog, ambient, background color and terrain underground color

## Notes

Keyboard layout made with [keyboard-layout-editor](http://www.keyboard-layout-editor.com/) and [json to import](https://jira.camptocamp.com/secure/attachment/42145/keyboard-layout_upd.json)
