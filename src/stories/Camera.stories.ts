import {html} from 'lit';
import {until} from 'lit/directives/until.js';
import {setupI18n} from '../i18n';
import '../style/index.css';
import '../elements/ngm-cam-coordinates';
import '../elements/ngm-cam-configuration';
import {Cartographic, Clock, Math as CesiumMath} from 'cesium';

const ready = setupI18n();

export default {
  title: 'Components/NgmCamCoordinates',
};

const someCoordinates = {
  lv95: ['2’489’448', '848’116'],
  wgs84: [6.07, 43.78],
};

function whenReady(partial) {
  // to render translated text, we need to wait for the i18next promise to be resolved
  return () => html`${until(ready.then(partial), html`<div>loading...</div>`)}`;
}

export const DefaultLV95 = whenReady(() => html`
  <ngm-cam-coordinates
    .coordinates=${someCoordinates}>
  </ngm-cam-coordinates>`);

const viewer = {
  clock: new Clock(),
  scene: {
    canvas: {
      clientHeight: 130,
      clientWidth: 130,
    },
    screenSpaceCameraController: {},
    camera: {
      pitch: CesiumMath.toRadians(-50),
      heading: CesiumMath.toRadians(80),
      setView: function() {},
      lookAtTransform: function() {},
      positionCartographic: Cartographic.fromDegrees(6.07, 43.78, 30000),
      setCameraHeight: function() {},
    },
    globe: {
      getHeight() {
        return 0;
      },
    },
    postRender: {
      addEventListener() {
        return function() {};
      },
    },
  }
};
export const config = whenReady(() => html`
  <ngm-cam-configuration
   .viewer=${viewer}
   class="ngm-floating-window">
  </ngm-cam-configuration>
`);
