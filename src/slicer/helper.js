import Cartographic from 'cesium/Source/Core/Cartographic';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import {
  getDirectionFromPoints,
  pickCenter,
  projectPointOntoVector,
} from '../cesiumutils';
import Rectangle from 'cesium/Source/Core/Rectangle';
import {SLICING_BOX_HEIGHT, SLICING_BOX_LOWER_LIMIT, SLICING_BOX_MIN_SIZE} from '../constants';
import ClippingPlane from 'cesium/Source/Scene/ClippingPlane';
import ClippingPlaneCollection from 'cesium/Source/Scene/ClippingPlaneCollection';
import {HeadingPitchRoll, Transforms} from 'cesium';
import {getPercent, interpolateBetweenNumbers} from '../utils';

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

const lVectorScratch = new Cartesian3();
const tVectorScratch = new Cartesian3();
const sliceVectorScratch = new Cartesian3();
const normalizedSVectorScratch = new Cartesian3();
const normalizedLVectorScratch = new Cartesian3();
const crossScratch = new Cartesian3();

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
  const plane = new ClippingPlane(Cartesian3.UNIT_X, 0);
  // map vectors need for computation of plane rotation
  const mapNorthwest = Cartographic.toCartesian(Rectangle.northwest(mapRect));
  const mapSouthwest = Cartographic.toCartesian(Rectangle.southwest(mapRect));
  const mapNortheast = Cartographic.toCartesian(Rectangle.northeast(mapRect));
  Cartesian3.subtract(mapNorthwest, mapSouthwest, lVectorScratch);
  Cartesian3.subtract(mapNorthwest, mapNortheast, tVectorScratch);

  // because of map not rectangular
  const mapCornerAngle = Cartesian3.angleBetween(tVectorScratch, lVectorScratch);
  const angleOffset = Math.PI / 2 - mapCornerAngle;

  // computations depends on first point position according to second point
  Cartesian3.subtract(start, end, sliceVectorScratch);

  Cartesian3.normalize(lVectorScratch, normalizedLVectorScratch);
  Cartesian3.normalize(sliceVectorScratch, normalizedSVectorScratch);
  let angle = Math.acos(Cartesian3.dot(normalizedLVectorScratch, normalizedSVectorScratch));
  Cartesian3.cross(lVectorScratch, sliceVectorScratch, crossScratch);
  if (Cartesian3.dot(plane.normal, crossScratch) < 0) {
    angle = -angle;
  }
  angle += angleOffset;
  plane.normal.x = Math.cos(angle);
  plane.normal.y = Math.sin(angle);
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
 * @param unionClippingRegions
 * @return {module:cesium.ClippingPlaneCollection}
 */
export function createClippingPlanes(planes, unionClippingRegions = true) {
  return new ClippingPlaneCollection({
    planes: planes,
    edgeWidth: 1.0,
    unionClippingRegions: unionClippingRegions
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
  let slicingCenter = Cartographic.fromCartesian(sceneCenter);
  const mapRect = viewer.scene.globe.cartographicLimitRectangle;
  slicingCenter.height = 0;

  // look for nearest point on map (left bottom corner should be placed in the view center)
  const mapRectSouthwest = Rectangle.southwest(mapRect);
  slicingCenter.longitude = slicingCenter.longitude < mapRectSouthwest.longitude ? mapRectSouthwest.longitude : slicingCenter.longitude;
  slicingCenter.latitude = slicingCenter.latitude < mapRectSouthwest.latitude ? mapRectSouthwest.latitude : slicingCenter.latitude;

  // check is slicing center placed on map otherwise use map center
  if (!Rectangle.contains(mapRect, slicingCenter)) {
    slicingCenter = Rectangle.center(mapRect);
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
  let northeastLon = slicingCenter.longitude + sliceRectWidth;
  let northeastLat = slicingCenter.latitude + sliceRectHeight;
  if (!Rectangle.contains(mapRect, Cartographic.fromRadians(northeastLon, northeastLat))) {
    northeastLon = northeastLon > mapRectNortheast.longitude ? mapRectNortheast.longitude : northeastLon;
    northeastLat = northeastLat > mapRectNortheast.latitude ? mapRectNortheast.latitude : northeastLat;
  }
  // Left bottom corner should be placed in the view center
  const bottomLeft = Cartographic.toCartesian(slicingCenter);
  const bottomRight = Cartesian3.fromRadians(northeastLon, slicingCenter.latitude, 0);
  const topLeft = Cartesian3.fromRadians(slicingCenter.longitude, northeastLat, 0);
  const topRight = Cartesian3.fromRadians(northeastLon, northeastLat, 0);
  const center = Cartesian3.midpoint(topLeft, bottomRight, new Cartesian3());
  const width = Cartesian3.distance(topLeft, bottomLeft);
  const length = Cartesian3.distance(bottomRight, bottomLeft);

  const cartCenter = Cartographic.fromCartesian(center);
  const altitude = viewer.scene.globe.getHeight(cartCenter) || 0;
  const area = (width / 1000) * (length / 1000);
  const {lowerLimit, height} = calculateBoxHeight(SLICING_BOX_HEIGHT, SLICING_BOX_LOWER_LIMIT, area, altitude);
  cartCenter.height = height / 2 + lowerLimit;

  return {
    center: Cartographic.toCartesian(cartCenter, null, center),
    width: width,
    length: length,
    height: height,
    lowerLimit: lowerLimit,
    altitude: altitude,
    corners: {
      bottomRight, bottomLeft, topRight, topLeft,
    }
  };
}


const mapNorthwestScratch = new Cartographic();
const mapNortheastScratch = new Cartographic();
const topVectorScratch = new Cartesian3();
const lineVectorScratch = new Cartesian3();

/**
 * Returns bbox for box slicing from rectangle positions
 * @param viewer
 * @param {Cartesian3[]} positions
 * @param {Number} [lowerLimit]
 * @param {Number} [height]
 * @return {{center: Cartesian3, width: number, length: number, height: number}}
 */
export function getBboxFromRectangle(viewer, positions, lowerLimit = SLICING_BOX_LOWER_LIMIT, height = SLICING_BOX_HEIGHT) {
  const cartographicPosition = positions.map(p => Cartographic.fromCartesian(p));

  // search for two positions with smallest longitude (left)
  const leftPositions = [cartographicPosition.reduce((a, b) => a.longitude < b.longitude ? a : b)];
  cartographicPosition.splice(cartographicPosition.indexOf(leftPositions[0]), 1);
  leftPositions.push(cartographicPosition.reduce((a, b) => a.longitude < b.longitude ? a : b));
  cartographicPosition.splice(cartographicPosition.indexOf(leftPositions[1]), 1);
  // two other is right
  const rightPosition = cartographicPosition;
  // set rectangle positions to bbox corners according to positions on map
  const sliceCorners = {
    topLeft: leftPositions[0].latitude > leftPositions[1].latitude ? leftPositions[0] : leftPositions[1],
    bottomLeft: leftPositions[0].latitude < leftPositions[1].latitude ? leftPositions[0] : leftPositions[1],
    topRight: rightPosition[0].latitude > rightPosition[1].latitude ? rightPosition[0] : rightPosition[1],
    bottomRight: rightPosition[0].latitude < rightPosition[1].latitude ? rightPosition[0] : rightPosition[1]
  };
  for (const key in sliceCorners) {
    sliceCorners[key].height = 0;
    sliceCorners[key] = Cartographic.toCartesian(sliceCorners[key]);
  }

  const center = Cartesian3.midpoint(sliceCorners.topLeft, sliceCorners.bottomRight, new Cartesian3());

  // calculate angle of rotation of rectangle according to map
  const mapRect = viewer.scene.globe.cartographicLimitRectangle;
  const mapNorthwest = Cartographic.toCartesian(Rectangle.northwest(mapRect, mapNorthwestScratch));
  const mapNortheast = Cartographic.toCartesian(Rectangle.northeast(mapRect, mapNortheastScratch));
  Cartesian3.subtract(mapNorthwest, mapNortheast, topVectorScratch);
  const startXAxis = projectPointOntoVector(mapNorthwest, mapNortheast, sliceCorners.topLeft);
  const endXAxis = projectPointOntoVector(mapNorthwest, mapNortheast, sliceCorners.bottomLeft);
  Cartesian3.subtract(sliceCorners.topLeft, sliceCorners.topRight, lineVectorScratch);
  const angle = Cartesian3.angleBetween(topVectorScratch, lineVectorScratch) * getDirectionFromPoints(startXAxis, endXAxis);

  const cartCenter = Cartographic.fromCartesian(center);
  const altitude = viewer.scene.globe.getHeight(cartCenter) || 0;
  const width = Cartesian3.distance(sliceCorners.topLeft, sliceCorners.bottomLeft);
  const length = Cartesian3.distance(sliceCorners.bottomRight, sliceCorners.bottomLeft);
  if (height === SLICING_BOX_HEIGHT && lowerLimit === SLICING_BOX_LOWER_LIMIT) {
    const area = (width / 1000) * (length / 1000);
    const zValues = calculateBoxHeight(height, lowerLimit, area);
    height = zValues.height;
    lowerLimit = zValues.lowerLimit;
  }
  lowerLimit += altitude;
  cartCenter.height = height / 2 + lowerLimit;

  return {
    center: Cartographic.toCartesian(cartCenter),
    width: width,
    length: length,
    height: height,
    lowerLimit: lowerLimit,
    altitude: altitude,
    corners: {
      bottomRight: sliceCorners.bottomRight,
      bottomLeft: sliceCorners.bottomLeft,
      topRight: sliceCorners.topRight,
      topLeft: sliceCorners.topLeft,
    },
    orientation: Transforms.headingPitchRollQuaternion(center, new HeadingPitchRoll(angle, 0, 0))
  };
}

/**
 * Moves box corners onMouse move
 * @param position1
 * @param position2
 * @param oppositePosition1
 * @param oppositePosition2
 * @param moveVector
 * @return {boolean}
 */
export function moveSlicingBoxCorners(position1, position2, oppositePosition1, oppositePosition2, moveVector) {
  let bothSideMove = false;
  const initialDistance = Cartesian3.distance(position1, oppositePosition1);
  Cartesian3.add(position1, moveVector, position1);
  Cartesian3.add(position2, moveVector, position2);
  const newDistance = Cartesian3.distance(position1, oppositePosition1);
  if (initialDistance > newDistance && newDistance < SLICING_BOX_MIN_SIZE) {
    Cartesian3.add(oppositePosition1, moveVector, oppositePosition1);
    Cartesian3.add(oppositePosition2, moveVector, oppositePosition2);
    bothSideMove = true;
  }
  return bothSideMove;
}

export function calculateBoxHeight(height, lowerLimit, area, altitude) {
  // values from https://jira.camptocamp.com/browse/GSNGM-567
  if (area <= 0.005) {
    height = 300;
    lowerLimit = -150;
  } else if (area < 25) {
    const p = getPercent(0.005, 25, area);
    height = interpolateBetweenNumbers(300, 10000, p);
    lowerLimit = interpolateBetweenNumbers(-150, -5000, p);
  }
  if (altitude) lowerLimit += altitude;
  return {lowerLimit, height};
}
