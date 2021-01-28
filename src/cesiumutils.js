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
 * @param {Array<number>} distances
 * @param {import('./draw/CesiumDraw').ShapeType} type
 */
export function getMeasurements(positions, distances, type) {
  const result = {
    segmentsNumber: positions.length
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
 * @param {import('cesium/Source/Scene/Scene.js').default} scene
 * @param {Array<Cartesian3>} positions
 * @param {number} height
 * @return {Array<Cartesian3>}
 */
export function updateHeightForCartesianPositions(scene, positions, height) {
  return positions.map(p => {
    const cartographicPosition = Cartographic.fromCartesian(p);
    const altitude = scene.globe.getHeight(cartographicPosition) || 0;
    cartographicPosition.height = height + altitude;
    return Cartographic.toCartesian(cartographicPosition);
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
  const center = Cartesian3.midpoint(point1, point2, new Cartesian3());
  const cartographicPoint1 = Cartographic.fromCartesian(point1);
  const cartographicPoint2 = Cartographic.fromCartesian(point2);
  // for correct tilt
  cartographicPoint1.height = cartographicPoint1.height + 10000;
  cartographicPoint2.height = cartographicPoint2.height - 10000;
  const cartPoint1 = Cartographic.toCartesian(cartographicPoint1);
  const cartPoint2 = Cartographic.toCartesian(cartographicPoint2);
  const vector1 = Cartesian3.subtract(center, cartPoint1, new Cartesian3());
  const vector2 = Cartesian3.subtract(cartPoint2, cartPoint1, new Cartesian3());
  const cross = Cartesian3.cross(vector1, vector2, new Cartesian3());
  const normal = Cartesian3.normalize(cross, new Cartesian3());
  if (negate) {
    Cartesian3.negate(normal, normal);
  }
  return Plane.fromPointNormal(center, normal);
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
