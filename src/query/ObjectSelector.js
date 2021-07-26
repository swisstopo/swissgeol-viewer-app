import Color from 'cesium/Source/Core/Color';
import {
  AOI_DATASOURCE_NAME,
  DRILL_PICK_LENGTH,
  DRILL_PICK_LIMIT,
  OBJECT_HIGHLIGHT_COLOR, OBJECT_ZOOMTO_RADIUS
} from '../constants';
import {
  extractEntitiesAttributes,
  extractPrimitiveAttributes,
  isPickable,
  sortPropertyNames
} from './objectInformation';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import {TemplateResult} from 'lit-element';

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
    let attributes = {};
    if (!object) {
      const slicerDataSource = this.viewer.dataSources.getByName('slicer')[0];
      const objects = this.scene.drillPick(clickPosition, DRILL_PICK_LIMIT, DRILL_PICK_LENGTH, DRILL_PICK_LENGTH);
      object = objects[0];
      // selects second object if first is entity related to slicing box and next is not related to slicing box
      if (object && object.id && slicerDataSource.entities.contains(object.id)) {
        object = undefined;
        if (objects[1] && (!objects[1].id || !slicerDataSource.entities.contains(objects[1].id))) {
          object = objects[1];
        }
      }
    }

    if (object) {
      if (!isPickable(object)) {
        return;
      }
      if (object.getPropertyNames) {
        attributes.properties = extractPrimitiveAttributes(object);
        attributes.zoom = () => {
          const boundingSphere = new BoundingSphere(pickedPosition, OBJECT_ZOOMTO_RADIUS);
          const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, boundingSphere.radius);
          this.scene.camera.flyToBoundingSphere(boundingSphere, {
            duration: 0,
            offset: zoomHeadingPitchRange
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
      attributes = {...attributes, onhide};
    }

    return attributes;
  }

  handleEntitySelect(entity, attributes) {
    const props = extractEntitiesAttributes(entity);
    if (!props) return null;
    const orderedProps = sortPropertyNames(Object.keys(props), props.propsOrder);
    attributes.properties = orderedProps.map((key) => [key, props[key]]);
    const aoiDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
    const earthquakesDataSources = this.viewer.dataSources.getByName('earthquakes').concat(
      this.viewer.dataSources.getByName('historical_earthquakes'));

    attributes.zoom = () => this.viewer.zoomTo(entity, props.zoomHeadingPitchRange);

    if (aoiDataSource.entities.contains(entity)) {
      const aoiElement = document.querySelector('ngm-aoi-drawer');
      attributes = aoiElement.getInfoProps({...props, name: entity.name});
    } else if (earthquakesDataSources.some((e) => e.entities.contains(entity))) {
      this.toggleEarthquakeHighlight(entity);
    }

    attributes.properties = attributes.properties.filter(value =>
      typeof value[1] === 'number'
      || (typeof value[1] === 'string' && value[1].match(/[A-Z0-9]/gi)) // 'match' uses to avoid empty strings with strange symbols
      || (typeof value[1] === 'object' && value[1] instanceof TemplateResult)); // for lit-element templates like links or images

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
    const aoiElement = document.querySelector('ngm-aoi-drawer');
    aoiElement.deselectArea();
    this.scene.requestRender();
  }
}
