import Cartesian3 from 'cesium/Core/Cartesian3.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import {parseEarthquakeData, EARTHQUAKE_SPHERE_SIZE_COEF, getColorForMagnitude} from './helpers';
import {readTextFile} from '../utils';

export default class EarthquakeVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.earthquakes = [];
  }

  async showEarthquakes() {
    const earthquakeText = await readTextFile('/src/erthquakeVisualization/testData/earthquake.txt'); // temporary
    const earthquakeData = parseEarthquakeData(earthquakeText);
    this.earthquakes = earthquakeData.map(data => {
      const size = Number(data.Magnitude) * EARTHQUAKE_SPHERE_SIZE_COEF;
      const height = -(Number(data.Depthkm) * 1000); // convert km to m
      this.viewer.entities.add({
        position: Cartesian3.fromDegrees(Number(data.Longitude), Number(data.Latitude), height),
        ellipsoid: {
          radii: new Cartesian3(size, size, size),
          material: getColorForMagnitude(data.Magnitude),
          heightReference: HeightReference.RELATIVE_TO_GROUND
        }
      });
    });
    this.viewer.scene.requestRender();
  }

  async toggleEarthquakes() {
    if (this.earthquakes && this.earthquakes.length) {
      this.earthquakes.forEach(entity => entity.show = !entity.isShowing);
      this.viewer.scene.requestRender();
    } else {
      await this.showEarthquakes();
    }
  }
}
