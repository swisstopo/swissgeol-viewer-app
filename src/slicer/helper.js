import Cartographic from 'cesium/Source/Core/Cartographic';
import {radiansToLv95} from '../projection';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {pickCenter} from '../cesiumutils';
import Rectangle from 'cesium/Source/Core/Rectangle';
import {SLICING_BOX_HEIGHT} from '../constants';

export function getOffsetForPrimitive(primitive, bboxCenter) {
  const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
  const cartCenter = Cartographic.fromCartesian(bboxCenter);
  const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
  const lv95Tile = radiansToLv95([tileCenter.longitude, tileCenter.latitude]);
  const offsetX = lv95Center[1] - lv95Tile[1];
  const offsetY = lv95Center[0] - lv95Tile[0];

  const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
  const transformCartographic = Cartographic.fromCartesian(transformCenter);
  const boundingSphereCartographic = Cartographic.fromCartesian(primitive.boundingSphere.center);
  let offsetZ = boundingSphereCartographic.height;
  if (transformCartographic) {
    offsetZ = transformCartographic.height;
  }
  return {
    offsetX: offsetX,
    offsetY: offsetY,
    offsetZ: offsetZ,
  };
}

export function getBboxFromMapRatio(viewer, ratio) {
  const globe = viewer.scene.globe;
  const sceneCenter = pickCenter(viewer.scene);
  let planesCenter = Cartographic.fromCartesian(sceneCenter);
  planesCenter.height = 0;
  // check is slicing center placed on map otherwise use map center
  if (!Rectangle.contains(globe.cartographicLimitRectangle, planesCenter)) {
    planesCenter = Rectangle.center(globe.cartographicLimitRectangle);
  }

  let viewRect = viewer.scene.camera.computeViewRectangle();
  const mapRect = viewer.scene.globe.cartographicLimitRectangle;
  if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
    viewRect = mapRect;
  }
  // get extreme points of the map
  const mapRectNortheast = Rectangle.northeast(mapRect);
  const sliceRectWidth = ratio * viewRect.width;
  const sliceRectHeight = ratio * viewRect.height;
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
  return {
    center: Cartographic.toCartesian(planesCenter),
    width: (lv95SecondPosition[1] - lv95Center[1]) * 2,
    length: (lv95SecondPosition[0] - lv95Center[0]) * 2,
    height: SLICING_BOX_HEIGHT
  };
}
