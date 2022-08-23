import {
  Cartesian2,
  Cartesian3,
  LabelStyle,
  HeightReference,
  VerticalOrigin,
  HorizontalOrigin,

} from 'cesium';
import i18next from 'i18next';
import type {GeometryTypes} from '../toolbox/interfaces';

export function getDimensionLabelText(type: GeometryTypes, distances: number[]) {
  let text;
  if (type === 'rectangle') {
    text = `${Number(distances[0]).toFixed(3)}km x ${Number(distances[1]).toFixed(3)}km`;
  } else {
    const length = distances.reduce((a, b) => a + b, 0);
    text = `${i18next.t('obj_info_length_label')}: ${length}km`;
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


const scratchAB = new Cartesian3();
const scratchAC = new Cartesian3();
const scratchAM = new Cartesian3();
const scratchAP = new Cartesian3();
const scratchBP = new Cartesian3();

export function rectanglify(coordinates: Cartesian3[]) {
  if (coordinates.length === 3) {
    // A and B are the base of the triangle, C is the point currently moving:
    //
    // A -- AP
    // |\
    // | \
    // |  \
    // |   \
    // M    C
    // |
    // B -- BP

    const A = coordinates[0];
    const B = coordinates[1];
    const C = coordinates[2];

    // create the two vectors from the triangle coordinates
    const AB = Cartesian3.subtract(B, A, scratchAB);
    const AC = Cartesian3.subtract(C, A, scratchAC);

    const AM = Cartesian3.projectVector(AC, AB, scratchAM);

    const AP = Cartesian3.subtract(C, AM, scratchAP).clone();
    const BP = Cartesian3.add(AP, AB, scratchBP).clone();

    // FIXME: better memory management
    return [A, B, BP, AP];
  } else {
    return coordinates;
  }
}
