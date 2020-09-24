import Color from 'cesium/Source/Core/Color';
import {
  AOI_DATASOURCE_NAME,
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  LAYER_TYPES,
  OBJECT_HIGHLIGHT_COLOR, OBJECT_ZOOMTO_RADIUS
} from '../constants';
import {extractEntitiesAttributes, extractPrimitiveAttributes, isPickable} from './objectInformation';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';

export default class ObjectSelector {
  /**
   *
   * @param {import('cesium/Source/Widgets/Viewer/Viewer.js').default} viewer
   */
  constructor(viewer) {
    this.viewer = viewer;

    /**
     * @type {import('cesium/Source/Scene/Scene.js').default}
     */
    this.scene = viewer.scene;

    this.selectedObj = null;
    this.savedColor = null;
  }


  pickAttributes(clickPosition, pickedPosition, object) {
    this.unhighlight();
    let attributes = null;
    if (!object) {
      const objects = this.scene.drillPick(clickPosition, DRILL_PICK_LIMIT, DRILL_PICK_LENGTH, DRILL_PICK_LENGTH);
      object = objects[0];
    }

    if (object) {
      if (!isPickable(object)) {
        return;
      }

      if (object.getPropertyNames) {
        attributes = extractPrimitiveAttributes(object);
        attributes.zoom = () => {
          const boundingSphere = new BoundingSphere(pickedPosition, OBJECT_ZOOMTO_RADIUS);
          const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, boundingSphere.radius);
          this.scene.camera.flyToBoundingSphere(boundingSphere, {
            duration: 0,
            offset: zoomHeadingPitchRange
          });
        };

        this.toggleTileHighlight(object);
      } else if (object.id && object.id.properties) {
        attributes = this.handleEntitySelect(object.id, attributes);
      }
      const onhide = () => {
        this.unhighlight();
      };
      attributes = {...attributes, onhide};
    }

    return attributes;
  }

  handleEntitySelect(entity, attributes) {
    const props = extractEntitiesAttributes(entity);
    attributes = {...props};
    const aoiDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
    const earthquakesDataSource = this.viewer.dataSources.getByName(LAYER_TYPES.earthquakes)[0];

    attributes.zoom = () => this.viewer.zoomTo(entity, props.zoomHeadingPitchRange);

    if (aoiDataSource.entities.contains(entity)) {
      attributes = {...attributes, name: entity.name};
      const aoiElement = document.querySelector('ngm-aoi-drawer');
      attributes = aoiElement.getInfoProps(attributes);
    } else if (earthquakesDataSource.entities.contains(entity)) {
      this.toggleEarthquakeHighlight(entity);
    }

    if (attributes.zoomHeadingPitchRange) {
      // Don't show the value in the object info window
      delete attributes.zoomHeadingPitchRange;
    }
    return attributes;
  }

  toggleEarthquakeHighlight(obj) {
    if (this.selectedObj && this.selectedObj.ellipsoid) {
      this.selectedObj.ellipsoid.material = this.savedColor;
      this.selectedObj = null;
    }
    if (obj) {
      this.selectedObj = obj;
      this.savedColor = Color.clone(obj.ellipsoid.material.color.getValue());
      this.selectedObj.ellipsoid.material = OBJECT_HIGHLIGHT_COLOR.withAlpha(this.savedColor.alpha);
    }
  }

  toggleTileHighlight(obj) {
    if (this.selectedObj && this.selectedObj.color) {
      this.selectedObj.color = this.savedColor;
      this.selectedObj = null;
    }
    if (obj) {
      this.selectedObj = obj;
      this.savedColor = Color.clone(obj.color);
      this.selectedObj.color = OBJECT_HIGHLIGHT_COLOR.withAlpha(obj.color.alpha);
    }
  }

  unhighlight() {
    this.toggleTileHighlight(null);
    this.toggleEarthquakeHighlight(null);
    this.scene.requestRender();
  }
}
