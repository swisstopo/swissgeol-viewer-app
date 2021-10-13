import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import Cartographic from 'cesium/Source/Core/Cartographic';
import CMath from 'cesium/Source/Core/Math';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import PolygonPipeline from 'cesium/Source/Core/PolygonPipeline';
import Transforms from 'cesium/Source/Core/Transforms';
import SceneTransforms from 'cesium/Source/Scene/SceneTransforms';
import {degreesToLv95} from './projection';
import Plane from 'cesium/Source/Core/Plane';
import HeadingPitchRoll from 'cesium/Source/Core/HeadingPitchRoll';
import Matrix3 from 'cesium/Source/Core/Matrix3';
import Rectangle from 'cesium/Source/Core/Rectangle';


/**
 * @param {import('cesium/Source/Scene/Camera').default} camera
 * @param {number} height Camera height in meters.
 */
export function setCameraHeight(camera, height) {
  const pc = camera.positionCartographic;
  camera.position = Cartesian3.fromRadians(pc.longitude, pc.latitude, height);
}

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
  const indices = PolygonPipeline.triangulate(positions, holes);
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
 * @param {Array<Cartesian3>} positions
 * @param {import('./draw/CesiumDraw').ShapeType} type
 */
export function getMeasurements(positions, type) {
  const distances = [];
  positions.forEach((p, key) => {
    if (key > 0) {
      distances.push(Cartesian3.distance(positions[key - 1], p) / 1000);
    }
  });
  const result = {
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
 * Returns window position of point on map
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Cartographic} cartographicPosition
 * @return {Cartesian2}
 */
export function convertCartographicToScreenCoordinates(scene, cartographicPosition) {
  const lon = CMath.toDegrees(cartographicPosition.longitude);
  const lat = CMath.toDegrees(cartographicPosition.latitude);
  return SceneTransforms.wgs84ToWindowCoordinates(scene, Cartesian3.fromDegrees(lon, lat, cartographicPosition.height));
}

/**
 * Returns x,y in lv95 or wsg84 and height relative to ground
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Cartographic} position
 * @param {'lv95' | 'wsg84'} coordinatesType
 * @param {boolean} useAltitude
 * @return {{x: number, y: number, height: number}}
 */
export function prepareCoordinatesForUi(scene, position, coordinatesType, useAltitude = false) {
  let x, y;
  const lon = CMath.toDegrees(position.longitude);
  const lat = CMath.toDegrees(position.latitude);
  if (coordinatesType === 'lv95') {
    const coords = degreesToLv95([lon, lat]);
    x = Math.round(coords[0]);
    y = Math.round(coords[1]);
  } else {
    x = Number(lon.toFixed(6));
    y = Number(lat.toFixed(6));
  }
  let altitude = 0;
  if (useAltitude) {
    altitude = scene.globe.getHeight(position) || 0;
  }
  const height = Math.round(position.height - altitude);
  return {x, y, height};
}

/**
 * Sets height in meters for each cartesian3 position in array
 * @param {Array<Cartesian3>} positions
 * @param {number} height
 * @param {import('cesium/Source/Scene/Scene').default} [scene]
 * @param {boolean} assignBack assign value to initial position
 * @return {Array<Cartesian3>}
 */
export function updateHeightForCartesianPositions(positions, height, scene, assignBack = false) {
  return positions.map(p => {
    const cartographicPosition = Cartographic.fromCartesian(p);
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
 * @param {Array<Entity>} entities - list of entities for export
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
