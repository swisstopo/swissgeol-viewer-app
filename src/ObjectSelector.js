import Color from 'cesium/Source/Core/Color';
import {AOI_DATASOURCE_NAME, DRILL_PICK_LENGTH, DRILL_PICK_LIMIT} from './constants';
import {extractEntitiesAttributes, extractPrimitiveAttributes, isPickable} from './objectInformation';
import BoundingSphere from 'cesium/Source/Core/BoundingSphere';
import HeadingPitchRange from 'cesium/Source/Core/HeadingPitchRange';
import ScreenSpaceEventType from 'cesium/Source/Core/ScreenSpaceEventType';

export default class ObjectSelector {
  constructor(viewer) {
    this.viewer = viewer;
    this.selectedObj = null;

    const objectInfo = document.querySelector('ngm-object-information');
    objectInfo.addEventListener('closed', () => {
      this.changeHighlight(null);
      viewer.scene.requestRender();
    });

    viewer.screenSpaceEventHandler.setInputAction(click => this.onClick(click), ScreenSpaceEventType.LEFT_CLICK);
  }

  onClick(click) {
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

        this.changeHighlight(object);
      } else if (object.id && object.id.properties) {
        const props = extractEntitiesAttributes(object.id);
        attributes = {...props};
        const aoiDataSource = this.viewer.dataSources.getByName(AOI_DATASOURCE_NAME)[0];
        attributes.zoom = () => this.viewer.zoomTo(object.id, props.zoomHeadingPitchRange);
        if (aoiDataSource.entities.contains(object.id)) {
          attributes = {...attributes, name: object.id.name};
          const aoiElement = document.querySelector('ngm-aoi-drawer');
          attributes = aoiElement.getInfoProps(attributes);
          attributes.zoom = () => aoiElement.flyToArea(object.id.id);
        } else if (attributes.zoomHeadingPitchRange) {
          // Don't show the value in the object info window
          delete attributes.zoomHeadingPitchRange;
        }

        // TODO highlight for earthquake
      }
    }

    objectInfo.info = attributes;
    objectInfo.opened = !!attributes;

    this.viewer.scene.requestRender();
  }

  changeHighlight(obj) {
    if (this.selectedObj) {
      this.selectedObj.color = Color.WHITE.withAlpha(this.selectedObj.color.alpha);
      this.selectedObj = null;
    }
    if (obj) {
      this.selectedObj = obj;
      const darkenMag = obj.color.alpha < 1 ? 0.6 : 0.3;
      this.selectedObj.color = Color.LIME.darken(darkenMag, new Color()).withAlpha(obj.color.alpha);
    }
  }
}
