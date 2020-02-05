import Math from 'cesium/Core/Math.js';
import Cartesian3 from 'cesium/Core/Cartesian3.js';

import {getURLSearchParams, setURLSearchParams} from './utils.js';

export function getCameraView() {
  let destination;
  let orientation;

  const params = getURLSearchParams();

  const lon = params.get('lon');
  const lat = params.get('lat');
  const elevation = params.get('elevation');
  if (lon !== null && lat !== null && elevation !== null) {
    destination = Cartesian3.fromDegrees(parseFloat(lon), parseFloat(lat), parseFloat(elevation));
  }
  const heading = params.get('heading');
  const pitch = params.get('pitch');
  if (heading !== null && pitch !== null) {
    orientation = {
      heading: Math.toRadians(parseFloat(heading)),
      pitch: Math.toRadians(parseFloat(pitch)),
      roll: 0
    };
  }
  return {destination, orientation};
}


export function syncCamera(camera) {
  camera.moveEnd.addEventListener(() => {
    const params = getURLSearchParams();
    const position = camera.positionCartographic;

    params.set('lon', Math.toDegrees(position.longitude).toFixed(5));
    params.set('lat', Math.toDegrees(position.latitude).toFixed(5));
    params.set('elevation', position.height.toFixed(0));
    params.set('heading', Math.toDegrees(camera.heading).toFixed(0));
    params.set('pitch', Math.toDegrees(camera.pitch).toFixed(0));

    setURLSearchParams(params);
  });
}
