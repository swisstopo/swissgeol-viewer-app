import type {Camera, Scene, Viewer} from 'cesium';
import {
  BoundingSphere,
  Cartesian2,
  Cartesian3,
  Cartographic,
  HeadingPitchRoll,
  JulianDate,
  Math as CMath,
  Matrix3,
  Matrix4,
  OrientedBoundingBox,
  Plane,
  Rectangle,
  Transforms
} from 'cesium';
import type {NgmGeometry} from './toolbox/interfaces';
import earcut from 'earcut';

const julianDate = new JulianDate();

/**
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @param {boolean} useCamera
 * @param {function(import('cesium/Source/Scene/Camera').default): any} func
 */
export function aroundCenter(scene, useCamera, func) {
  const camera = scene.camera;
  const center = useCamera ? camera.positionWC : pickCenter(scene);
  console.assert(center !== undefined);
  const transform = Transforms.eastNorthUpToFixedFrame(center);
  const oldTransform = Matrix4.clone(camera.transform);
  camera.lookAtTransform(transform);
  func(camera);
  camera.lookAtTransform(oldTransform);
}

/**
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @return {Cartesian3}
 */
export function pickCenter(scene) {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  const ray = camera.getPickRay(windowPosition);
  const center = scene.globe.pick(ray, scene);
  return center !== undefined ? center : camera.positionWC;
}

/**
 * Return the position of the point, on the ellipsoid at the center of the Cesium viewport.
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @return {Cartesian3 | undefined}
 */
export function pickCenterOnEllipsoid(scene) {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  return camera.pickEllipsoid(windowPosition);
}

/**
 * Return the position of the point, on the map or object at the center of the Cesium viewport.
 * @param {import('cesium/Source/Scene/Scene').default} scene
 * @return {Cartesian3 | undefined}
 */
export function pickCenterOnMapOrObject(scene) {
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  return scene.pickPosition(windowPosition);
}

/**
 * @param {import('cesium/Source/Scene/Camera').default} camera
 * @param {number} angle
 */
export function verticalDirectionRotate(camera, angle) {
  const position = Cartesian3.normalize(camera.position, new Cartesian3());
  const up = Cartesian3.normalize(camera.up, new Cartesian3());

  const pitch = CMath.toDegrees(camera.pitch);
  if (pitch < -90 || pitch > 0) {
    angle = -angle;
  }

  const tangent = Cartesian3.cross(up, position, new Cartesian3());
  camera.rotate(tangent, angle);
}

/**
 * @param {Array<Cartesian3>} positions
 * @param {Array<number>} [holes]
 * @return {number}
 */
function getPolygonArea(positions, holes = []) {
  const indices = triangulate(positions, holes);
  let area = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const vector1 = positions[indices[i]];
    const vector2 = positions[indices[i + 1]];
    const vector3 = positions[indices[i + 2]];
    //triangle sides
    const a = Cartesian3.distance(vector3, vector2);
    const b = Cartesian3.distance(vector1, vector3);
    const c = Cartesian3.distance(vector1, vector2);
    const p = (a + b + c) / 2;
    const triangleArea = Math.sqrt((p - a) * (p - b) * (p - c) * p);

    area += triangleArea;
  }
  return area * Math.pow(10, -6);
}

/**
 * Returns measurements for geometry
 */
export function getMeasurements(positions, type) {
  const distances: number[] = [];
  positions.forEach((p, key) => {
    if (key > 0) {
      distances.push(Cartesian3.distance(positions[key - 1], p) / 1000);
    }
  });
  const result: NgmGeometry = {
    positions: positions,
    type: type,
    numberOfSegments: positions.length
  };
  let perimeter = distances.reduce((a, b) => a + b, 0);
  if (type === 'rectangle') {
    perimeter *= 2;
    result.sidesLength = [distances[0], distances[1]];
  }
  result.perimeter = perimeter.toFixed(3);
  if (type === 'rectangle' || (type === 'polygon' && positions.length > 2)) {
    result.area = getPolygonArea(positions).toFixed(3);
  }
  return result;
}

/**
 * Sets height in meters for each cartesian3 position in array
 * @param {Array<Cartesian3>} positions
 * @param {number | undefined} height
 * @param {import('cesium/Source/Scene/Scene').default} [scene]
 * @param {boolean} assignBack assign value to initial position
 * @return {Array<Cartesian3>}
 */
export function updateHeightForCartesianPositions(positions, height, scene?, assignBack = false) {
  return positions.map(p => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    if (height)
      cartographicPosition.height = height;
    if (scene) {
      const altitude = scene.globe.getHeight(cartographicPosition) || 0;
      cartographicPosition.height += altitude;
    }
    return assignBack ? Cartographic.toCartesian(cartographicPosition, undefined, p) : Cartographic.toCartesian(cartographicPosition);
  });
}

/**
 * Creates a straight plane that troughs two provided points
 * @param {Cartesian3} point1
 * @param {Cartesian3} point2
 * @param {boolean} negate - if true changes direction from left on the right
 * @return {Plane}
 */
export function planeFromTwoPoints(point1, point2, negate = false) {
  const p1p2 = Cartesian3.subtract(point2, point1, new Cartesian3());
  const cross = Cartesian3.cross(point1, p1p2, new Cartesian3());
  const normal = Cartesian3.normalize(cross, new Cartesian3());
  if (negate) {
    Cartesian3.negate(normal, normal);
  }
  return Plane.fromPointNormal(point1, normal);
}

/**
 * @param {import('cesium/Source/Core/Cartesian3').default} cartesian
 * @return {Array<number>}
 */
export function cartesianToDegrees(cartesian) {
  const cartographic = Cartographic.fromCartesian(cartesian);
  return [
    cartographic.longitude * 180 / Math.PI,
    cartographic.latitude * 180 / Math.PI,
    cartographic.height
  ];
}

/**
 * Extend kml for export with entities properties
 * @param {string} kml - kml for export
 * @param {EntityCollection} entities - list of entities for export
 * @return {string}
 */
export function extendKmlWithProperties(kml, entities) {
  entities.values.forEach(entity => {
    let kmlProperties = '<ExtendedData>';
    entity.properties.propertyNames.forEach(prop => {
      let value = entity.properties[prop] ? entity.properties[prop].getValue() : undefined;
      if (value !== undefined && value !== null) {
        value = typeof value === 'object' ? JSON.stringify(value) : value;
        kmlProperties += `<Data name="${prop}"><value>${value}</value></Data>`;
      }
    });
    kmlProperties += '</ExtendedData>';
    const placemark = `<Placemark id="${entity.id}">`;
    kml = kml.replace(placemark, `${placemark}${kmlProperties}`);
  });
  return kml;
}


const scratchVector1 = new Cartesian3();
const scratchVector2 = new Cartesian3();
const scratchProjectionVector = new Cartesian3();

/**
 * Calculates point projection on vector from provided points
 * @param vectorPoint1
 * @param vectorPoint2
 * @param pointToProject
 * @param result
 * @return {Cartesian3}
 */
export function projectPointOntoVector(vectorPoint1, vectorPoint2, pointToProject, result = new Cartesian3()) {
  Cartesian3.subtract(vectorPoint2, vectorPoint1, scratchVector1);
  Cartesian3.subtract(pointToProject, vectorPoint1, scratchVector2);
  Cartesian3.projectVector(scratchVector2, scratchVector1, scratchProjectionVector);
  return Cartesian3.add(vectorPoint1, scratchProjectionVector, result);
}

const minDifferenceScratch = new Cartesian3();
const maxDifferenceScratch = new Cartesian3();

/**
 * Wrapper for Cartesian3.lerp. Computes position on segment.
 * @param position
 * @param minPosition
 * @param maxPosition
 * @param start
 * @param end
 */
export function clampPosition(position, minPosition, maxPosition, start, end) {
  let distanceScalar = start;
  const minDifference = Cartesian3.subtract(minPosition, position, minDifferenceScratch);
  const min = minDifference.x + minDifference.y + minDifference.z;
  if (min > 0) {
    const maxDifference = Cartesian3.subtract(maxPosition, position, maxDifferenceScratch);
    const max = maxDifference.x + maxDifference.y + maxDifference.z;
    if (max < 0) {
      const maxDistance = Cartesian3.distance(minPosition, maxPosition);
      const distance = Cartesian3.distance(minPosition, position);
      distanceScalar = distance / maxDistance;
      distanceScalar = CMath.clamp(distanceScalar, start, end);
    } else {
      distanceScalar = end;
    }
  }
  Cartesian3.lerp(minPosition, maxPosition, distanceScalar, position);
}

/**
 * @param {Cartesian3} point
 * @param {Cartesian3} startPoint
 * @param {Cartesian3} endPoint
 * @param {number} start - The value corresponding to point at 0.0.
 * @param {number} end - The value corresponding to point at 1.0.
 * @param {number} height - height in meters
 * @return {Cartesian3}
 */
export function projectPointOnSegment(point, startPoint, endPoint, start, end, height) {
  const position = projectPointOntoVector(startPoint, endPoint, point);
  clampPosition(position, startPoint, endPoint, start, end);
  return updateHeightForCartesianPositions([position], height)[0];
}

/**
 * Gets distance to point in percentage and returns cartesian position on the line
 *
 * @param linePositions
 * @param ratio - distance to point in percentage (value from 0 to 1 where 0 first point of the line and 1 is last)
 * @param result
 */
export function getPointOnPolylineByRatio(linePositions: Cartesian3[], ratio: number, result) {
  let indx, segmentRatio = 0;
  const distances = linePositions.map((pos, indx) => {
    if (indx === 0) return 0;
    return Cartesian3.distance(linePositions[indx - 1], pos);
  });
  const distance = distances.reduce((partialSum, a) => partialSum + a, 0);
  const distanceToPoint = distance * ratio;
  let currDist = 0, prevDist = 0;
  for (let i = 1; i < distances.length; i++) {
    currDist += distances[i];
    if (distanceToPoint > prevDist && distanceToPoint <= currDist) {
      const d1 = currDist - prevDist;
      const d2 = distanceToPoint - prevDist;
      segmentRatio = d2 / d1;
      indx = i;
      break;
    }
    prevDist = currDist;
  }

  return indx > 0 ?
    Cartesian3.clone(
      projectPointOnSegment(result, linePositions[indx - 1], linePositions[indx], segmentRatio, segmentRatio, 0),
      result
    ) : linePositions[0];
}

const axisScratch = new Cartesian3();

/**
 * Returns 1 if 'to' point on left-bottom side of 'from' point or -1 if vice-versa
 * @param {Cartesian3} from
 * @param {Cartesian3} to
 * @return {number}
 */
export function getDirectionFromPoints(from, to) {
  const axisVect = Cartesian3.subtract(from, to, axisScratch);
  const direction = axisVect.x + axisVect.y + axisVect.z;
  return Math.round((1 / direction) * Math.abs(direction));
}

const westPointScratch = new Cartesian3();
const eastPointScratch = new Cartesian3();

/**
 * Returns vector orthogonal to view vector (vector from camera position to position on map)
 * https://user-images.githubusercontent.com/51954170/108503213-abff8580-72bc-11eb-8b75-3385b5fd171e.png
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @return {Cartesian3}
 */
export function getVectorOrthogonalToView(viewer) {
  const hpr = new HeadingPitchRoll(viewer.scene.camera.heading, 0.0, 0.0);
  const rotation = Matrix3.fromHeadingPitchRoll(hpr);
  const viewRect = viewer.scene.camera.computeViewRectangle();

  const northwest = Cartographic.toCartesian(Rectangle.northwest(viewRect));
  const southwest = Cartographic.toCartesian(Rectangle.southwest(viewRect));
  const northeast = Cartographic.toCartesian(Rectangle.northeast(viewRect));
  const southeast = Cartographic.toCartesian(Rectangle.southeast(viewRect));

  Cartesian3.midpoint(northwest, southwest, westPointScratch);
  Cartesian3.midpoint(northeast, southeast, eastPointScratch);
  const viewVect = Cartesian3.subtract(eastPointScratch, westPointScratch, new Cartesian3());
  return Matrix3.multiplyByVector(rotation, viewVect, viewVect);
}

/**
 * Returns left,right points of view rectangle
 * @param {import('cesium/Source/Widgets/Viewer/Viewer').default} viewer
 * @return {Array<Cartesian3>}
 */
export function getOrthogonalViewPoints(viewer) {
  const center = pickCenterOnEllipsoid(viewer.scene);
  const left = new Cartesian3();
  const right = new Cartesian3();
  const orthogonalVector = getVectorOrthogonalToView(viewer);

  Cartesian3.divideByScalar(orthogonalVector, 2, orthogonalVector);
  Cartesian3.subtract(center, orthogonalVector, left);
  Cartesian3.add(center, orthogonalVector, right);
  return updateHeightForCartesianPositions([left, right], 0);
}

export function getValueOrUndefined(prop) {
  return prop ? prop.getValue() : undefined;
}

/**
 * Makes the camera look towards a specific point without changing its location
 * @param position
 * @param camera
 */
export function lookAtPoint(position: Cartesian3, camera: Camera) {
  const cameraPosition = camera.position.clone();
  let direction = Cartesian3.subtract(
    position,
    cameraPosition,
    new Cartesian3()
  );
  direction = Cartesian3.normalize(direction, direction);
  camera.direction = direction;

  // get an "approximate" up vector, which in this case we want to be something like the geodetic surface normal.
  const approxUp = Cartesian3.normalize(
    cameraPosition,
    new Cartesian3()
  );

  // cross view direction with approxUp to get a right normal
  let right = Cartesian3.cross(
    direction,
    approxUp,
    new Cartesian3()
  );
  right = Cartesian3.normalize(right, right);
  camera.right = right;

  // cross right with view direction to get an orthonormal up
  let up = Cartesian3.cross(
    right,
    direction,
    new Cartesian3()
  );
  up = Cartesian3.normalize(up, up);
  camera.up = up;
}

/**
 * @param {Entity} entity
 * @return {Color}
 */
export function getEntityColor(entity) {
  if (entity.billboard) {
    return entity.billboard.color.getValue(julianDate);
  } else if (entity.polyline) {
    return entity.polyline.material.getValue(julianDate).color;
  } else if (entity.polygon) {
    return entity.polygon.material.getValue(julianDate).color;
  }
}

/**
 * Checks is point lies within the polygon
 * @param point
 * @param polygonPositions
 */
export function pointInPolygon(point: Cartographic, polygonPositions: Cartographic[]): boolean {
  let inside = false;
  for (let i = 0, j = polygonPositions.length - 1; i < polygonPositions.length; j = i++) {
    const xi = polygonPositions[i].longitude, yi = polygonPositions[i].latitude;
    const xj = polygonPositions[j].longitude, yj = polygonPositions[j].latitude;

    const intersect = ((yi > point.latitude) !== (yj > point.latitude))
      && (point.longitude < (xj - xi) * (point.latitude - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Triangulate a polygon.
 *
 * @param {Cartesian2[]} positions Cartesian2 array containing the vertices of the polygon
 * @param {Number[]} [holes] An array of the staring indices of the holes.
 * @returns {Number[]} Index array representing triangles that fill the polygon
 */
export function triangulate(positions, holes) {
  const flattenedPositions = Cartesian2.packArray(positions);
  return earcut(flattenedPositions, holes, 2);
}


const scratchBoundingSphere: BoundingSphere = new BoundingSphere();
const scratchPosition = new Cartesian3();
const moveVector3dScratch = new Cartesian3();
const axisVector3dScratch = new Cartesian3();

/**
 * Gets Cartesian3 position and distance in pixels and calculates second Cartesian3 position on passed axes and side
 *
 * @param scene
 * @param firstPoint cartesian3 position of known point
 * @param distancePx distance between points in pixels
 * @param axis configures on which axis second points should be placed (x or y axis according to map rectangle)
 * @param side configures where second point will be placed (left/right or above/below first point)
 */
export function positionFromPxDistance(scene: Scene, firstPoint: Cartesian3, distancePx: number, axis: 'x' | 'y', side: 1 | -1) {
  const mapRect = scene.globe.cartographicLimitRectangle;
  scratchBoundingSphere.center = firstPoint;
  const pixelSize = scene.camera.getPixelSize(scratchBoundingSphere, scene.drawingBufferWidth, scene.drawingBufferHeight);
  const distance = distancePx * pixelSize;
  let corners;
  if (axis === 'y') {
    corners = [Cartographic.toCartesian(Rectangle.northeast(mapRect)), Cartographic.toCartesian(Rectangle.southeast(mapRect))];
  } else {
    corners = [Cartographic.toCartesian(Rectangle.northwest(mapRect)), Cartographic.toCartesian(Rectangle.northeast(mapRect))];
  }
  Cartesian3.midpoint(corners[0], corners[1], scratchPosition);
  const pos = projectPointOnSegment(firstPoint, corners[0], corners[1], 0, 1, 0);
  Cartesian3.subtract(pos, scratchPosition, axisVector3dScratch);
  const scalar3d = distance / Cartesian3.distance(pos, scratchPosition) * side;
  Cartesian3.multiplyByScalar(axisVector3dScratch, scalar3d, moveVector3dScratch);
  return Cartesian3.add(firstPoint, moveVector3dScratch, new Cartesian3());
}

/**
 * Checks is geometry of part of geometry inside viewport
 */
export function isGeometryInViewport(viewer: Viewer, positions: Cartesian3[]): boolean {
  const camera = viewer.camera;
  const frustum = camera.frustum;
  const cullingVolume = frustum.computeCullingVolume(
    camera.position,
    camera.direction,
    camera.up
  );

  return cullingVolume.computeVisibility(OrientedBoundingBox.fromPoints(positions)) !== -1;
}
