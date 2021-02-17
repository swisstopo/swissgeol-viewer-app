import Cartographic from 'cesium/Source/Core/Cartographic';
import {radiansToLv95} from '../projection';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {pickCenter} from '../cesiumutils';
import Rectangle from 'cesium/Source/Core/Rectangle';
import {SLICING_BOX_HEIGHT} from '../constants';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';

/**
 * @param primitive
 * @param {Cartesian3} bboxCenter
 * @return {Cartesian3}
 */
export function getOffsetForPrimitive(primitive, bboxCenter) {
  const tileCenter = Cartographic.fromCartesian(primitive.boundingSphere.center);
  const cartCenter = Cartographic.fromCartesian(bboxCenter);
  const lv95Center = radiansToLv95([cartCenter.longitude, cartCenter.latitude]);
  const lv95Tile = radiansToLv95([tileCenter.longitude, tileCenter.latitude]);
  const x = lv95Center[0] - lv95Tile[0];
  const y = lv95Center[1] - lv95Tile[1];

  const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
  const transformCartographic = Cartographic.fromCartesian(transformCenter);
  const boundingSphereCartographic = Cartographic.fromCartesian(primitive.boundingSphere.center);
  let z = boundingSphereCartographic.height;
  if (transformCartographic) {
    z = transformCartographic.height;
  }
  return new Cartesian3(x, y, z);
}

/**
 * @param {ClippingPlane} plane
 * @param {Cartesian3} offset
 * @return {ClippingPlane}
 */
export function applyOffsetToPlane(plane, offset) {
  const planeCopy = ClippingPlane.clone(plane);
  const normal = Cartesian3.clone(planeCopy.normal);
  Cartesian3.multiplyByScalar(normal, -1, normal);
  const normalizedOffset = Cartesian3.multiplyComponents(offset, normal, new Cartesian3());
  planeCopy.distance += normalizedOffset.x + normalizedOffset.y + normalizedOffset.z;
  return planeCopy;
}

/**
 * @param planes
 * @param [modelMatrix]
 * @return {module:cesium.ClippingPlaneCollection}
 */
export function createClippingPlanes(planes, modelMatrix) {
  return new ClippingPlaneCollection({
    modelMatrix: modelMatrix,
    planes: planes,
    edgeWidth: 1.0,
    unionClippingRegions: true
  });
}

/**
 * Returns bbox for box slicing from according to provided view ratio
 * @param {Viewer} viewer
 * @param {number} ratio
 * @return {{center: Cartesian3, width: number, length: number, height: number}}
 */
export function getBboxFromViewRatio(viewer, ratio) {
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

  const bottomRight = Cartesian3.fromRadians(lon, planesCenter.latitude, 0);
  const topLeft = Cartesian3.fromRadians(planesCenter.longitude, lat, 0);
  const topRight = Cartesian3.fromRadians(lon, lat, 0);
  const bottomLeft = Cartographic.toCartesian(planesCenter);

  // moves the center of slicing. Left down corner should be placed in the view center
  planesCenter.longitude = sliceRectWidth / 2 + planesCenter.longitude;
  planesCenter.latitude = sliceRectHeight / 2 + planesCenter.latitude;

  return {
    center: Cartographic.toCartesian(planesCenter),
    width: Cartesian3.distance(topLeft, bottomLeft),
    length: Cartesian3.distance(bottomRight, bottomLeft),
    height: SLICING_BOX_HEIGHT,
    corners: {
      bottomRight, bottomLeft, topRight, topLeft,
    }
  };
}
