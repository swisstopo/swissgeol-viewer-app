import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import {
  Cartographic,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium';
import { css, html, PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { formatCartographicAs2DLv95 } from 'src/projection';
import i18next from 'i18next';
import { applyTypography } from 'src/styles/theme';
import { PickService } from 'src/services/pick.service';
import { CesiumService } from 'src/services/cesium.service';

@customElement('ngm-layout-cursor-info')
export class LayoutCursorInfo extends CoreElement {
  @state()
  accessor coordinates: string[] = [];

  @state()
  accessor height: number | null = null;

  @state()
  accessor heightType: 'terrain' | 'object' = 'object';

  @consume({ context: PickService.context() })
  accessor pickService!: PickService;

  @consume({ context: CesiumService.context() })
  accessor cesiumService!: CesiumService;

  private static readonly HEIGHT_FORMAT = new Intl.NumberFormat('de-CH', {
    maximumFractionDigits: 1,
  });

  connectedCallback() {
    super.connectedCallback();
    this.initializeViewer();
  }

  willUpdate(props: PropertyValues<this>): void {
    super.willUpdate(props);

    this.hidden = this.coordinates.length === 0 && this.height === null;
  }

  initializeViewer(): void {
    const { viewer } = this.cesiumService;
    if (viewer === null) {
      return;
    }

    const eventHandler = new ScreenSpaceEventHandler(viewer.canvas);
    eventHandler.setInputAction(
      this.handleMouseMove,
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    this.register(() => {
      eventHandler.destroy();
    });
  }

  private readonly handleMouseMove = (
    event: ScreenSpaceEventHandler.MotionEvent,
  ): void => {
    const { viewer } = this.cesiumService;
    if (viewer === null) {
      return;
    }

    this.height = null;
    this.coordinates.length = 0;

    const cartesian = this.pickService.pick(event.endPosition);
    if (cartesian == null) {
      return;
    }

    this.coordinates = formatCartographicAs2DLv95(
      Cartographic.fromCartesian(cartesian),
    );

    const position = Cartographic.fromCartesian(cartesian);
    this.height = position.height / viewer.scene.verticalExaggeration;

    const feature = viewer.scene.pick(event.endPosition);
    this.heightType = feature == null ? 'terrain' : 'object';
  };

  readonly render = () => {
    const heightLabel =
      this.heightType === 'terrain'
        ? i18next.t('nav_terrain_height_label')
        : i18next.t('nav_object_height_label');

    return html`
      ${
        this.coordinates.length === 0
          ? ''
          : html`
              <div class="section" data-cy="coordinates-info">
                <label>${i18next.t('camera_position_coordinates_label')}</label>
                <span class="value">${this.coordinates[0]}</span>
                <span class="value">${this.coordinates[1]}</span>
              </div>
            `
      }
      ${
        this.height === null
          ? ''
          : html`
              <div class="section" data-cy="height-info">
                <label>${heightLabel}</label>
                <span
                  >${LayoutCursorInfo.HEIGHT_FORMAT.format(this.height)}m</span
                >
              </div>
            `
      }
    `;
  };

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: none;
    }

    @media (min-width: 1200px) {
      :host {
        display: flex;
      }
    }

    :host {
      ${applyTypography('overline')}
      gap: 12px;
    }

    .section {
      display: flex;
      flex-direction: column;
    }

    label {
      margin-bottom: 5px;
    }
  `;
}
