import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import CustomDataSource from 'cesium/Source/DataSources/CustomDataSource';
import {parseEarthquakeData, EARTHQUAKE_SPHERE_SIZE_COEF, getColorForMagnitude} from './helpers.js';
import {readTextFile} from '../utils.js';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import CMath from 'cesium/Source/Core/Math';
import {LAYER_TYPES} from '../constants.js';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import Rectangle from 'cesium/Source/Core/Rectangle';

export default class EarthquakeVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.earthquakeDataSource = new CustomDataSource(LAYER_TYPES.earthquakes);
    this.viewer.dataSources.add(this.earthquakeDataSource);
    this.boundingSphere = null;
    this.boundingRectangle = new Rectangle(
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY
    );
    this.maximumHeight = 0;
    this.earthquakeDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
    });
  }

  async showEarthquakes() {
    const earthquakeText = await readTextFile('./src/earthquakeVisualization/testData/earthquake.txt'); // temporary
    const earthquakeData = parseEarthquakeData(earthquakeText);
    earthquakeData.map(data => {
      const size = Number(data.Magnitude) * EARTHQUAKE_SPHERE_SIZE_COEF;
      const depthMeters = Number(data.Depthkm) * 1000; // convert km to m
      const longitude = Number(data.Longitude);
      const latitude = Number(data.Latitude);
      const position = Cartesian3.fromDegrees(longitude, latitude, -depthMeters);
      const cameraDistance = size * 4;
      const zoomHeadingPitchRange = new HeadingPitchRange(0, CMath.toRadians(25), cameraDistance);
      this.boundingRectangle.west = Math.min(CMath.toRadians(longitude), this.boundingRectangle.west);
      this.boundingRectangle.south = Math.min(CMath.toRadians(latitude), this.boundingRectangle.south);
      this.boundingRectangle.east = Math.max(CMath.toRadians(longitude), this.boundingRectangle.east);
      this.boundingRectangle.north = Math.max(CMath.toRadians(latitude), this.boundingRectangle.north);
      this.maximumHeight = Math.max(this.maximumHeight, depthMeters * 2);
      return this.earthquakeDataSource.entities.add({
        position: position,
        ellipsoid: {
          radii: new Cartesian3(size, size, size),
          material: getColorForMagnitude(data.Magnitude),
          heightReference: HeightReference.RELATIVE_TO_GROUND
        },
        properties: {
          ...data,
          zoomHeadingPitchRange
        }
      });
    });
    this.boundingSphere = BoundingSphere.fromRectangle3D(this.boundingRectangle);
  }

  async setVisible(visible) {
    const entities = this.earthquakeDataSource.entities.values;
    if (entities && entities.length) {
      this.earthquakeDataSource.show = visible;
    } else {
      if (visible) {
        await this.showEarthquakes();
      }
    }
  }

  setOpacity(opacity) {
    const entities = this.earthquakeDataSource.entities.values;
    entities.forEach(entity => {
      entity.ellipsoid.material = entity.ellipsoid.material.color.getValue().withAlpha(Number(opacity));
    });
  }
}
