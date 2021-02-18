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
export function getOffsetFromBbox(primitive, bbox) {
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
 * Computes offset between two positions
 * @param {Cartesian3} position
 * @param {Cartesian3} targetPosition
 * @param {Cartesian3} planeNormal
 * @return {number}
 */
export function getPositionsOffset(position, targetPosition, planeNormal) {
  const diff = Cartesian3.subtract(position, targetPosition, new Cartesian3());
  const offset = Cartesian3.multiplyComponents(diff, planeNormal, new Cartesian3());
  return offset.x + offset.y + offset.z;
}

/**
 * Computes clipping plane for tileset from two points
 * @param {Cartesian3} start - segment start point
 * @param {Cartesian3} end - segment end point
 * @param {Rectangle} mapRect - cartographic limit rectangle
 * @param {Cartesian3} tileCenter - tileset center
 * @param {Cartesian3} mapPlaneNormal - globe plane normal (can be get using 'planeFromTwoPoints')
 * @return {module:cesium.ClippingPlane}
 */
export function getClippingPlaneFromSegment(start, end, tileCenter, mapRect, mapPlaneNormal) {
  const plane = new ClippingPlane(new Cartesian3(1, 0, 0), 0);
  // map vectors need for computation of plane rotation
  const mapNorthwest = Cartographic.toCartesian(Rectangle.northwest(mapRect));
  const mapSouthwest = Cartographic.toCartesian(Rectangle.southwest(mapRect));
  const mapNortheast = Cartographic.toCartesian(Rectangle.northeast(mapRect));
  const leftVector = Cartesian3.subtract(mapNorthwest, mapSouthwest, new Cartesian3());
  const topVector = Cartesian3.subtract(mapNorthwest, mapNortheast, new Cartesian3());

  // because of map not rectangular
  const mapCornerAngle = Cartesian3.angleBetween(topVector, leftVector);
  const angleOffset = Math.PI / 2 - mapCornerAngle;

  // computations depends on first point position according to second point
  let lineVector;
  // project start, end points in one axis for direction calculation
  const startXAxis = projectPointOntoVector(mapNorthwest, mapNortheast, start);
  const endXAxis = projectPointOntoVector(mapNorthwest, mapNortheast, end);
  // calculates the angle between map side and line (+ map offset for higher precision) and apply to the plane
  if (getDirectionFromPoints(startXAxis, endXAxis) < 0) {
    lineVector = Cartesian3.subtract(start, end, new Cartesian3());
    const angle = Cartesian3.angleBetween(lineVector, leftVector) + angleOffset;
    plane.normal.x = Math.cos(angle);
    plane.normal.y = Math.sin(angle);
  } else {
    lineVector = Cartesian3.subtract(end, start, new Cartesian3());
    const angle = Cartesian3.angleBetween(lineVector, leftVector) + angleOffset;
    plane.normal.x = -Math.cos(angle);
    plane.normal.y = -Math.sin(angle);
  }
  // calculate offset between tile center and line center
  const center = Cartesian3.midpoint(start, end, new Cartesian3());
  plane.distance = getPositionsOffset(tileCenter, center, mapPlaneNormal);

  return plane;
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
