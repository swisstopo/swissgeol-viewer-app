import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import Cartesian3 from 'cesium/Source/Core/Cartesian3';
import CMath from 'cesium/Source/Core/Math';
import Matrix4 from 'cesium/Source/Core/Matrix4';
import PolygonPipeline from 'cesium/Source/Core/PolygonPipeline';
import Transforms from 'cesium/Source/Core/Transforms';


export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}

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
 * @param {function(import('cesium/Source/Scene/Camera').default): any} func
 */
export function aroundCenter(scene, func) {
  const camera = scene.camera;
  const windowPosition = new Cartesian2(
    scene.canvas.clientWidth / 2,
    scene.canvas.clientHeight / 2
  );
  const ray = camera.getPickRay(windowPosition);
  const center = scene.globe.pick(ray, scene);

  const transform = Transforms.eastNorthUpToFixedFrame(center !== undefined ? center : camera.positionWC);
  const oldTransform = Matrix4.clone(camera.transform);
  camera.lookAtTransform(transform);
  func(camera);
  camera.lookAtTransform(oldTransform);
}

/**
 * @return {URLSearchParams}
 */
export function getURLSearchParams() {
  return new URLSearchParams(location.search);
}

/**
 * @param {URLSearchParams} params
 */
export function setURLSearchParams(params) {
  window.history.replaceState({}, '', `${location.pathname}?${params}`);
}

/**
 * @param {string} id
 */
export function clickOnElement(id) {
  document.getElementById(id).click();
}

/**
 * Change element position in array
 * @param {Array} array target array
 * @param {number} fromIdx from index
 * @param {number} toIdx to index
 * @return {Array}
 */
export function insertAndShift(array, fromIdx, toIdx) {
  const cutOut = array.splice(fromIdx, 1)[0];
  array.splice(toIdx, 0, cutOut);
  return array;
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
 * @param {string} string
 * @return {string}
 */
export function escapeRegExp(string) {
  return string ? string.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&') : string;
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

    // These vectors define the sides of a parallelogram (double the size of the triangle)
    const vectorC = Cartesian3.subtract(vector2, vector1, new Cartesian3());
    const vectorD = Cartesian3.subtract(vector3, vector1, new Cartesian3());

    // Area of parallelogram is the cross product of the vectors defining its sides
    const areaVector = Cartesian3.cross(vectorC, vectorD, new Cartesian3());

    // Area of the triangle is just half the area of the parallelogram, add it to the sum.
    area += Cartesian3.magnitude(areaVector) / 2.0;
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
    result.area = (distances[0] * distances[1]).toFixed(2);
  }
  result.perimeter = perimeter.toFixed(2);
  if (type === 'polygon' && positions.length > 2) {
    result.area = getPolygonArea(positions).toFixed(2);
  }
  return result;
}
