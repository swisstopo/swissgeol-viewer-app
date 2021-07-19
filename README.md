# Swissgeol NGM

## A Geology 3D viewer

Swissgeol is the new geology 3D viewer of [Swisstopo](https://swisstopo.ch), available at https://beta.swissgeol.ch.
It is Open Source and based on the Open Source CesiumJS 3D library.

You are welcome to use and adapt this software for your own uses; see See [LICENCE.md](./LICENCE.md).


## Your own version: getting started

```bash
git clone https://github.com/swissgeol/ngm.git
cd ngm
npm i
npm start
```

open http://localhost:8000


## Developing the Swisstopo version

See [DEVELOPING.md](./DEVELOPING.md).


## URL Parameters

A few URL parameters will modify the behaviour of the viewer:

- `noLimit` disable the navigation limits (sphere and lava). Use noLimit=false to enforce limits on local dev.
- `assetIds` display some additional Cesium ION 3dtilesets (coma separated list of CesiumIon ids)
- `initialScreenSpaceError` define the visual quality (default: 10000)
- `maximumScreenSpaceError` define the visual quality (default: 2.0 except for localhost which is 20.0)
- `ownterrain=false` disables the Swisstopo terrain (mind that their is only data in the swissrectangle)
  `ownterrain=cli_2m` use the 2m terrain generated using Cesium CLI (for testing only)
  `ownterrain=cli_ticino_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Ticino)
  `ownterrain=cli_walensee_0.5m`' use the 0.5m terrain generated using Cesium CLI (for testing only - only around Walensee)
- `swissrectangle=false` do not restrict rendering to the Swiss rectangle
- `norequestrendermode` disable the resource optimizations (will use 100% CPU)
- `inspector` display the Cesium Inspector widget
- `inspector_wireframe` enable the wireframe mode


## Notes

Keyboard layout made with [keyboard-layout-editor](http://www.keyboard-layout-editor.com/) and [json to import](https://jira.camptocamp.com/secure/attachment/42145/keyboard-layout_upd.json)
