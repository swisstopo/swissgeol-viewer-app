import {html} from 'lit';
import {until} from 'lit/directives/until.js';
import {setupI18n} from '../i18n';
import '../style/index.css';
import '../elements/ngm-cam-coordinates';
import '../elements/ngm-cam-configuration';
import {Math as CesiumMath, Cartesian3, HeadingPitchRoll, Rectangle, SingleTileImageryProvider, Viewer} from 'cesium';

const ready = setupI18n();

export default {
  title: 'Components/NgmCamConfiguration',
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

const el = document.createElement('div');
el.style.width = '50';
el.style.height = '50';
el.style.display = 'inline-block';
document.body.append(el);
const firstImageryProvider = new SingleTileImageryProvider({
  url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  rectangle: Rectangle.fromDegrees(0, 0, 1, 1) // the Rectangle dimensions are arbitrary
});

window['CESIUM_BASE_URL'] = '.';
const viewer = new Viewer(el, {
  imageryProvider: firstImageryProvider,
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  vrButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  navigationInstructionsInitiallyVisible: false,
  scene3DOnly: true,
  skyBox: false,
  useBrowserRecommendedResolution: true,
  requestRenderMode: true,
});
viewer.scene.camera.setView({
  destination: Cartesian3.fromDegrees(6.07, 43.78, 30000),
  orientation: new HeadingPitchRoll(
    CesiumMath.toRadians(40),
    CesiumMath.toRadians(-20),
    0
  ),
});

export const config = whenReady(() => html`
  <ngm-cam-configuration
   .viewer=${viewer}
   class="ngm-floating-window">
  </ngm-cam-configuration>
`);
