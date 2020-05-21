import Cartesian2 from 'cesium/Core/Cartesian2';
import LabelStyle from 'cesium/Scene/LabelStyle';
import HeightReference from 'cesium/Scene/HeightReference';
import VerticalOrigin from 'cesium/Scene/VerticalOrigin';
import HorizontalOrigin from 'cesium/Scene/HorizontalOrigin';
import i18next from 'i18next';
import PolygonPipeline from 'cesium/Core/PolygonPipeline';
import Cartesian3 from 'cesium/Core/Cartesian3';

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

function getPolygonArea(positions, holes = []) {
  const indices = PolygonPipeline.triangulate(positions, holes);
  let area = 0;

  for (let i = 0; i < indices.length; i += 3) {
    const vector1 = positions[indices[i]];
    const vector2 = positions[indices[i + 1]];
    const vector3 = positions[indices[i + 2]];

    // These vectors define the sides of a parallelogram (double the size of the triangle)
    const vectorC = Cartesian3.subtract(vector2, vector1, new Cartesian3());
    const vectorD = Cartesian3.subtract(vector3, vector1, new Cartesian3());

    // Area of parallelogram is the cross product of the vectors defining its sides
    const areaVector = Cartesian3.cross(vectorC, vectorD, new Cartesian3());

    // Area of the triangle is just half the area of the parallelogram, add it to the sum.
    area += Cartesian3.magnitude(areaVector) / 2.0;
  }
  return area * Math.pow(10, -6);
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

export function getMeasurements(positions, distances, type) {
  console.log(positions);
  const result = {
    segmentsNumber: positions.length
  };
  let perimeter = distances.reduce((a, b) => a + b, 0);
  if (type === 'rectangle') {
    perimeter *= 2;
    result.sidesLength = [distances[0], distances[1]];
    result.area = (distances[0] * distances[1]).toFixed(2);
  }
  result.perimeter = perimeter.toFixed(2);
  if (type === 'polygon' && positions.length > 2) {
    result.area = getPolygonArea(positions).toFixed(2);
  }
  return result;
}
