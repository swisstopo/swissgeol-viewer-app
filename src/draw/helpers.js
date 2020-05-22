import Cartesian2 from 'cesium/Core/Cartesian2';
import LabelStyle from 'cesium/Scene/LabelStyle';
import HeightReference from 'cesium/Scene/HeightReference';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Scene/HorizontalOrigin';
import i18next from 'i18next';

export function getDimensionLabelText(type, distances) {
  let text;
  if (type === 'rectangle') {
    text = `${distances[0]}km x ${distances[1]}km`;
  } else {
    const length = distances.reduce((a, b) => a + b, 0);
    text = `${i18next.t('Length')}: ${length}km`;
  }
  return text.includes('undefined') ? '' : text;
}

export function getDimensionLabel(type, distances) {
  return {
    text: getDimensionLabelText(type, distances),
    font: '8pt arial',
    style: LabelStyle.FILL,
    showBackground: true,
    heightReference: HeightReference.CLAMP_TO_GROUND,
    verticalOrigin: VerticalOrigin.BOTTOM,
    horizontalOrigin: HorizontalOrigin.RIGHT,
    pixelOffset: new Cartesian2(-5, -5),
    disableDepthTestDistance: Number.POSITIVE_INFINITY
  };
}
