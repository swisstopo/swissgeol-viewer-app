import Cartesian3 from 'cesium/Core/Cartesian3.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import CustomDataSource from 'cesium/DataSources/CustomDataSource.js';
import {parseEarthquakeData, EARTHQUAKE_SPHERE_SIZE_COEF, getColorForMagnitude} from './helpers.js';
import {readTextFile} from '../utils.js';

export default class EarthquakeVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.earthquakeDataSource = new CustomDataSource('earthquakes');
    this.viewer.dataSources.add(this.earthquakeDataSource);
    this.earthquakeDataSource.entities.collectionChanged.addEventListener(() => {
      this.viewer.scene.requestRender();
    });
  }

  async showEarthquakes() {
    const earthquakeText = await readTextFile('./src/earthquakeVisualization/testData/earthquake.txt'); // temporary
    const earthquakeData = parseEarthquakeData(earthquakeText);
    earthquakeData.map(data => {
      const size = Number(data.Magnitude) * EARTHQUAKE_SPHERE_SIZE_COEF;
      const height = -(Number(data.Depthkm) * 1000); // convert km to m
      return this.earthquakeDataSource.entities.add({
        position: Cartesian3.fromDegrees(Number(data.Longitude), Number(data.Latitude), height),
        ellipsoid: {
          radii: new Cartesian3(size, size, size),
          material: getColorForMagnitude(data.Magnitude),
          heightReference: HeightReference.RELATIVE_TO_GROUND
        }
      });
    });
  }

  async setVisible(visible) {
    const entities = this.earthquakeDataSource.entities.values;
    if (entities && entities.length) {
      this.earthquakeDataSource.show = visible;
    } else {
      await this.showEarthquakes();
    }
  }
}
