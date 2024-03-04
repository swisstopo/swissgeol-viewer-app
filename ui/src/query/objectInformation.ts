import {JulianDate} from 'cesium';
import {getValueOrUndefined} from '../cesiumutils';

export function extractPrimitiveAttributes(primitive): [string, number][] {
  const data: [string, number][] = [];
  let propertyNames: string[] = primitive.getPropertyIds();
  const length = propertyNames.length;
  const properties = primitive.tileset.properties;
  const propsOrder = properties && properties.propsOrder ? properties.propsOrder : [];
  propertyNames = sortPropertyNames(propertyNames, propsOrder);
  for (let i = 0; i < length; ++i) {
    const key = propertyNames[i];
    const value = primitive.getProperty(key);
    if (typeof value === 'number' || !!value) {
      data.push([key, value]);
    }
  }
  return data;
}

export function isPickable(object) {
  if (object.tileset) {
    return object.tileset.pickable;
  } else if (object.primitive && object.primitive.allowPicking !== undefined) {
    return object.primitive.allowPicking;
  } else {
    return object.id && getValueOrUndefined(object.id.properties.type) === 'point';
  }
}

export function extractEntitiesAttributes(entity) {
  if (!entity.properties) return;
  return {id: entity.id, ...entity.properties.getValue(JulianDate.fromDate(new Date()))};
}

export function sortPropertyNames(propertyNames: string[], propertiesOrder: string[] = []): string[] {
  const lowerPriorityProps = propertyNames
    .filter(prop => !propertiesOrder.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      return titleLeft > titleRight ? 1 : titleLeft < titleRight ? -1 : 0;
    });
  return [...propertiesOrder, ...lowerPriorityProps];
}
