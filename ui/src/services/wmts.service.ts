import {
  DEFAULT_WMTS_SERVICE,
  WMTS_CAPABILITIES_BY_SERVICE,
  WmtsCapabilitiesLinks,
} from 'src/constants';
import { WmtsLayer } from 'src/features/layer';
import { language$ } from 'src/i18n';
import { Id } from 'src/models/id.model';
import { BaseService } from 'src/services/base.service';
import {
  parseWmsCapabilities,
  parseWmtsCapabilities,
} from 'src/services/wmts-capabilities.parser';
import i18next from 'i18next';
import { BehaviorSubject, filter, map, Observable, switchMap } from 'rxjs';

export class WmtsService extends BaseService {
  private readonly _layersByService$ = new BehaviorSubject(
    new Map<string, Map<Id<WmtsLayer>, WmtsLayer>>(),
  );

  // simple flag to signal load completion even if all services fail
  private readonly _hasLoaded$ = new BehaviorSubject(false);

  private _failedSources: string[] = [];

  constructor() {
    super();
    language$.pipe(switchMap(() => this.load())).subscribe((mapping) => {
      this._layersByService$.next(mapping);
      this._hasLoaded$.next(true);
    });
  }

  get ready$(): Observable<void> {
    return this._hasLoaded$.pipe(
      filter((hasLoaded) => hasLoaded),
      map(() => {}),
    );
  }

  get failedSources(): string[] {
    return this._failedSources;
  }

  get layers$(): Observable<WmtsLayer[]> {
    return this._layersByService$.pipe(
      map((services) =>
        [...services.values()].flatMap((layers) => [...layers.values()]),
      ),
    );
  }

  layer(id: Id<WmtsLayer>, service: string | null = null): WmtsLayer | null {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.value.get(resolvedService)?.get(id) ?? null;
  }

  layer$(
    id: Id<WmtsLayer>,
    service: string | null = null,
  ): Observable<WmtsLayer | null> {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.pipe(
      map((services) => services.get(resolvedService)?.get(id) ?? null),
    );
  }

  exists(id: Id<WmtsLayer>, service: string | null = null): boolean {
    const resolvedService = this.resolveServiceName(service);
    return this._layersByService$.value.get(resolvedService)?.has(id) ?? false;
  }

  private resolveServiceName(service: string | null): string {
    const serviceName = service ?? DEFAULT_WMTS_SERVICE;
    if (serviceName in WMTS_CAPABILITIES_BY_SERVICE) {
      return serviceName;
    }
    console.error(
      `Unknown WM(T)S service "${serviceName}", falling back to "${DEFAULT_WMTS_SERVICE}"`,
    );
    return DEFAULT_WMTS_SERVICE;
  }

  private async load(): Promise<Map<string, Map<Id<WmtsLayer>, WmtsLayer>>> {
    const byServiceEntries = await Promise.all(
      Object.entries(WMTS_CAPABILITIES_BY_SERVICE).map(
        async ([service, links]) => {
          const [wms, wmts] = await Promise.all([
            this.fetchWmsCapabilities(service, links),
            this.fetchWmtsCapabilities(service, links),
          ]);
          this._failedSources =
            wms.hasFailed || wmts.hasFailed ? [service] : [];
          const layers = new Map<Id<WmtsLayer>, WmtsLayer>();
          for (const layer of [...wms.layers, ...wmts.layers]) {
            layers.set(layer.id, layer);
          }
          return [service, layers] as const;
        },
      ),
    );

    const byService = new Map<string, Map<Id<WmtsLayer>, WmtsLayer>>();
    for (const [service, layers] of byServiceEntries) {
      byService.set(service, layers);
    }
    return byService;
  }

  private async fetchWmsCapabilities(
    service: string,
    links: WmtsCapabilitiesLinks,
  ): Promise<{
    layers: WmtsLayer[];
    hasFailed: boolean;
  }> {
    const xml = await this.fetchCapabilitiesXml(
      {
        host: links.wms,
        params: {
          SERVICE: 'WMS',
          REQUEST: 'GetCapabilities',
          VERSION: '1.3.0',
          lang: i18next.language,
        },
      },
      links.serviceTimeoutMs,
    );
    if (xml === null) {
      return { layers: [], hasFailed: true };
    }
    return { layers: parseWmsCapabilities(xml, service), hasFailed: false };
  }

  private async fetchWmtsCapabilities(
    service: string,
    links: WmtsCapabilitiesLinks,
  ): Promise<{
    layers: WmtsLayer[];
    hasFailed: boolean;
  }> {
    const xml = await this.fetchCapabilitiesXml(
      {
        host: links.wmts,
        params: {
          lang: i18next.language,
        },
      },
      links.serviceTimeoutMs,
    );
    if (xml === null) {
      return { layers: [], hasFailed: true };
    }
    return { layers: parseWmtsCapabilities(xml, service), hasFailed: false };
  }

  private async fetchCapabilitiesXml(
    options: {
      host: string;
      params: Record<string, string>;
    },
    timeoutMs?: number,
  ): Promise<Document | null> {
    const params = new URLSearchParams(options.params);
    const hasQuery = options.host.includes('?');
    const url = hasQuery
      ? `${options.host}&${params}`
      : `${options.host}?${params}`;
    try {
      const requestInit: RequestInit = {};
      if (timeoutMs) {
        requestInit.signal = AbortSignal.timeout(timeoutMs);
      }
      const res = await fetch(url, requestInit);
      if (!res.ok) {
        console.error(`Failed to fetch capabilities from "${options.host}"`);
        return null;
      }
      const parser = new DOMParser();
      return parser.parseFromString(await res.text(), 'text/xml');
    } catch (e) {
      // network error (service unreachable), treat as unavailable
      console.error(`Failed to fetch capabilities from "${options.host}":`, e);
      return null;
    }
  }
}
