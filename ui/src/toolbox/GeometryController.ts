import MainStore from '../store/main';
import type {GeometryAction, OpenedGeometryOptions} from '../store/toolbox';
import ToolboxStore from '../store/toolbox';
import DrawStore from '../store/draw';
import {showBannerError, showSnackbarInfo} from '../notifications';
import i18next from 'i18next';
import {CesiumDraw, DrawEndDetails} from '../geoblocks/cesium-helpers/draw/CesiumDraw';
import type {Cartesian2, Event, exportKmlResultKml, Viewer} from 'cesium';

import {
  Cartographic,
  Color,
  CornerType,
  CustomDataSource,
  Entity,
  EntityCollection,
  exportKml,
  GpxDataSource,
  HeightReference,
  JulianDate,
  KmlDataSource,
  PropertyBag,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  VerticalOrigin
} from 'cesium';
import type {AreasCounter, GeometryTypes, NgmGeometry} from './interfaces';
import {extendKmlWithProperties, getValueOrUndefined} from '../geoblocks/cesium-helpers/cesiumutils';
import NavToolsStore from '../store/navTools';
import {
  flyToGeom,
  getAreaProperties,
  getUploadedEntityType,
  pauseGeometryCollectionEvents,
  updateEntityVolume
} from './helpers';
import {parseJson} from '../utils';
import {
  AVAILABLE_GEOMETRY_TYPES,
  DEFAULT_AOI_COLOR,
  GEOMETRY_LINE_ALPHA,
  GEOMETRY_POLYGON_ALPHA,
  HIGHLIGHTED_GEOMETRY_COLOR,
  POINT_SYMBOLS
} from '../constants';
import {saveAs} from 'file-saver';

export class GeometryController {
  private draw: CesiumDraw | undefined;
  private toastPlaceholder: HTMLElement;
  private viewer: Viewer | null = null;
  private unlistenEditPostRender: Event.RemoveCallback | undefined;
  private geometriesDataSource: CustomDataSource;
  private julianDate = new JulianDate();
  private selectedArea: Entity | undefined;
  private screenSpaceEventHandler: ScreenSpaceEventHandler | undefined;
  private geometriesCounter: AreasCounter = {
    line: 0,
    point: 0,
    rectangle: 0,
    polygon: 0
  };
  private noEdit: boolean;

  constructor(geometriesDataSource: CustomDataSource, toastPlaceholder: HTMLElement, noEdit = false) {
    this.geometriesDataSource = geometriesDataSource;
    this.toastPlaceholder = toastPlaceholder;
    this.noEdit = noEdit;

    MainStore.viewer.subscribe(viewer => {
      this.viewer = viewer;
      if (viewer) {
        this.screenSpaceEventHandler = new ScreenSpaceEventHandler(this.viewer!.canvas);
        this.screenSpaceEventHandler.setInputAction(this.onClick_.bind(this), ScreenSpaceEventType.LEFT_CLICK);
      } else if (this.screenSpaceEventHandler) {
        this.screenSpaceEventHandler.destroy();
      }
    });
    if (!this.noEdit) {
      ToolboxStore.geometryToCreate.subscribe(conf => {
        this.increaseGeometriesCounter(conf.type);
        this.addGeometry(conf);
      });
      DrawStore.draw.subscribe(draw => {
        if (draw) {
          this.draw = draw;
          this.draw.addEventListener('drawend', (evt) => this.endDrawing_((<CustomEvent>evt).detail));
          this.draw.addEventListener('drawerror', evt => {
            if (this.draw!.ERROR_TYPES.needMorePoints === (<CustomEvent>evt).detail.error) {
              showSnackbarInfo(i18next.t('tbx_error_need_more_points_warning'));
            }
          });
        }
      });
    }
    ToolboxStore.geometryAction.subscribe(options => this.handleActions(options));
    ToolboxStore.openedGeometryOptions.subscribe(options => this.selectGeometry(options));
  }

  onClick_(click) {
    if (!this.draw?.active && !DrawStore.measureState.value) {
      const pickedObject = this.viewer!.scene.pick(click.position);
      if (pickedObject && pickedObject.id) { // to prevent error on tileset click
        if (this.geometriesDataSource!.entities.contains(pickedObject.id)) {
          this.pickGeometry(pickedObject.id.id);
        }
      }
    }
  }

  endDrawing_(info: DrawEndDetails) {
    if (!this.draw) return;
    this.draw.active = false;
    this.draw.clear();

    const positions = info.positions;
    const measurements = info.measurements;
    const type = info.type;
    const attributes: NgmGeometry = {
      positions: positions,
      area: measurements.area?.toFixed(3),
      perimeter: measurements.perimeter?.toFixed(3),
      sidesLength: measurements.segmentsLength?.length > 1 ? [measurements.segmentsLength[0], measurements.segmentsLength[1]] : undefined,
      numberOfSegments: measurements.numberOfSegments,
      type: type,
      clampPoint: true
    };
    this.increaseGeometriesCounter(type);
    this.addGeometry(attributes);
  }

  cancelDraw() {
    if (!this.draw || (!this.draw.active)) return;
    this.draw.active = false;
    this.draw.clear();
    if (this.unlistenEditPostRender) {
      this.unlistenEditPostRender();
    }
  }

  selectGeometry(options: OpenedGeometryOptions | null) {
    if (!options || !options.id || options.editing) {
      this.deselectGeometry();
    } else if (options.id) {
      this.pickGeometry(options.id);
    }
  }

  deselectGeometry() {
    if (this.selectedArea) {
      this.updateHighlight(this.selectedArea, false);
      this.selectedArea = undefined;
    }
  }

  @pauseGeometryCollectionEvents
  private pickGeometry(id) {
    if (this.selectedArea && this.selectedArea.id === id) {
      return;
    }
    if (this.selectedArea) {
      this.deselectGeometry();
    }
    if (!id) return;
    this.selectedArea = this.geometriesDataSource!.entities.getById(id);
    this.updateHighlight(this.selectedArea, true);
  }

  private showHideGeometry(id, show) {
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (entity) entity.show = show;
  }
  @pauseGeometryCollectionEvents
  private showHideGeometryByType(show: boolean, noEditGeometries: boolean, type?: GeometryTypes) {
    if (noEditGeometries !== this.noEdit) return;
    this.geometriesDataSource!.entities.values.forEach(entity => {
      if (!type || getValueOrUndefined(entity.properties!.type) === type)
        entity.show = show;
    });
  }

  private removeGeometry(id) {
    if (this.noEdit) return;
    if (this.selectedArea && id === this.selectedArea.id)
      this.deselectGeometry();
    this.geometriesDataSource!.entities.removeById(id);
  }

  @pauseGeometryCollectionEvents
  private removeAllGeometries(noEditGeometries: boolean, type?: GeometryTypes) {
    if (noEditGeometries !== this.noEdit) return;
    const entities = [...this.geometriesDataSource!.entities.values];
    entities.forEach(entity => {
      if (!type || getValueOrUndefined(entity.properties!.type) === type) {
        this.removeGeometry(entity.id);
      }
    });
  }

  private onAddGeometry(type: GeometryTypes, clickEvent?: {position: Cartesian2}) {
    if (this.noEdit) return;
    const currentType = this.draw!.type;
    if (this.draw!.active) {
      this.cancelDraw();
      if (currentType === type) return;
    }
    this.draw!.type = type;
    this.draw!.active = true;
    if (clickEvent) {
      this.draw!.onLeftClick(clickEvent);
    }
  }

  @pauseGeometryCollectionEvents
  flyToGeometry(id) {
    const entity = this.geometriesDataSource!.entities.getById(id);
    if (!entity) return;
    NavToolsStore.hideTargetPoint();
    if (!entity.isShowing)
      entity.show = true;
    flyToGeom(this.viewer!.scene, entity);
    this.pickGeometry(id);
  }

  private async uploadFile(file: File | undefined) {
    if (!file || this.noEdit) return;
    const lowercaseName = file.name.toLowerCase();
    if (lowercaseName.endsWith('.kml')) {
      return this.uploadKml(file);
    } else if (lowercaseName.endsWith('.gpx')) {
      return this.uploadGpx(file);
    } else {
      showBannerError(this.toastPlaceholder, i18next.t('tbx_unsupported_file_warning'));
      return;
    }
  }

  async uploadKml(file) {
    const kmlDataSource = await KmlDataSource.load(file, {
      camera: this.viewer!.scene.camera,
      canvas: this.viewer!.scene.canvas,
      clampToGround: true
    });

    let entities = kmlDataSource.entities.values;
    if (entities.length > 10) {
      showBannerError(this.toastPlaceholder, i18next.t('tbx_kml_large_warning'));
      entities = entities.slice(0, 10);
    }
    let atLeastOneValid = false;
    entities.forEach(ent => {
      const exists = this.geometriesDataSource!.entities.getById(ent.id);
      if (!exists) {
        atLeastOneValid = this.addUploadedGeometry(ent, kmlDataSource.name);
      } else {
        atLeastOneValid = true;
        showBannerError(this.toastPlaceholder, i18next.t('tbx_kml_area_existing_warning'));
      }
    });

    if (!atLeastOneValid) {
      showBannerError(this.toastPlaceholder, i18next.t('tbx_unsupported_kml_warning'));
    } else {
      this.viewer!.zoomTo(entities);
    }
  }

  async uploadGpx(file) {
    const gpxDataSource: CustomDataSource = <any> await GpxDataSource.load(file, {
      clampToGround: true
    });
    const entities = gpxDataSource.entities.values;
    entities.forEach(entity => {
      if (!this.geometriesDataSource!.entities.getById(entity.id)) {
        this.addUploadedGeometry(entity, gpxDataSource.name);
      }
    });
  }

  /**
   * Adds entity to dataSource. Returns true if entity added.
   * @param entity
   * @param dataSourceName
   * @return {boolean}
   */
  addUploadedGeometry(entity, dataSourceName) {
    let type = getUploadedEntityType(entity);
    const extendedData = entity.kml && entity.kml.extendedData ? entity.kml.extendedData : {};
    Object.getOwnPropertyNames(extendedData).forEach(prop => {
      extendedData[prop] = parseJson(extendedData[prop].value) || extendedData[prop].value;
      if (extendedData[prop] === 'false' || extendedData[prop] === 'true') {
        extendedData[prop] = extendedData[prop] === 'true';
      }
    });
    if (extendedData.type && AVAILABLE_GEOMETRY_TYPES.includes(extendedData.type)) {
      type = extendedData.type;
    }
    if (type) {
      const attributes = {...extendedData, ...getAreaProperties(entity, type)};
      attributes.id = entity.id;
      if (entity.name) {
        attributes.name = entity.name;
      } else {
        attributes.name = entity.parent && entity.parent.name ? entity.parent.name : dataSourceName;
      }
      if (type === 'point') {
        // getValue doesn't work with julianDate for some reason
        const position = entity.position.getValue ? entity.position.getValue(new Date()) : entity.position;
        attributes.positions = [position];
        attributes.clampPoint = true;
        const billboard = entity.billboard;
        if (billboard) {
          attributes.color = billboard.color ? billboard.color.getValue(this.julianDate) : undefined;
          attributes.pointSymbol = billboard.image ? billboard.image.getValue(this.julianDate).url : undefined;
        }
      } else if (type === 'line') {
        attributes.positions = entity.polyline.positions;
        attributes.color = entity.polyline.material ? entity.polyline.material.getValue(this.julianDate).color : undefined;
      } else {
        attributes.positions = entity.polygon.hierarchy;
        attributes.color = entity.polygon.material ? entity.polygon.material.getValue(this.julianDate).color : undefined;
      }
      this.addGeometry(attributes);
      return true;
    }
    return false;
  }


  @pauseGeometryCollectionEvents
  updateHighlight(entity, selected) {
    if (!entity) return;
    if (entity.billboard) {
      if (selected) {
        entity.properties.colorBeforeHighlight = entity.billboard.color.getValue(this.julianDate);
        entity.billboard.color = HIGHLIGHTED_GEOMETRY_COLOR;
      } else {
        entity.billboard.color = entity.properties.colorBeforeHighlight;
        entity.properties.colorBeforeHighlight = undefined;
      }
      return;
    }
    const entityType = entity.polygon ? 'polygon' : 'polyline';
    if (entity.polylineVolume && entity.polylineVolume.show) {
      const color = selected ?
        HIGHLIGHTED_GEOMETRY_COLOR.withAlpha(GEOMETRY_POLYGON_ALPHA) :
        entity.properties.colorBeforeHighlight.withAlpha(GEOMETRY_POLYGON_ALPHA);
      entity.polylineVolume.material = color;
      entity.polylineVolume.outlineColor = color;
    }
    if (selected) {
      entity.properties.colorBeforeHighlight = entity[entityType].material.getValue(this.julianDate).color;
      entity[entityType].material = entity.polygon ?
        HIGHLIGHTED_GEOMETRY_COLOR.withAlpha(GEOMETRY_POLYGON_ALPHA) : HIGHLIGHTED_GEOMETRY_COLOR.withAlpha(GEOMETRY_LINE_ALPHA);
    } else {
      entity[entityType].material = entity.properties.colorBeforeHighlight;
      entity.properties.colorBeforeHighlight = undefined;
    }
  }

  increaseGeometriesCounter(type) {
    this.geometriesCounter[type] += 1;
  }

  handleActions(options: GeometryAction) {
    switch (options.action) {
      case 'show':
      case 'hide':
        this.showHideGeometry(options.id, options.action === 'show');
        break;
      case 'remove':
        this.removeGeometry(options.id);
        break;
      case 'zoom':
        this.flyToGeometry(options.id);
        break;
      case 'copy':
        this.copyGeometry(options.id);
        break;
      case 'hideAll':
      case 'showAll':
        this.showHideGeometryByType(options.action === 'showAll', !!options.noEditGeometries, options.type);
        break;
      case 'pick':
        this.pickGeometry(options.id);
        break;
      case 'downloadAll':
        this.downloadVisibleGeometries(!!options.noEditGeometries, options.type);
        break;
      case 'add':
        this.onAddGeometry(options.type!);
        break;
      case 'upload':
        this.uploadFile(options.file);
        break;
      case 'changeName':
        this.changeName(options.id!, options.newName!);
        break;
      case 'removeAll':
        this.removeAllGeometries(!!options.noEditGeometries, options.type);
        break;
    }
  }

  changeName(id: string, newName: string) {
    const entity = this.geometriesDataSource.entities.getById(id);
    if (entity) {
      entity.name = newName;
    }
  }

  @pauseGeometryCollectionEvents
  copyGeometry(id) {
    const entityToCopy = this.geometriesDataSource!.entities.getById(id);
    if (!entityToCopy) return;
    const properties = new PropertyBag();
    properties.merge(entityToCopy.properties);
    const newEntity = this.geometriesDataSource!.entities.add(new Entity({properties}));
    newEntity.merge(entityToCopy);
    newEntity.name = `${i18next.t('tbx_copy_of_label')}  ${entityToCopy.name}`;
    this.viewer!.scene.requestRender();
  }

  async downloadVisibleGeometries(noEditGeometries: boolean, type?: GeometryTypes) {
    if (noEditGeometries !== this.noEdit) return;
    const visibleGeometries = new EntityCollection();
    this.geometriesDataSource!.entities.values.forEach(ent => {
      if (ent.isShowing && (!type || type === getValueOrUndefined(ent.properties!.type))) {
        visibleGeometries.add(ent);
      }
    });
    const exportResult: exportKmlResultKml = <exportKmlResultKml> await exportKml({
      entities: visibleGeometries,
      time: this.julianDate
    });
    let kml: string = exportResult.kml;
    kml = extendKmlWithProperties(kml, visibleGeometries);
    const blob = new Blob([kml], {type: 'application/vnd.google-earth.kml+xml'});
    saveAs(blob, 'swissgeol_geometries.kml');
  }

  addGeometry(attributes: NgmGeometry) {
    const type = attributes.type;
    const name = type.charAt(0).toUpperCase() + type.slice(1);
    const entityAttrs: Entity.ConstructorOptions = {
      id: attributes.id || undefined,
      name: attributes.name || `${name} ${this.geometriesCounter[type]}`,
      show: attributes.show,
      properties: {
        area: attributes.area,
        perimeter: attributes.perimeter,
        numberOfSegments: attributes.numberOfSegments,
        sidesLength: attributes.sidesLength || [],
        type: type,
        volumeShowed: !!attributes.volumeShowed,
        volumeHeightLimits: attributes.volumeHeightLimits || null,
        description: attributes.description || '',
        image: attributes.image || '',
        website: attributes.website || '',
        editable: attributes.editable === undefined ? true : attributes.editable,
        copyable: attributes.copyable === undefined ? true : attributes.copyable,
      }
    };
    const color = attributes.color;
    if (type === 'point') {
      entityAttrs.position = attributes.positions[0];
      if (attributes.clampPoint) {
        const cartPosition = Cartographic.fromCartesian(entityAttrs.position);
        cartPosition.height = 0;
        entityAttrs.position = Cartographic.toCartesian(cartPosition);
      }
      entityAttrs.billboard = {
        image: attributes.pointSymbol || `./images/${POINT_SYMBOLS[0]}`,
        color: color ? new Color(color.red, color.green, color.blue) : DEFAULT_AOI_COLOR,
        scale: 0.5,
        verticalOrigin: VerticalOrigin.BOTTOM,
        disableDepthTestDistance: 0,
        heightReference: HeightReference.RELATIVE_TO_GROUND
      };
      entityAttrs.properties!.swissforagesId = attributes.swissforagesId;
      attributes.depth = attributes.depth || 400;
      entityAttrs.properties!.depth = attributes.depth;
      const height = Cartographic.fromCartesian(entityAttrs.position).height;
      entityAttrs.ellipse = {
        show: !!attributes.swissforagesId || !!attributes.volumeShowed,
        material: Color.GREY,
        semiMinorAxis: 40.0,
        semiMajorAxis: 40.0,
        extrudedHeight: height,
        height: height - attributes.depth,
        heightReference: HeightReference.RELATIVE_TO_GROUND,
        extrudedHeightReference: HeightReference.RELATIVE_TO_GROUND
      };
    } else {
      const material = color ?
        new Color(color.red, color.green, color.blue, GEOMETRY_POLYGON_ALPHA) :
        DEFAULT_AOI_COLOR.withAlpha(GEOMETRY_POLYGON_ALPHA);
      if (type === 'rectangle' || type === 'polygon') {
        entityAttrs.polygon = {
          show: true,
          hierarchy: <any>attributes.positions,
          material: material,
        };
        entityAttrs.properties!.showSlicingBox = attributes.showSlicingBox;
      } else if (type === 'line') {
        entityAttrs.polyline = {
          show: true,
          positions: attributes.positions,
          clampToGround: true,
          width: 4,
          material: color ?
            new Color(color.red, color.green, color.blue, GEOMETRY_LINE_ALPHA) :
            DEFAULT_AOI_COLOR.withAlpha(GEOMETRY_LINE_ALPHA),
        };
      }
      entityAttrs.polylineVolume = {
        cornerType: CornerType.MITERED,
        outline: true,
        outlineColor: material,
        material: material
      };
    }
    const entity = this.geometriesDataSource!.entities.add(entityAttrs);
    if (entityAttrs.properties!.volumeShowed) {
      updateEntityVolume(entity, this.viewer!.scene.globe);
    }
    return entity;
  }


  @pauseGeometryCollectionEvents
  setGeometries(geometries: NgmGeometry[]) {
    this.geometriesDataSource.entities.removeAll();
    geometries.forEach(geom => {
      if (!geom.positions) return;
      if (geom.name) {
        const splittedName = geom.name.split(' ');
        const areaNumber = Number(splittedName[1]);
        if (splittedName[0] !== 'Area' && !isNaN(areaNumber) && areaNumber > this.geometriesCounter[geom.type]) {
          this.geometriesCounter[geom.type] = areaNumber;
        }
      }
      this.addGeometry(geom);
    });
  }
}
