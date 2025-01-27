import { JulianDate, VoxelCell } from 'cesium';
import { PickableVoxelPrimitive } from '../layers/helpers';
import { getValueOrUndefined } from '../cesiumutils';
import i18next from 'i18next';
import { formatCartesian3AsLv95 } from '../projection';
import { voxelLayerToFilter } from '../layertree';

export function extractPrimitiveAttributes(primitive): [string, number][] {
  const data: [string, number][] = [];
  let propertyNames: string[] = primitive.getPropertyIds();
  const length = propertyNames.length;
  const properties = primitive.tileset.properties;
  const propsOrder =
    properties && properties.propsOrder ? properties.propsOrder : [];
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

export function extractVoxelAttributes(
  voxelCell: VoxelCell,
): [string, number | string][] {
  const cellCenter = voxelCell.orientedBoundingBox.center;
  const propertyNames: string[] = voxelCell.getNames();
  const primitive: PickableVoxelPrimitive = voxelCell.primitive;
  const layer = primitive.layer;
  const attributes: [string, number][] = propertyNames.map((name) => {
    const value = voxelCell.getProperty(name);
    if (layer && voxelLayerToFilter[layer]) {
      const filters = voxelLayerToFilter[layer];
      if (name === filters.lithologyDataName) {
        const label = filters.lithology.find(
          (f) => f.index === value[0],
        )?.label;
        return [
          i18next.t('vox_filter_lithology'),
          label
            ? i18next.t(label)
            : i18next.t('vox_filter_undefined_lithology'),
        ];
      }
      if (name === filters.conductivityDataName) {
        const valueOrUndefined =
          value[0] <= -9999
            ? i18next.t('vox_filter_undefined_lithology')
            : value;
        return [
          i18next.t('vox_filter_hydraulic_conductivity'),
          valueOrUndefined,
        ];
      }
    }
    if (name === 'Temp_C') {
      return [i18next.t('vox_temperature'), value];
    }
    return [name, value];
  });
  return [
    ...attributes,
    [
      i18next.t('vox_cell_center'),
      formatCartesian3AsLv95(cellCenter).join(', '),
    ],
  ];
}

export function isPickable(object) {
  if (object.tileset) {
    return object.tileset.pickable;
  } else if (
    !(object instanceof VoxelCell) &&
    object.primitive &&
    object.primitive.allowPicking !== undefined
  ) {
    return object.primitive.allowPicking;
  } else if (object instanceof VoxelCell) {
    const voxelPrimitive: PickableVoxelPrimitive = object.primitive;
    return voxelPrimitive && voxelPrimitive.pickable;
  } else {
    return (
      object.id && getValueOrUndefined(object.id?.properties?.type) === 'point'
    );
  }
}

export function extractEntitiesAttributes(entity) {
  if (!entity.properties) return;
  return {
    id: entity.id,
    ...entity.properties.getValue(JulianDate.fromDate(new Date())),
  };
}

export function sortPropertyNames(
  propertyNames: string[],
  propertiesOrder: string[] = [],
): string[] {
  const lowerPriorityProps = propertyNames
    .filter((prop) => !propertiesOrder.includes(prop))
    .sort((left, right) => {
      const titleLeft = left.toLowerCase();
      const titleRight = right.toLowerCase();
      if (titleLeft === titleRight) {
        return 0;
      }
      return titleLeft > titleRight ? 1 : -1;
    });
  return [...propertiesOrder, ...lowerPriorityProps];
}
