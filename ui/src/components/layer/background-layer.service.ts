import {BaseService} from 'src/utils/base.service';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {makeTranslationKey} from 'src/models/translation-key.model';
import {Id, makeId} from 'src/models/id.model';
import {BehaviorSubject, combineLatest, map, Observable, shareReplay} from 'rxjs';
import {makeModelMapping} from 'src/models/model.model';
import {getMapOpacityParam} from 'src/permalink';

export class BackgroundLayerService extends BaseService {
  private readonly layers$ = new BehaviorSubject(LAYER_MAPPING);
  private readonly activeId$ = new BehaviorSubject<Id<BackgroundLayer>>(GREY_BACKGROUND.id);
  private readonly activeLayer$ = combineLatest([this.layers$, this.activeId$]).pipe(
    map(() => this.background),
    shareReplay(1),
  );

  constructor() {
    super();

    const opacity = getMapOpacityParam();
    if (opacity != null && opacity !== 1) {
      this.update({
        ...this.background,
        opacity,
      });
    }
  }

  get layers(): BackgroundLayer[] {
    return [...LAYERS];
  }

  get background(): BackgroundLayer {
    return this.layers$.value.get(this.activeId$.value)!;
  }

  get background$(): Observable<BackgroundLayer> {
    return this.activeLayer$;
  }

  setBackground(id: Id<BackgroundLayer>): void {
    const oldId = this.activeId$.value;
    const oldLayer = this.layers$.value.get(oldId)!;

    const layers = new Map(LAYER_MAPPING);
    const activeLayer = layers.get(id);
    if (activeLayer == null) {
      throw new Error(`unknown background: ${id}`);
    }
    layers.set(id, {
      ...activeLayer,
      opacity: oldLayer.opacity,
      isVisible: oldLayer.isVisible,
    });
    this.activeId$.next(id);
    this.layers$.next(layers);
  }

  update(value: Partial<BackgroundLayer>): void {
    const activeId = this.activeId$.value;
    if (value.id != null && activeId !== value.id) {
      throw new Error('non-active background layers can\'t be updated.');
    }
    const layers = new Map(this.layers$.value);
    layers.set(activeId, {...this.background, ...value});
    this.layers$.next(layers);
  }
}

const BACKGROUND_BASE = {
  opacity: 1,
  isVisible: true,
} satisfies Partial<BackgroundLayer>;

const SATELLITE_BACKGROUND: BackgroundLayer = {
  ...BACKGROUND_BASE,
  id: makeId('satellite'),
  label: makeTranslationKey('dtd_aerial_map_label'),
  imagePath: '/images/arealimage.png',
  children: [
    {
      id: makeId('ch.swisstopo.swissimage'),
      format: 'jpeg',
      credit: 'swisstopo',
      maximumLevel: 20,
    },
  ],
};

const GREY_BACKGROUND: BackgroundLayer = {
  ...BACKGROUND_BASE,
  id: makeId('grey'),
  label: makeTranslationKey('dtd_grey_map_label'),
  imagePath: '/images/grey.png',
  opacity: 1,
  children: [
    {
      id: makeId('ch.swisstopo.pixelkarte-grau'),
      format: 'jpeg',
      credit: 'swisstopo',
      maximumLevel: 18,
    },
  ],
};

const TOPOGRAPHY_BACKGROUND: BackgroundLayer = {
  ...BACKGROUND_BASE,
  id: makeId('topography'),
  label: makeTranslationKey('dtd_lakes_rivers_map_label'),
  imagePath: '/images/lakes_rivers.png',
  opacity: 1,
  children: [
    {
      id: makeId('ch.bafu.vec25-seen'),
      format: 'png',
      credit: 'swisstopo',
      maximumLevel: 18,
    },
    {
      id: makeId('ch.bafu.vec25-gewaessernetz_2000'),
      format: 'png',
      credit: 'swisstopo',
      maximumLevel: 18,
    },
  ],
};

const LAYERS = [
  SATELLITE_BACKGROUND,
  GREY_BACKGROUND,
  TOPOGRAPHY_BACKGROUND,
].map(Object.freeze) as BackgroundLayer[];

const LAYER_MAPPING = Object.freeze(makeModelMapping(LAYERS));
