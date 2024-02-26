import {Cartesian2, HeightReference, HorizontalOrigin, LabelStyle, VerticalOrigin,} from 'cesium';
import type {GeometryTypes} from '../types';

function getDimensionLabelText(type: GeometryTypes, distances: number[]) {
  let text: string;
  if (type === 'rectangle') {
    text = `${Number(distances[0]).toFixed(3)}km x ${Number(distances[1]).toFixed(3)}km`;
  } else {
    const length = distances.reduce((a, b) => a + b, 0);
    text = `${length.toFixed(3)}km`;
  }
  return text.includes('undefined') ? '' : text;
}

export function getDimensionLabel(type: GeometryTypes, distances: number[]) {
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


