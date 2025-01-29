import {createContext} from '@lit/context';
import {Layer, LayerId} from 'src/components/layer/layer.model';
import {BehaviorSubject, filter, map, Observable, shareReplay} from 'rxjs';
import MainStore from 'src/store/main';

const BASE_LAYER_ID = 'base';

export class LayerService {
  static readonly Context = createContext<LayerService>('LayerService');

  private readonly _layers = new BehaviorSubject(new Map<LayerId, Layer>());

  constructor() {
    const baseLayer: Layer = {
      id: BASE_LAYER_ID
    } as Layer;
    this._layers.value.set(baseLayer.id, baseLayer);


    MainStore.onIonAssetAdd.subscribe((asset) => {
      console.log(asset);
    });
  }

  get all$(): Observable<readonly Layer[]> {
    return this._layers.pipe(
      map((it) => [...it.values()]),
      shareReplay(1),
    );
  }

  find$(id: LayerId): Observable<Layer> {
    return this._layers.pipe(
      map((it) => it.get(id)),
      filter((it): it is Layer => it != null),
    );
  }

  hide(id: LayerId) {
    const layer = this.findOrThrow(id);
    this.update(layer);
  }

  private find(id: LayerId): Layer | null {
    return this._layers.value.get(id) ?? null;
  }

  private findOrThrow(id: LayerId): Layer {
    const layer = this.find(id);
    if (layer == null) {
      throw new Error(`unknown layer: ${id}`);
    }
    return layer;
  }

  private update(layer: Layer): void {
    const layers = new Map(this._layers.value);
    layers.set(layer.id, layer);
    this._layers.next(layers);
  }
}
