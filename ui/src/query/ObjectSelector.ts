import {
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  GEOMETRY_DATASOURCE_NAME,
  NO_EDIT_GEOMETRY_DATASOURCE_NAME,
  OBJECT_HIGHLIGHT_COLOR,
  OBJECT_ZOOMTO_RADIUS,
} from '../constants';
import {
  extractEntitiesAttributes,
  extractPrimitiveAttributes,
  extractVoxelAttributes,
  isPickable,
  sortPropertyNames,
} from './objectInformation';
import type { Cartesian2, Cartesian3, Scene, Viewer } from 'cesium';
import { VoxelCell } from 'cesium';
import {
  BoundingSphere,
  Color,
  ColorMaterialProperty,
  HeadingPitchRange,
  Math as CMath,
} from 'cesium';
import NavToolsStore from '../store/navTools';
import type { QueryResult } from './types';

/**
 * Wether the passed value follows the lit TemplateResult interface.
 * @param {unknown} value
 * @return {boolean}
 */
function isTemplateResult(value) {
  return typeof value === 'object' && value.strings && value.values;
}

export default class ObjectSelector {
  private readonly viewer: Viewer;
  private readonly scene: Scene;
  selectedObj: any | null = null; // todo improve types
  savedColor: Color | null = null;

  constructor(viewer) {
    this.viewer = viewer;
    this.scene = viewer.scene;
  }

  getObjectAtPosition(position: Cartesian2) {
    let object: any | VoxelCell | undefined;
    object = this.scene.pickVoxel(position);
    if (object) {
      return object;
    }
    const slicerDataSource = this.viewer.dataSources.getByName('slicer')[0];
    const objects = this.scene.drillPick(
      position,
      DRILL_PICK_LIMIT,
      DRILL_PICK_LENGTH,
      DRILL_PICK_LENGTH,
    );
    object = objects[0];
    // selects second object if first is entity related to slicing box and next is not related to slicing box
    if (object && object.id && slicerDataSource.entities.contains(object.id)) {
      object = undefined;
      if (
        objects[1] &&
        (!objects[1].id || !slicerDataSource.entities.contains(objects[1].id))
      ) {
        object = objects[1];
      }
    }
    return object;
  }

  pickAttributes(
    clickPosition: Cartesian2,
    pickedPosition: Cartesian3,
    object: any,
  ) {
    this.unhighlight();
    let attributes: QueryResult = {};
    if (!object) {
      object = this.getObjectAtPosition(clickPosition);
    }

    if (object) {
      if (!isPickable(object)) {
        return;
      }
      if (object.getPropertyIds) {
        attributes.properties = extractPrimitiveAttributes(object);
        attributes.zoom = () => {
          NavToolsStore.hideTargetPoint();
          const boundingSphere = new BoundingSphere(
            pickedPosition,
            OBJECT_ZOOMTO_RADIUS,
          );
          const zoomHeadingPitchRange = new HeadingPitchRange(
            0,
            Math.PI / 8,
            boundingSphere.radius,
          );
          this.scene.camera.flyToBoundingSphere(boundingSphere, {
            duration: 0,
            offset: zoomHeadingPitchRange,
          });
        };

        this.toggleTileHighlight(object);
      } else if (object instanceof VoxelCell) {
        attributes.properties = extractVoxelAttributes(object);
        attributes.zoom = () => {
          NavToolsStore.hideTargetPoint();
          const boundingSphere = BoundingSphere.fromOrientedBoundingBox(
            object.orientedBoundingBox,
          ); // new BoundingSphere(pickedPosition, OBJECT_ZOOMTO_RADIUS);
          const zoomHeadingPitchRange = new HeadingPitchRange(
            0,
            CMath.toRadians(-90.0),
            boundingSphere.radius * 3,
          );
          this.scene.camera.flyToBoundingSphere(boundingSphere, {
            duration: 0,
            offset: zoomHeadingPitchRange,
          });
        };
        this.toggleTileHighlight(object);
      } else if (object.id) {
        attributes = this.handleEntitySelect(object.id, attributes);
        if (!attributes) {
          return;
        }
      }
      const onhide = () => {
        this.unhighlight();
      };
      attributes = { ...attributes, onhide };
    }

    return attributes;
  }

  handleEntitySelect(entity, attributes) {
    const props = extractEntitiesAttributes(entity);
    if (!props) return null;
    const orderedProps = sortPropertyNames(
      Object.keys(props),
      props.propsOrder,
    );
    attributes.properties = orderedProps.map((key) => [key, props[key]]);
    const geomDataSource = this.viewer.dataSources.getByName(
      GEOMETRY_DATASOURCE_NAME,
    )[0];
    const noEditGeomDataSource = this.viewer.dataSources.getByName(
      NO_EDIT_GEOMETRY_DATASOURCE_NAME,
    )[0];
    const earthquakesDataSources = this.viewer.dataSources
      .getByName('earthquakes')
      .concat(this.viewer.dataSources.getByName('historical_earthquakes'));

    attributes.zoom = () =>
      this.viewer.zoomTo(entity, props.zoomHeadingPitchRange);

    if (
      geomDataSource.entities.contains(entity) ||
      noEditGeomDataSource.entities.contains(entity)
    ) {
      return { geomId: props.id };
    } else if (
      earthquakesDataSources.some((e) => e.entities.contains(entity))
    ) {
      this.toggleEarthquakeHighlight(entity);
    }

    attributes.properties = attributes.properties.filter(
      (value) =>
        typeof value[1] === 'number' ||
        (typeof value[1] === 'string' && value[1].match(/[A-Z0-9]/gi)) || // 'match' uses to avoid empty strings with strange symbols
        isTemplateResult(value[1]),
    );

    return attributes;
  }

  toggleEarthquakeHighlight(obj) {
    if (this.selectedObj && this.selectedObj.ellipsoid) {
      this.selectedObj.ellipsoid.material = new ColorMaterialProperty(
        this.savedColor!,
      );
      this.selectedObj = null;
    }
    if (obj) {
      this.selectedObj = obj;
      this.savedColor = Color.clone(obj.ellipsoid.material.color.getValue());
      this.selectedObj!.ellipsoid!.material = new ColorMaterialProperty(
        OBJECT_HIGHLIGHT_COLOR.withAlpha(this.savedColor!.alpha),
      );
    }
  }

  toggleTileHighlight(obj) {
    if (this.selectedObj && this.selectedObj.color) {
      this.selectedObj.color = this.savedColor;
      this.selectedObj = null;
    }
    if (!obj) return;
    if (obj instanceof VoxelCell) {
      const { customShader } = obj.primitive;
      // todo remove when voxel picking released
      // @ts-ignore
      customShader.setUniform('u_selectedTile', obj.tileIndex);
      customShader.setUniform('u_selectedSample', obj.sampleIndex);
    } else {
      this.selectedObj = obj;
      this.savedColor = Color.clone(obj.color);
      this.selectedObj.color = OBJECT_HIGHLIGHT_COLOR.withAlpha(
        obj.color.alpha,
      );
    }
  }

  unhighlight() {
    this.toggleTileHighlight(null);
    this.toggleEarthquakeHighlight(null);
    this.scene.requestRender();
  }
}
