export function extractPrimitiveAttributes(primitive) {
  if (!primitive) {
    return;
  }
  const data = {};
  if (primitive.getPropertyNames) {
    const propertyNames = primitive.getPropertyNames();
    const length = propertyNames.length;
    for (let i = 0; i < length; ++i) {
        const key = propertyNames[i];
        const value = primitive.getProperty(key);
        data[key] = value;
    }
  }
  return data;
}
