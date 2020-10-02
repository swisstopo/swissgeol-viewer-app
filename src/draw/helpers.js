import Cartesian2 from 'cesium/Source/Core/Cartesian2';
import LabelStyle from 'cesium/Source/Scene/LabelStyle';
import HeightReference from 'cesium/Source/Scene/HeightReference';
import VerticalOrigin from 'cesium/Source/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Source/Scene/HorizontalOrigin';
import i18next from 'i18next';

/**
 * @param {import('./CesiumDraw').ShapeType} type
 * @param {Array<number>} distances
 */
export function getDimensionLabelText(type, distances) {
  let text;
  if (type === 'rectangle') {
    text = `${Number(distances[0]).toFixed(3)}km x ${Number(distances[1]).toFixed(3)}km`;
  } else {
    const length = distances.reduce((a, b) => a + b, 0);
    text = `${i18next.t('obj_info_length_label')}: ${length}km`;
  }
  return text.includes('undefined') ? '' : text;
}

/**
 * @param {import('./CesiumDraw').ShapeType} type
 * @param {Array<number>} distances
 */
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
