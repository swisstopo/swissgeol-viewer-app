import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
} from 'cesium';
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  Observable,
  take,
} from 'rxjs';
import i18next from 'i18next';
import { BaseService } from 'src/services/base.service';
import { Layer, LayerType } from 'src/features/layer';
import {
  LayerInfoPicker,
  LayerPickData,
} from 'src/features/layer/info/pickers/layer-info-picker';
import { LayerInfoPickerForTiff } from 'src/features/layer/info/pickers/layer-info-picker-for-tiff';
import { LayerInfo } from 'src/features/layer/info/layer-info.model';
import { LayerService as NewLayerService } from 'src/features/layer/layer.service';
import { LayerInfoPickerForWmts } from 'src/features/layer/info/pickers/layer-info-picker-for-wmts';
import { LayerInfoPickerForVoxels } from 'src/features/layer/info/pickers/layer-info-picker-for-voxels';
import { LayerInfoPickerForTiles3d } from 'src/features/layer/info/pickers/layer-info-picker-for-tiles3d';
import DrawStore from 'src/store/draw';
import { Id } from 'src/models/id.model';
import { run, tick } from 'src/utils/fn.utils';
import { PickService } from 'src/services/pick.service';
import { LayerInfoPickerForEarthquakes } from 'src/features/layer/info/pickers/layer-info-picker-for-earthquakes';
import { CesiumService } from 'src/services/cesium.service';
import { LayerInfoPickerForGeoJson } from 'src/features/layer/info/pickers/layer-info-picker-for-geo-json';

export class LayerInfoService extends BaseService {
  private layerService!: NewLayerService;

  private pickService!: PickService;

  private readonly infosSubject = new BehaviorSubject<LayerInfo[]>([]);

  private readonly pickers: LayerInfoPicker[] = [];

  private viewer!: Viewer;

  private isPicking = false;

  private nextPick: [Cartesian2, Cartesian3] | null = null;

  constructor() {
    super();

    PickService.inject().then((pickService) => {
      this.pickService = pickService;
    });
    NewLayerService.inject().then((layerService) => {
      this.layerService = layerService;
      layerService.layerActivated$.subscribe(this.handleLayerActivated);
    });

    CesiumService.inject()
      .then((s) => firstValueFrom(s.viewer$))
      .then((viewer) => {
        this.viewer = viewer;
        const eventHandler = new ScreenSpaceEventHandler(this.viewer.canvas);
        eventHandler.setInputAction(
          async (event: ScreenSpaceEventHandler.PositionedEvent) => {
            if (DrawStore.drawStateValue) {
              return;
            }
            this.pick2d(event.position);
          },
          ScreenSpaceEventType.LEFT_CLICK,
        );
      });

    i18next.on('languageChanged', this.handleLanguageChanged);
  }

  get infos$(): Observable<readonly LayerInfo[]> {
    return this.infosSubject.asObservable();
  }

  private readonly handleLanguageChanged = (lang: string): void => {
    const infos = this.infosSubject.value;
    if (infos.length === 0) {
      return;
    }
    const refreshes = infos
      .filter((info) => info.refreshForLanguage != null)
      .map((info) => info.refreshForLanguage!(lang));
    if (refreshes.length === 0) {
      // Trigger re-emission so elements re-render with new translations.
      this.infosSubject.next([...infos]);
      return;
    }
    Promise.all(refreshes).then(() => {
      this.infosSubject.next([...infos]);
    });
  };

  pick2d(position: Cartesian2): void {
    const cartesian = this.pickService.pick(position);
    if (cartesian !== null) {
      this.pick3d(position, cartesian);
    }
  }

  pick3d(windowPosition: Cartesian2, globePosition: Cartesian3): void {
    if (this.isPicking) {
      this.nextPick = [windowPosition, globePosition];
      return;
    }
    this.isPicking = true;
    this.handlePick(windowPosition, globePosition).finally(() => {
      this.isPicking = false;
      if (this.nextPick !== null) {
        const pick = this.nextPick;
        this.nextPick = null;
        this.pick3d(...pick);
      }
    });
  }

  reset(): void {
    for (const info of this.infosSubject.value) {
      info.destroy();
    }
    this.infosSubject.next([]);
    this.viewer.scene.requestRender();
  }

  private readonly handleLayerActivated = (layerId: Id<Layer>): void => {
    const controller = this.layerService.controller(layerId)!;
    const picker = run(() => {
      switch (controller.type) {
        case LayerType.Wmts:
          return new LayerInfoPickerForWmts(controller, this.viewer);
        case LayerType.Tiles3d:
          return new LayerInfoPickerForTiles3d(controller, this.viewer);
        case LayerType.Voxel:
          return new LayerInfoPickerForVoxels(controller, this.viewer);
        case LayerType.Tiff:
          return new LayerInfoPickerForTiff(controller, this.viewer);
        case LayerType.Earthquakes:
          return new LayerInfoPickerForEarthquakes(controller, this.viewer);
        case LayerType.GeoJson:
          return new LayerInfoPickerForGeoJson(controller, this.viewer);
        default:
          return null;
      }
    });
    if (picker === null) {
      return;
    }

    this.pickers.push(picker);
    this.layerService.layerDeactivated$
      .pipe(
        filter((id) => id === layerId),
        take(1),
      )
      .subscribe(() => this.removePicker(picker));
  };

  private removePicker(picker: LayerInfoPicker): void {
    const i = this.pickers.findIndex((it) => it === picker);
    if (i < 0) {
      return;
    }
    this.pickers.splice(i, 1);
    const newInfos = this.infosSubject.value.reduce((infos, info) => {
      if (info.layerId === picker.layerId) {
        info.destroy();
      } else {
        infos.push(info);
      }
      return infos;
    }, [] as LayerInfo[]);
    this.infosSubject.next(newInfos);
    picker.destroy();
    this.viewer.scene.requestRender();
  }

  private async handlePick(
    windowPosition: Cartesian2,
    cartesian: Cartesian3,
  ): Promise<void> {
    const data: LayerPickData = {
      windowPosition,
      globePosition: {
        cartesian,
        cartographic: Cartographic.fromCartesian(cartesian),
      },
      distance: Cartesian3.distance(
        this.viewer.scene.camera.positionWC,
        cartesian,
      ),
    };

    this.viewer.canvas.style.cursor = 'progress';
    await tick();
    for (const info of this.infosSubject.value) {
      info.destroy();
    }
    const infos: LayerInfo[] = [];
    const picks = this.pickers.map(async (picker) => {
      try {
        const pickedInfos = await picker.pick(data);
        infos.push(...pickedInfos);
      } catch (e) {
        console.error(`Picking on ${picker.layerId} failed`, e);
      }
    });
    await Promise.all(picks);
    if (this.nextPick === null) {
      // If there is no next pick queued up, we can display the results.
      this.infosSubject.next(infos);
      this.viewer.canvas.style.cursor = 'default';
      this.viewer.scene.requestRender();
    } else {
      // If there is already a new pick queued, we simply destroy our results.
      // Without this, the results would be visibly for a short second and then be removed either way.
      for (const info of infos) {
        info.destroy();
      }
    }
  }
}
