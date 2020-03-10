import JulianDate from 'cesium/Core/JulianDate.js';

export function extractPrimitiveAttributes(primitive) {
  const data = {};
  const propertyNames = primitive.getPropertyNames();
  const length = propertyNames.length;
  for (let i = 0; i < length; ++i) {
    const key = propertyNames[i];
    const value = primitive.getProperty(key);
    data[key] = value;
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
  return entity.properties.getValue(JulianDate.fromDate(new Date()));
}
