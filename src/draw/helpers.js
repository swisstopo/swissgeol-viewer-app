import Cartesian2 from 'cesium/Core/Cartesian2';
import LabelStyle from 'cesium/Scene/LabelStyle';
import HeightReference from 'cesium/Scene/HeightReference';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Scene/HorizontalOrigin';
import NearFarScalar from 'cesium/Core/NearFarScalar';

export function getDimensionLabel(type, distances) {
  let farScaleDistance = 700000;
  const perimeter = distances.reduce((a, b) => a + b, 0);
  const perimeterM = perimeter * 1000;
  const near = perimeterM > 5000 ? perimeterM : 5000;
  if (distances && distances.length > 1) {
    farScaleDistance = near * distances.length;
  }
  let text;
  if (type === 'rectangle') {
    text = `${distances.join('km x ')}km`;
  } else {
    const dimensionType = type === 'polygon' ? 'Perimeter' : 'Length';
    text = `${dimensionType}: ${perimeter.toFixed(2)}km`;
  }

  return {
    text: text,
    font: '9pt arial',
    style: LabelStyle.FILL,
    showBackground: true,
    heightReference: HeightReference.CLAMP_TO_GROUND,
    verticalOrigin: VerticalOrigin.BOTTOM,
    horizontalOrigin: HorizontalOrigin.RIGHT,
    pixelOffset: new Cartesian2(-5, -5),
    scaleByDistance: new NearFarScalar(near, 1, farScaleDistance, 0.4),
    translucencyByDistance: new NearFarScalar(farScaleDistance, 1, farScaleDistance * 3, 0),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  };
}
