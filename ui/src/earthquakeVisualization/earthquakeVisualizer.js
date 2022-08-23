import {
  Cartographic,
  Cartesian3,
  CustomDataSource,
  HeadingPitchRange,
  Math as CMath,
  BoundingSphere,
  Rectangle,

} from 'cesium';
import {EARTHQUAKE_SPHERE_SIZE_COEF, getColorFromTime, parseEarthquakeData} from './helpers';
import {LayerType} from '../constants';

export default class EarthquakeVisualizer {
  /**
   * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
   * @param {Object} config
   */
  constructor(viewer, config) {
    this.viewer = viewer;
    this.config = config;
    this.earthquakeDataSource = new CustomDataSource(LayerType.earthquakes);
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
    fetch(this.config.downloadUrl).then(response => {
      response.text().then(text => {
        parseEarthquakeData(text).map(data => {
          const size = Number(data.Magnitude.split(' ')[0]) * EARTHQUAKE_SPHERE_SIZE_COEF;
          const depthMeters = Number(data.Depthkm.split(' ')[0]) * 1000; // convert km to m
          const longitude = Number(data.Longitude);
          const latitude = Number(data.Latitude);
          delete data.Longitude;
          delete data.Latitude;
          const position = Cartesian3.fromDegrees(longitude, latitude, -depthMeters);
          const posCart = Cartographic.fromCartesian(position);
          const altitude = this.viewer.scene.globe.getHeight(posCart) || 0;
          posCart.height = posCart.height + altitude;
          Cartographic.toCartesian(posCart, undefined, position);
          const cameraDistance = size * 4;
          const zoomHeadingPitchRange = new HeadingPitchRange(0, CMath.toRadians(25), cameraDistance);
          data['Details'] = this.config.detailsUrl;
          this.boundingRectangle.west = Math.min(CMath.toRadians(longitude), this.boundingRectangle.west);
          this.boundingRectangle.south = Math.min(CMath.toRadians(latitude), this.boundingRectangle.south);
          this.boundingRectangle.east = Math.max(CMath.toRadians(longitude), this.boundingRectangle.east);
          this.boundingRectangle.north = Math.max(CMath.toRadians(latitude), this.boundingRectangle.north);
          this.maximumHeight = Math.max(this.maximumHeight, depthMeters * 2);
          return this.earthquakeDataSource.entities.add({
            position: position,
            ellipsoid: {
              radii: new Cartesian3(size, size, size),
              material: getColorFromTime(data.Time),
            },
            properties: {
              ...data,
              propsOrder: this.config.propsOrder,
              zoomHeadingPitchRange: zoomHeadingPitchRange
            }
          });
        });
        this.boundingSphere = BoundingSphere.fromRectangle3D(this.boundingRectangle);
      });
    });
  }

  /**
   * @param {boolean} visible
   */
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

  /**
   * @param {number} opacity
   */
  setOpacity(opacity) {
    const entities = this.earthquakeDataSource.entities.values;
    entities.forEach(entity => {
      entity.ellipsoid.material = entity.ellipsoid.material.color.getValue().withAlpha(Number(opacity));
    });
  }
}
