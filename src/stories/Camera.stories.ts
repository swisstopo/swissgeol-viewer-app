import {html} from 'lit';
import '../style/index.css';
import '../elements/ngm-cam-coordinates';
import '../elements/ngm-cam-configuration';

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

export const WGS84 = () => html`
  <ngm-cam-coordinates
    .coordinates=${someCoordinates}
    key="wgs84"
  >
  </ngm-cam-coordinates>
`;

export const config = () => html`
  <ngm-cam-configuration ></ngm-cam-configuration>
`;
