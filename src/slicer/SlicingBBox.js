import {pickCenter} from '../cesiumutils';
import Cartographic from 'cesium/Source/Core/Cartographic';
import Rectangle from 'cesium/Source/Core/Rectangle';
import {radiansToLv95} from '../projection';

export default class SlicingBBox { // todo
  constructor(viewer, slicingRatio) {
    this.slicingRatio = slicingRatio;
    this.viewer = viewer;
    this.boxHeight = 15000;

    this.planesHorizontalLength = 0;
    this.planesVerticalLength = 0;
    this.targetYNortheast = 0;
    this.targetXNortheast = 0;
    this.targetYSouthwest = 0;
    this.targetXSouthwest = 0;
    this.targetDown = 0;
    this.targetUp = 0;
    this.planesCenter = undefined;
    this.planesCenterH = undefined;
    this.planesCenterV = undefined;
  }

  activate() {
    const globe = this.viewer.scene.globe;
    this.planesCenter = pickCenter(this.viewer.scene);

    let planesCenter = Cartographic.fromCartesian(this.planesCenter);
    planesCenter.height = 0;
    // check is slicing center placed on map otherwise use map center
    if (!Rectangle.contains(globe.cartographicLimitRectangle, planesCenter)) {
      planesCenter = Rectangle.center(globe.cartographicLimitRectangle);
    }

    let viewRect = this.viewer.scene.camera.computeViewRectangle();
    const mapRect = this.viewer.scene.globe.cartographicLimitRectangle;
    if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
      viewRect = mapRect;
    }
    // get extreme points of the map
    const mapRectNortheast = Rectangle.northeast(mapRect);
    const sliceRectWidth = this.slicingRatio * viewRect.width;
    const sliceRectHeight = this.slicingRatio * viewRect.height;
    let lon = planesCenter.longitude + sliceRectWidth;
    let lat = planesCenter.latitude + sliceRectHeight;
    if (!Rectangle.contains(globe.cartographicLimitRectangle, Cartographic.fromRadians(lon, lat))) {
      lon = mapRectNortheast.longitude;
      lat = mapRectNortheast.latitude;
    }
    // moves the center of slicing. Left down corner should be placed in the view center
    planesCenter.longitude = sliceRectWidth / 2 + planesCenter.longitude;
    planesCenter.latitude = sliceRectHeight / 2 + planesCenter.latitude;
    // converts coordinates to lv95 to calculate initial planes distance in meters
    const lv95SecondPosition = radiansToLv95([lon, lat]);
    const lv95Center = radiansToLv95([planesCenter.longitude, planesCenter.latitude]);

    // calculates initial planes distance in meters
    const xDiffNortheast = lv95SecondPosition[0] - lv95Center[0];
    const xDiffSouthwest = xDiffNortheast;
    const yDiffNortheast = lv95SecondPosition[1] - lv95Center[1];
    const yDiffSouthwest = yDiffNortheast;
    this.planesHorizontalLength = xDiffNortheast + xDiffSouthwest;
    this.planesVerticalLength = yDiffNortheast + yDiffSouthwest;

    this.targetYNortheast = yDiffNortheast;
    this.targetXNortheast = xDiffNortheast;
    this.targetYSouthwest = yDiffSouthwest;
    this.targetXSouthwest = xDiffSouthwest;
    this.targetDown = planesCenter.height + this.boxHeight / 2;
    this.targetUp = this.targetDown;
    this.planesCenter = Cartographic.toCartesian(planesCenter);
    this.planesCenterH = this.planesCenter;
    this.planesCenterV = this.planesCenter;
  }
}
