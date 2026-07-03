# Changelog

## [v1.14.0]

### Added

### Changed

- api/projects/\* deactivated.

### Fixed

## [v1.13.0]

### Added

- Missing it, fr and de translations added.
- Compass added into 3D-scene.
- OGC-API test case scrip added.
- lexic-API backend connection integrated.
- swissAPLS3D - WP data integrated for privileged users.
- Data of the Mont Terri Rock Lab integrated.

### Changed

- Show always tooltips in infobox.
- Fix order of infobox entries.
- Make integration of abitrary WMS/WMTS in the backend possible.
- swissAPLS3D - SAM data updated for privileged users.
- swisJURA3D - Documentation and download data updated.

### Fixed

- Correct doenload links for swissBEDROCK (2D/3D)
- Handle not available WMS/WMTS.

## [v1.12.0]

### Added

### Changed

- The project tab is no longer visible until the project feature is fully refactored and ready to be used.

### Fixed

- Layer visibility is now correctly loaded from the url parameters on page reload or when sharing a link.

## [v1.11.0]

### Added

- Infobox for Jura3D layers added
- 2D-Seismik Survey Geneva added
- Translation of attribute valus of regional voxel models added

### Fixed

- Cypress tests fixed
- Download link swissBEDROCK fixed

## [1.10.0]

### Added

- GeoJSON and KML layers can now be configured and served via the backend API.
- Layergroups in the layertree can now be hidden depending on user access groups or the environment.
- Aar3D - Layergroup and Layers added
- Jura3D - Cross sections added

### Changed

- The Cesium Ion access token is now reloaded when opening the upload modal.
- The transparent background layer will always stay transparent, no matter the opacity.
- The Cesium Ion token is no longer added to the modal per default.
- The Cesium Ion upload tool now supports GeoJSON and KML assets.

### Fixed

- Missing legends for WMS layers are now correctly displayed.

## [1.9.0]

### Added

- Added support for 3dtiles v1.1.
- Added two new seismics layers.
- Added support for displaying layers via OGC API.
- Geometries on WMTS layers and some specific 3dtiles can now be exported via the tools panel.
- The map toolbar now includes a compass that rotates with the camera.
- Restructured the layer catalog.

### Changed

- Refactored the layer behavior for more stability and easier maintenance.
- Upgraded to the non-experimental backend for Voxel layers.
  Layers remaining on the old format cannot be displayed anymore and have been temporarily removed.
- The 3d view cube at the bottom right of the screen has been removed.
- Underground 3dtiles are now closer to their real color, without being shadowed.
- Looking at 3dtiles from below now correctly colors the objects' undersides (does not work on 3dtiles v1.0).

### Fixed

- WMTS picking results containing links now correctly link to the respective url instead of just displaying the link text.
- Overlay windows no longer overlap if there is free space on the map.

## [1.8.0]

### Added

- Added a new "gravel and sand" layer.

### Changed

- Disclaimer links now point to the new swissgeol homepage.
- Large texts in the layer panel are now cut of instead of overflowing or extending their container.

### Fixed

- Translations are now applied before the first render.
  This removes the initial translation delay.
- The highlighting of picked layers is now correctly removed after unhovering.
- The TIFF band switcher occasionally crashed on switching layers, which is now correctly handled.
- The background layer can now be hidden and made transparent without any errors appearing.
- WMTS layers no longer stay activated after removal or cause errors after being deactivated.

## [1.7.0]

### Added

- The currently signed-in user is now visible in a dropdown.

### Changes

- The units of measurement of swissBEDROCK bands are now standalone and directly integrated into the legend.
- The exaggeration slider has been changed to a range of `1` to `10` with a step size of `0.5`.
- The sign in mask now opens in the same window as the viewer.
- The search now matches by name only, sorts the result items and excludes duplicates.

### Fixed

- The object info in the navigation correctly reacts to hovering over objects and layers.
- Drawings can now be placed directly on layers without clamping to the terrain.
- Resolved some issues with voxel and earthquake layers not disappearing after removal.

## [1.6.1]

### Fixed

- Picking is now once again supported on all layer types.

## [1.6.0]

### Added

- The 2d mode toggle now switches between a 3d and 2d icon.
- The swissBEDROCK layer is now visible on all environments.

### Changes

- The layer tree has been restructured to more closely resemble the structure of map.geo.admin.

### Fixed

- The swissBEDROCK legend is now customized for each band.
- The swissBEDROCK TMUD band is now showing all data >3.
- Sorting and removing specific layers from search does no longer put the viewer into an invalid state.

## [1.5.0]

### Added

- The swissBEDROCK layer is now translated.
- The tiff band window now contains a gradient legend for the currently active band.
- The results of picking the active layers are now all shown in a shared window.

### Changes

- The abbreviator deployment is now integrated into the viewer Helm charts.
- Moving the map with middle mouse button or control and left mouse button now uses the default cesium controller.
  This fixes the snap-back effect when going under the terrain.
  As a consequence of this, that type of control now only works when fully zoomed into the map.

### Fixed

- The highlight on voxel tiles is now removed when their layer's filter window is closed.
- Adding layers from search that also exist in the catalog will also mark that layer as activated in the catalog itself.

## [1.4.0]

### Changed

- Google Analytics is now only running in PROD.

## [1.3.0]

### Added

- Added a control with which the camera can be fixed in a 2d top-down position.
- The filter window for voxel layers can now be closed without resetting the layer.

### Changed

- Removed the target point control as it is currently not working properly.
- The context button of activated layers is no longer disabled when the layer is hidden.
- The new Rheintal layer no longer offers a conductivity filter.

### Fixed

- Fixed the beta ribbon being missing on PROD.
- Fixed Google Analytics not being properly included.
- Voxel layers can now be made transparent via the opacity slider.

## [1.1.0]

### Added

- The camera settings panel now contains actual input fields.
- Activated layers and geometries now appear as counters in the sidebar.
- The search input can now be navigated via arrows.
- Added the Rheintal voxel layer.

### Changed

- Configurations that are relevant to the UI are now exposed via API endpoint.
- The sidebar and header have been redesigned.
- The data catalog panel has been redesigned.
- The disclaimer has been redesigned and adjusted to align with other swissgeol applications.

### Fixed

- The maximum zoom level is now restricted again.
- The order of layers now stays consistent on reload.
- Editing of geometries no longer freezes after moving the map anchors.
- Slicing box arrows no longer disappear when exaggerating.
- The select input for adding members to projects now works as intended.
- Geometry copies are now fully independent of their original.

## [1.0.0]

### Added

- Add `PG_SSL_MODE` environment variable to allow SSL connections between the API and database.

- The application's frontend is now built on [Vite](https://vite.dev/),
  enabling faster development and easier configuration.

- The application's deployment, including Kubernetes configuration,
  is now managed via GitHub Actions.

### Changed

- Values for "Height", "Angle", "Pitch", and coordinates are now input fields. Users can adjust values using arrow keys.

- The range for height has been increased to 700'000m.

- Config is loaded from the frontend at runtime now.

- The main search input now supports selection of results
  via direct enter, as well as keyboard navigation.

- The header and side navigation has been updated to the new design.

- The layers sidebar has been updated to the new design.
  Some parts of it, namely the catalog and the selected layers,
  have been left in the old design and will be changed
  in an upcoming release.

- The disclaimer has been changed to a required, blocking pop-up.

### Fixed
