import Cartesian3 from 'cesium/Core/Cartesian3.js';

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

/**
 * Show/hide accordion
 * @param evt
 */
export function onAccordionTitleClick(evt) {
  if (!evt.target.nextElementSibling) return;
  evt.target.classList.toggle('active');
  evt.target.nextElementSibling.classList.toggle('active');
}

export function onAccordionIconClick(evt) {
  const event = {...evt, target: evt.target.parentElement};
  onAccordionTitleClick(event);
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
