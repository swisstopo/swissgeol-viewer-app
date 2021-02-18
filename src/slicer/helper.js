import Cartographic from 'cesium/Source/Core/Cartographic';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {getDirectionFromPoints, pickCenter, projectPointOntoVector} from '../cesiumutils';
import Rectangle from 'cesium/Source/Core/Rectangle';
import {SLICING_BOX_HEIGHT} from '../constants';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';

/**
 * @param primitive
 * @param bbox
 * @return {Cartesian3}
 */
export function getOffsetForPrimitive(primitive, bbox) {
  const primitiveCenter = primitive.boundingSphere.center;
  const corners = bbox.corners;
  const tileCenterAxisX = projectPointOntoVector(corners.topLeft, corners.topRight, primitiveCenter);
  const centerAxisX = Cartesian3.midpoint(corners.topLeft, corners.topRight, new Cartesian3());
  const x = Cartesian3.distance(centerAxisX, tileCenterAxisX) * getDirectionFromPoints(centerAxisX, tileCenterAxisX);

  const tileCenterAxisY = projectPointOntoVector(corners.bottomRight, corners.topRight, primitiveCenter);
  const centerAxisY = Cartesian3.midpoint(corners.bottomRight, corners.topRight, new Cartesian3());
  const y = Cartesian3.distance(centerAxisY, tileCenterAxisY) * getDirectionFromPoints(tileCenterAxisY, centerAxisY);

  let z;
  const transformCenter = Matrix4.getTranslation(primitive.root.transform, new Cartesian3());
  const transformCartographic = Cartographic.fromCartesian(transformCenter);
  if (transformCartographic) {
    z = transformCartographic.height;
  } else {
    const boundingSphereCartographic = Cartographic.fromCartesian(primitive.boundingSphere.center);
    z = boundingSphereCartographic.height;
  }
  return new Cartesian3(x, y, z * -1);
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
  const sceneCenter = pickCenter(viewer.scene);
  let viewCenter = Cartographic.fromCartesian(sceneCenter);
  const mapRect = viewer.scene.globe.cartographicLimitRectangle;
  viewCenter.height = 0;

  // look for nearest point on map
  const mapRectSouthwest = Rectangle.southwest(mapRect);
  viewCenter.longitude = viewCenter.longitude < mapRectSouthwest.longitude ? mapRectSouthwest.longitude : viewCenter.longitude;
  viewCenter.latitude = viewCenter.latitude < mapRectSouthwest.latitude ? mapRectSouthwest.latitude : viewCenter.latitude;

  // check is slicing center placed on map otherwise use map center
  if (!Rectangle.contains(mapRect, viewCenter)) {
    viewCenter = Rectangle.center(mapRect);
  }
  // use map rectangle if view too big
  let viewRect = viewer.scene.camera.computeViewRectangle();
  if (viewRect.width > mapRect.width || viewRect.height > mapRect.height) {
    viewRect = mapRect;
  }
  // get extreme points of the map
  const mapRectNortheast = Rectangle.northeast(mapRect);
  const sliceRectWidth = ratio * viewRect.width;
  const sliceRectHeight = ratio * viewRect.height;
  let northeastLon = viewCenter.longitude + sliceRectWidth;
  let northeastLat = viewCenter.latitude + sliceRectHeight;
  if (!Rectangle.contains(mapRect, Cartographic.fromRadians(northeastLon, northeastLat))) {
    northeastLon = northeastLon > mapRectNortheast.longitude ? mapRectNortheast.longitude : northeastLon;
    northeastLat = northeastLat > mapRectNortheast.latitude ? mapRectNortheast.latitude : northeastLat;
  }
  // Left bottom corner should be placed in the view center
  const bottomLeft = Cartographic.toCartesian(viewCenter);
  const bottomRight = Cartesian3.fromRadians(northeastLon, viewCenter.latitude, 0);
  const topLeft = Cartesian3.fromRadians(viewCenter.longitude, northeastLat, 0);
  const topRight = Cartesian3.fromRadians(northeastLon, northeastLat, 0);
  const center = Cartesian3.midpoint(topLeft, bottomRight, new Cartesian3());

  return {
    center: center,
    width: Cartesian3.distance(topLeft, bottomLeft),
    length: Cartesian3.distance(bottomRight, bottomLeft),
    height: SLICING_BOX_HEIGHT,
    corners: {
      bottomRight, bottomLeft, topRight, topLeft,
    }
  };
}
