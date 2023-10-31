# Ceisum ion labels

## Background
Data in [viewer.swissgeol.ch](https://viewer.swissgeol.ch) is integrarted using [cesium ion](https://ion.cesium.com/signin/). In order to keep track of the integrted data the following convention of lables shall be applied:

Label consist of following parts: "prefix" and "main label": 

**prefix:**  
The following *prefixes* have been defined:
* `"Project:"`	Name of the project in which the respective asset has been integrarted
* `"Status:"`	Status of the asset, e.g. `Live`, `in Integration`
* `"Topic:"`	Topic of the label, e.g. `Horizon`, `Boreholes`
* `"User:"`		User which uploaded the respective asset

**main label:**  
The following *main labels* are defined. 
* for `"Project:"`  
  * `swissgeol`: All assets which are integrated into viewer.swissgeol.ch
* for `"Status:"`
  * `Live 2023`:	Assets which are in productive use in 2023 i.e. starting fom 2023
  * `In Integration`:	Assets which are currently integrated into viewer.swissgeol.ch but not yet prodictive
* for `Topic`
  * `Consolidated rocks`: e.g. GeoMol horizons
  * `3D models`: e.g. local 3D model e.g. 3D model of city of Berne
  * `Boreholes`: boreholes
  * `Cross sections`: e.g. GeoMol cross sections 
  * `Faults`: e.g. GeoMol faults
  * `Infrastructures`: e.g. tunnel
  * `Temperatures model`:e.g. Horizons of temperature of the swiss molasse basin
  * `Top bedrock`: horizon of top beck rock
* for `User`:
  * `swisstopo`: swisstopo uoloaded the resepective asset
  * `camptocamp`: camptocamp uoloaded the resepective asset


If a `main label` is lacking it shall created and mailto:swissgeol@swisstopo.ch shall be informed.



Furthermore, for each asset its purpose shall be described.