import Color from 'cesium/Core/Color';
import Cartesian2 from 'cesium/Core/Cartesian2';
import LabelStyle from 'cesium/Scene/LabelStyle';
import HeightReference from 'cesium/Scene/HeightReference';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Scene/HorizontalOrigin';
import NearFarScalar from 'cesium/Core/NearFarScalar';

export const getDimensionLabel = (text = '0km') => ({
  text: text,
  font: '9pt monospace',
  fillColor: Color.WHITE,
  style: LabelStyle.FILL,
  showBackground: true,
  backgroundColor: new Color(0.165, 0.165, 0.165, 0.5),
  heightReference: HeightReference.CLAMP_TO_GROUND,
  verticalOrigin: VerticalOrigin.BOTTOM,
  horizontalOrigin: HorizontalOrigin.RIGHT,
  pixelOffset: new Cartesian2(-5, -5),
  scaleByDistance: new NearFarScalar(20000, 0.9, 60000, 0.1),
  disableDepthTestDistance: Number.POSITIVE_INFINITY
});

export function getDimensionText(type, distances) {
  if (type === 'rectangle') {
    return `${distances.join('km x ')}km`;
  }
  const perimeter = distances.reduce((a, b) => a + b, 0);
  return `${perimeter.toFixed(2)}km`;
}
