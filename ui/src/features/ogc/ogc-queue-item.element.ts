import { customElement, property, state } from 'lit/decorators.js';
import { OgcJob, OgcJobStage, OgcService } from 'src/features/ogc/ogc.service';
import { CoreElement } from 'src/features/core';
import { consume } from '@lit/context';
import { css, html } from 'lit';
import { applyTypography } from 'src/styles/theme';
import { repeat } from 'lit/directives/repeat.js';
import { when } from 'lit/directives/when.js';
import i18next from 'i18next';
import { getLayerLabel, Layer, LayerService } from 'src/features/layer';
import { combineLatest } from 'rxjs';

@customElement('ngm-ogc-queue-item')
export class OgcQueue extends CoreElement {
  @property({ type: Object })
  accessor job!: OgcJob;

  @consume({ context: OgcService.context() })
  accessor ogcService!: OgcService;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  @state()
  accessor stage: OgcJobStage | null = null;

  @state()
  accessor progress: number | null = null;

  @state()
  accessor layers: Layer[] = [];

  connectedCallback() {
    super.connectedCallback();

    this.ogcService
      .resolve(this.job, (stage, progress) => {
        this.stage = stage;
        this.progress = progress;
      })
      .then(async () => {
        this.progress = 1;
        if (this.stage !== OgcJobStage.Failure) {
          await this.ogcService.download(this.job);
          await this.ogcService.complete(this.job);
        }
      });

    this.register(
      combineLatest(
        this.job.layerIds.map((id) => this.layerService.layer$(id)),
      ).subscribe((layers) => {
        this.layers = layers;
      }),
    );
  }

  private get isOngoing(): boolean {
    return (
      this.stage === OgcJobStage.Prepare || this.stage === OgcJobStage.Running
    );
  }

  private readonly complete = async (): Promise<void> => {
    await this.ogcService.complete(this.job);
  };

  readonly render = () => html`
    <div class="title">
      <h3>${this.job.title}</h3>
      <sgc-button
        color="tertiary"
        variant="icon"
        transparent
        @click="${this.complete}"
      >
        <sgc-icon name="cross"></sgc-icon>
      </sgc-button>
    </div>
    <div class="content">
      <ul class="layers">
        ${repeat(
          this.layers,
          (layer) => layer.id,
          (layer) => html`<li>${getLayerLabel(layer)}</li>`,
        )}
      </ul>
      ${
        this.stage === null
          ? undefined
          : html`
              <div class="stage">
                ${when(
                  this.isOngoing,
                  () =>
                    html` <sgc-icon
                      name="spinner"
                      animation="spin"
                    ></sgc-icon>`,
                )}
                <span>${i18next.t(`toolbox:ogc.stage.${this.stage}`)}</span>
              </div>
            `
      }
    </div>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: flex;
      flex-direction: column;
      border: 1px solid var(--sgc-color-border--emphasis-high);
      border-radius: 4px;
    }

    .title {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 16px 16px 24px;
      border-bottom: 1px solid var(--sgc-color-border--default);
    }

    .title h3 {
      margin: 0;
      ${applyTypography('modal-title-2')};
      font-weight: bold;
    }

    .content {
      display: flex;
      flex-direction: column;
      padding: 16px 24px;
      gap: 10px;
    }

    ul.layers {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    ul.layers > li {
      padding: 3px 6px;
      white-space: nowrap;
      border: 1.4px solid var(--sgc-color-border--default);
      border-radius: 6px;

      ${applyTypography('overline')}
    }

    .stage {
      display: flex;
      gap: 10px;
      color: var(--sgc-color-text--disabled);

      ${applyTypography('body-2')}
      font-weight: 500;
    }

    .stage > sgc-icon {
      color: var(--sgc-color-primary);
    }
  `;
}
