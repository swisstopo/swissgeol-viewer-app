import Color from 'cesium/Source/Core/Color';
import {AOI_DATASOURCE_NAME, DRILL_PICK_LENGTH, DRILL_PICK_LIMIT, LAYER_TYPES} from './constants';
import {extractEntitiesAttributes, extractPrimitiveAttributes, isPickable} from './objectInformation';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';

export default class ObjectSelector {
  constructor(viewer) {
    this.viewer = viewer;
    this.selectedObj = null;
    this.savedColor = null;

    const objectInfo = document.querySelector('ngm-object-information');
    objectInfo.addEventListener('closed', () => {
      this.unhighlight();
      viewer.scene.requestRender();
    });

    viewer.screenSpaceEventHandler.setInputAction(click => this.onClick(click), ScreenSpaceEventType.LEFT_CLICK);
  }

  onClick(click) {
    this.unhighlight();
    const objectInfo = document.querySelector('ngm-object-information');
    const objects = this.viewer.scene.drillPick(click.position, DRILL_PICK_LIMIT, DRILL_PICK_LENGTH, DRILL_PICK_LENGTH);
    const pickedPosition = this.viewer.scene.pickPosition(click.position);
    let attributes = null;

    if (objects.length > 0) {
      const object = objects[0];
      if (!isPickable(object)) {
        return;
      }

      if (object.getPropertyNames) {
        attributes = extractPrimitiveAttributes(object);
        attributes.zoom = () => {
          const boundingSphere = new BoundingSphere(pickedPosition, 500);
          const zoomHeadingPitchRange = new HeadingPitchRange(0, Math.PI / 8, boundingSphere.radius);
          this.viewer.scene.camera.flyToBoundingSphere(boundingSphere, {
            duration: 0,
            offset: zoomHeadingPitchRange
          });
        };

        this.toggleTileHighlight(object);
      } else if (object.id && object.id.properties) {
        attributes = this.handleEntitySelect(object.id, attributes);
      }
    }

    objectInfo.info = attributes;
    objectInfo.opened = !!attributes;

    this.viewer.scene.requestRender();
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
      attributes.zoom = () => aoiElement.flyToArea(entity.id);
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
      const darkenMag = this.savedColor.alpha < 1 ? 0.6 : 0.3;
      this.selectedObj.ellipsoid.material = Color.LIME.darken(darkenMag, new Color()).withAlpha(this.savedColor.alpha);
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
      const darkenMag = obj.color.alpha < 1 ? 0.6 : 0.3;
      this.selectedObj.color = Color.LIME.darken(darkenMag, new Color()).withAlpha(obj.color.alpha);
    }
  }

  unhighlight() {
    this.toggleTileHighlight(null);
    this.toggleEarthquakeHighlight(null);
  }
}
