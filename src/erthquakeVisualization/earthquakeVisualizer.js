import Cartesian3 from 'cesium/Core/Cartesian3.js';
import Color from 'cesium/Core/Color.js';
import HeightReference from 'cesium/Scene/HeightReference.js';
import {parseEarthquakeData} from './helpers';
import {readTextFile} from '../utils';

export default class EarthquakeVisualizer {
  constructor(viewer) {
    this.viewer = viewer;
    this.earthquakes = []
  }

  async showEarthquakes() {
    if (this.earthquakes && this.earthquakes.length) {
      this.earthquakes.forEach(entity => entity.show = true); // TODO rerender
    } else {
      const earthquakeText = await readTextFile('http://localhost:8000/src/erthquakeVisualization/testData/earthquake.txt'); // temporary
      const earthquakeData = parseEarthquakeData(earthquakeText);

      this.earthquakes = earthquakeData.map(data => this.viewer.entities.add({
        position: Cartesian3.fromDegrees(Number(data.Longitude), Number(data.Latitude), 100),
        point: {
          pixelSize: 20,
          color: Color.PURPLE,
          heightReference: HeightReference.RELATIVE_TO_GROUND,
        },
        description: 'Test point'
      }));
    }
  }

  hideEarthquakes() {
    this.earthquakes.forEach(entity => entity.show = false); // TODO rerender
  }
}
