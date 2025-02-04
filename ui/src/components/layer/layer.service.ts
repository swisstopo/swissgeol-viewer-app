import {BaseService} from 'src/utils/base.service';
import {BehaviorSubject, filter, map, Observable, shareReplay} from 'rxjs';
import defaultLayerTree, {LayerConfig} from 'src/layertree';
import {Id, makeId} from 'src/models/id.model';
import {createContext} from '@lit/context';

export class LayerService extends BaseService {
  static layersContext = createContext<LayerConfig[]>('LayerService.layers');

  static displayLayersContext = createContext<LayerConfig[]>('LayerService.displayLayers');

  static treeContext = createContext<LayerConfig[]>('LayerService.tree');

  private readonly mapping = new Map<Id<LayerConfig>, Entry>();
  private readonly _layersChange$ = new BehaviorSubject<[LayerConfig | null, LayerConfig | null]>([null, null]);

  private readonly _layers$ = this._layersChange$.pipe(
    map(() => {
      const layers: LayerConfig[] = [];
      for (const entry of this.mapping.values()) {
        layers.push(entry.layer);
      }
      return layers;
    }),
    shareReplay(1),
  );

  private readonly _displayLayers$ = this._layers$.pipe(
    map((layers) => layers.filter((it) => it.displayed)),
    shareReplay(1),
  );

  private readonly _tree$ = this._layersChange$.pipe(
    map(() => defaultLayerTree.map((layer) => this.mapping.get(getLayerId(layer))!.layer)),
    shareReplay(1),
  );

  constructor() {
    super();

    for (const layer of defaultLayerTree) {
      this.registerLayer(layer);
    }
    this._layersChange$.next([null, null]);
  }

  private registerLayer(layer: LayerConfig, parentId: Id<LayerConfig> | null = null) {
    if (parentId == null) {
      layer = deepFreeze(layer);
    }
    const id = getLayerId(layer);
    if (this.mapping.has(id)) {
      throw new Error(`layer has already been added: ${id}`);
    }
    this.mapping.set(id, {layer, parentId});
    if (layer.children != null) {
      for (const child of layer.children) {
        this.registerLayer(child, id);
      }
    }
  }

  get layers(): LayerConfig[] {
    return [...this.mapping.values()].map((it) => it.layer);
  }

  get layers$(): Observable<LayerConfig[]> {
    return this._layers$;
  }

  get displayLayers(): LayerConfig[] {
    return this.layers.filter((it) => it.displayed);
  }

  get displayLayers$(): Observable<LayerConfig[]> {
    return this._displayLayers$;
  }

  get tree$(): Observable<LayerConfig[]> {
    return this._tree$;
  }

  get layerChange$(): Observable<[LayerConfig, LayerConfig]> {
    return this._layersChange$.pipe(
      filter(([oldLayer, newLayer]) => oldLayer != null && newLayer != null),
    ) as Observable<[LayerConfig, LayerConfig]>;
  }

  get layerRemoval$(): Observable<LayerConfig> {
    return this._layersChange$.pipe(
      map(([oldLayer, newLayer]) => newLayer == null ? oldLayer : null),
      filter((it) => it != null)
    );
  }

  add(layer: LayerConfig): void {
    const id = getLayerId(layer);
    if (this.mapping.has(id)) {
      throw new Error(`layer does already exist: ${id}`);
    }
    if (hasChildren(layer)) {
      throw new Error('parent layers can not be added dynamically');
    }
    this.mapping.set(id, {layer, parentId: null});
    this._layersChange$.next([null, layer]);
  }

  update(id: Id<LayerConfig>, layer: Partial<LayerConfig>): LayerConfig {
    const entry = this.mapping.get(id);
    if ('label' in layer && id !== layer.label) {
      throw new Error('layer id may not be changed');
    }
    if (entry == null) {
      throw new Error(`layer does not exist: ${id}`);
    }
    if ('children' in layer && entry.layer.children !== layer.children) {
      throw new Error('children may not be updated via their parents');
    }
    const newEntry = {...entry, layer: deepFreeze({...entry.layer, ...layer})};
    this.mapping.set(id, newEntry);
    this.updateInParent(id, newEntry);
    this._layersChange$.next([entry.layer, newEntry.layer]);
    return newEntry.layer;
  }

  remove(id: Id<LayerConfig>): void {
    const entry = this.mapping.get(id);
    if (entry == null) {
      throw new Error(`layer does not exist: ${id}`);
    }
    if (hasChildren(entry.layer)) {
      throw new Error('parent layers may not be removed');
    }
    if (entry.parentId != null) {
      throw new Error('child layers may not be removed');
    }
    this.mapping.delete(id);
    this._layersChange$.next([entry.layer, null]);
  }

  private updateInParent(id: Id<LayerConfig>, entry: Entry): void {
    if (entry.parentId == null) {
      return;
    }
    const parent = this.mapping.get(entry.parentId)!;
    const i = parent.layer.children!.findIndex((child) => getLayerId(child) === id);
    const children = [...parent.layer.children!];
    children[i] = entry.layer;
    Object.freeze(children);
    const newParent: Entry = {...parent, layer: Object.freeze({...parent.layer, children})};
    this.mapping.set(entry.parentId, newParent);
    this.updateInParent(entry.parentId, newParent);
  }
}

export const getLayerId = (layer: LayerConfig): Id<LayerConfig> => makeId(layer.label);

const deepFreeze = <T>(value: T): T => {
  if (value == null) {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map(deepFreeze)) as T;
  }
  if (typeof value === 'object') {
    const frozen = {} as T;
    for (const [k, v] of Object.entries(value)) {
      frozen[k] = deepFreeze(v);
    }
    return Object.freeze(frozen);
  }
  return value;
};

interface Entry {
  layer: LayerConfig
  parentId: Id<LayerConfig> | null
}

const hasChildren = (layer: LayerConfig): boolean => layer.children != null && layer.children.length !== 0;
