import {BaseService} from 'src/utils/base.service';
import {BackgroundLayer} from 'src/components/layer/layer.model';
import {makeTranslationKey} from 'src/models/translation-key.model';
import {Id, makeId} from 'src/models/id.model';
import {BehaviorSubject, map, Observable, shareReplay} from 'rxjs';
import {makeModelMapping} from 'src/models/model.model';
import {getMapOpacityParam} from 'src/permalink';
import {createContext} from '@lit/context';

export class BackgroundLayerService extends BaseService {
  static backgroundContext = createContext<BackgroundLayer>('BackgroundLayerService.background');

  static get default(): BackgroundLayer {
    return GREY_BACKGROUND;
  }

  private activeId: Id<BackgroundLayer> = GREY_BACKGROUND.id;

  private readonly layers$ = new BehaviorSubject(LAYER_MAPPING);
  private readonly activeLayer$ = this.layers$.pipe(
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
    return this.layers$.value.get(this.activeId)!;
  }

  get background$(): Observable<BackgroundLayer> {
    return this.activeLayer$;
  }

  setBackground(id: Id<BackgroundLayer>): void {
    const oldId = this.activeId;
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
    this.activeId = id;
    this.layers$.next(layers);
  }

  update(value: Partial<BackgroundLayer>): void {
    const {activeId} = this;
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
  hasAlphaChannel: false,
} satisfies Partial<BackgroundLayer>;

const SATELLITE_BACKGROUND: BackgroundLayer = {
  ...BACKGROUND_BASE,
  id: makeId('ch.swisstopo.swissimage'),
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
  id: makeId('ch.swisstopo.pixelkarte-grau'),
  label: makeTranslationKey('dtd_grey_map_label'),
  imagePath: '/images/grey.png',
  children: [
    {
      id: makeId('ch.swisstopo.pixelkarte-grau'),
      format: 'jpeg',
      credit: 'swisstopo',
      maximumLevel: 18,
    },
  ],
};

const WATERS_BACKGROUND: BackgroundLayer = {
  ...BACKGROUND_BASE,
  id: makeId('lakes_rivers_map'),
  label: makeTranslationKey('dtd_lakes_rivers_map_label'),
  imagePath: '/images/lakes_rivers.png',
  hasAlphaChannel: true,
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
  WATERS_BACKGROUND,
].map(Object.freeze) as BackgroundLayer[];

const LAYER_MAPPING = Object.freeze(makeModelMapping(LAYERS));
