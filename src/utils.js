import Cartesian3 from 'cesium/Core/Cartesian3.js';
import CMath from 'cesium/Core/Math';


export async function readTextFile(url) {
  const response = await fetch(url);
  try {
    return await response.text();
  } catch (e) {
    console.warn(e);
  }
}

/**
 * @param {import('cesium/Scene/Camera').default} camera
 * @param {number} height Camera height in meters.
 */
export function setCameraHeight(camera, height) {
  const pc = camera.positionCartographic;
  camera.position = Cartesian3.fromRadians(pc.longitude, pc.latitude, height);
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


export function onAccordionClick(evt) {
  let target = evt.target;
  while (!target.classList.contains('title')) {
    target = target.parentElement;
  }
  if (!target.nextElementSibling) return;
  target.classList.toggle('active');
  target.nextElementSibling.classList.toggle('active');
}

/**
 * Change element position in array
 * array - target array
 * fromIdx - from index
 * toIdx - to index
 */
export function insertAndShift(array, fromIdx, toIdx) {
  const cutOut = array.splice(fromIdx, 1)[0];
  array.splice(toIdx, 0, cutOut);
  return array;
}

export function verticalDirectionRotate(camera, angle) {
  const position = Cartesian3.normalize(camera.position, new Cartesian3());
  const direction = Cartesian3.normalize(camera.direction, new Cartesian3());

  const angleBetween = Number(Cartesian3.angleBetween(position, direction).toFixed(2));
  if (angleBetween >= 3.14) {
    angle = -angle;
  }

  const tangent = Cartesian3.cross(direction, position, new Cartesian3());
  camera.rotate(tangent, angle);
}
