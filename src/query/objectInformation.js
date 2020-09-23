import JulianDate from 'cesium/Source/Core/JulianDate';

export function extractPrimitiveAttributes(primitive) {
  const data = {};
  let propertyNames = primitive.getPropertyNames();
  const length = propertyNames.length;
  const properties = primitive.tileset.properties;
  const propsOrder = properties && properties.propsOrder ? properties.propsOrder : [];
  propertyNames = sortPropertyNames(propertyNames, propsOrder);
  for (let i = 0; i < length; ++i) {
    const key = propertyNames[i];
    const value = primitive.getProperty(key);
    if (typeof value === 'number' || !!value) {
      data[key] = value;
    }
  }
  return data;
}

export function isPickable(object) {
  if (object.tileset) {
    return object.tileset.pickable;
  } else if (object.primitive) {
    return object.primitive.allowPicking;
  } else {
    return false;
  }
}

export function extractEntitiesAttributes(entity) {
  if (!entity.properties) return;
  return {id: entity.id, ...entity.properties.getValue(JulianDate.fromDate(new Date()))};
}

function sortPropertyNames(propertyNames, propertiesOrder) {
  const lowerPriorityProps = propertyNames
    .filter(prop => !propertiesOrder.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      return titleLeft > titleRight ? 1 : titleLeft < titleRight ? -1 : 0;
    });
  return [...propertiesOrder, ...lowerPriorityProps];
}
