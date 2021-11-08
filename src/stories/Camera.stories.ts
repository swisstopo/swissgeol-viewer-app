import {html} from 'lit';
import '../style/index.css';
import '../elements/ngm-cam-coordinates';
import '../elements/ngm-cam-configuration';
import {Cartographic, Math as CesiumMath} from 'cesium';

export default {
  title: 'Components/NgmCamCoordinates',
};

const someCoordinates = {
  lv95: ['2’489’448', '848’116'],
  wgs84: [6.07, 43.78],
};

export const DefaultLV95 = () => html`
  <ngm-cam-coordinates .coordinates=${someCoordinates}></ngm-cam-coordinates>
`;


const viewer = {
  clock: {
    onTick: {
      addEventListener() {},
    }
  },
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
export const config = () => html`
  <ngm-cam-configuration
   .viewer=${viewer}
   class="ngm-floating-window">
  </ngm-cam-configuration>
`;
