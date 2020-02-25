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
 * Shows warning toast
 * @param {string} text - warning content
 * @param {number} timeout - timeout to close
 */
export function showWarning(text, timeout) {
  document.getElementById('ngm-warning-toast-content').innerText = text;
  document.getElementById('ngm-warning-toast').classList.toggle('visible');
  setTimeout(() => {
    document.getElementById('ngm-warning-toast').classList.toggle('visible');
  }, timeout ? timeout : 4000);
}
