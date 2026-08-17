import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { CoreElement } from 'src/features/core';
import {
  RECOMMENDED_MAX_SLICES_BY_AXIS,
  SEISMIC_SLICE_AXES,
  SeismicSliceAxis,
  SlicePreloadProgress,
  SliceViewMode,
  Tiles3dLayer,
  Tiles3dLayerController,
  Tiles3dSliceSelection,
  emptySlicePreloadProgress,
} from 'src/features/layer';
import { consume } from '@lit/context';
import { LayerService } from 'src/features/layer/layer.service';
import { Id } from 'src/models/id.model';
import { SliderChangeEvent } from 'src/features/core/core-slider.element';
import { applyTypography } from 'src/styles/theme';
import i18next from 'i18next';
import { when } from 'lit/directives/when.js';

/** How long the preload banner stays visible after finishing, before fading out. */
const PRELOAD_BANNER_LINGER_MS = 3_000;

@customElement('ngm-catalog-display-slice-detail')
export class CatalogDisplaySliceDetail extends CoreElement {
  @property()
  accessor layerId!: Id<Tiles3dLayer>;

  @state()
  accessor layer!: Tiles3dLayer;

  @state()
  accessor controller: Tiles3dLayerController | null = null;

  /** Local single-mode values so the slider UI stays snappy while Cesium lags. */
  @state()
  accessor draftSingle: Record<SeismicSliceAxis, number> | null = null;

  @state()
  accessor preloadProgress: SlicePreloadProgress = emptySlicePreloadProgress();

  /**
   * Whether the preload banner should currently be rendered. Kept separate
   * from `preloadProgress` itself: we only ever show the banner while slices
   * are actually being fetched, never for a "done" state we didn't personally
   * observe the loading part of (e.g. everything was already cached before
   * the panel opened), and we keep it visible briefly after finishing rather
   * than snapping away instantly.
   */
  @state()
  accessor isPreloadBannerVisible = false;

  @consume({ context: LayerService.context() })
  accessor layerService!: LayerService;

  private isSliderDragging = false;
  private commitFrameId = 0;
  private preloadSubscriptionAxis: Tiles3dLayerController | null = null;
  /** The controller currently told to run background prefetching, so it can
   * be told to stop again on disconnect (or if the controller changes). */
  private hudActiveController: Tiles3dLayerController | null = null;
  private preloadBannerHideTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();

    this.register(
      this.layerService.layer$(this.layerId).subscribe((layer) => {
        this.layer = layer;
        this.controller = this.layerService.controller(
          layer.id,
        ) as Tiles3dLayerController;

        if (!this.isSliderDragging) {
          this.draftSingle = layer.sliceSelection?.single ?? null;
        }

        // Multiple-slice mode is not released yet — always fall back to single.
        if (layer.sliceSelection?.mode === 'multiple') {
          this.updateSelection({ mode: 'single' });
        }

        this.bindPreloadProgress(this.controller);

        if (this.controller?.supportsSliceSelection === true) {
          this.activateHudPreload(this.controller);
        }
      }),
    );
  }

  disconnectedCallback(): void {
    this.hudActiveController?.setHudActive(false);
    this.hudActiveController = null;
    this.preloadSubscriptionAxis = null;
    clearTimeout(this.preloadBannerHideTimer);
    this.cancelScheduledCommit();
    this.commitDraftSingle();
    super.disconnectedCallback();
  }

  private bindPreloadProgress(controller: Tiles3dLayerController | null): void {
    if (controller === null || controller === this.preloadSubscriptionAxis) {
      return;
    }
    if (!controller.supportsSliceSelection) {
      return;
    }
    this.preloadSubscriptionAxis = controller;
    this.applyPreloadProgress(controller.getPreloadProgress());
    this.register(
      controller.preloadProgress.subscribe((progress) => {
        this.applyPreloadProgress(progress);
      }),
    );
  }

  /**
   * Tell the controller to (keep) run(ning) background slice prefetching for
   * as long as this HUD panel stays open — see `Tiles3dLayerController.setHudActive`.
   */
  private activateHudPreload(controller: Tiles3dLayerController): void {
    if (!controller.supportsSliceSelection) {
      return;
    }
    if (
      this.hudActiveController !== null &&
      this.hudActiveController !== controller
    ) {
      this.hudActiveController.setHudActive(false);
    }
    this.hudActiveController = controller;
    controller.setHudActive(true);
    // Sync immediately in case the queue is already complete from a prior run.
    this.applyPreloadProgress(controller.getPreloadProgress());
  }

  /**
   * Decides whether the (subtle) preload banner should be shown, on top of
   * just storing the raw progress for its text/percentage.
   *
   * - While actively loading: show it right away.
   * - Once done: if it was visible (i.e. we actually watched slices load
   *   during this session), leave it up a few seconds so the "done" state is
   *   noticeable, then fade it out. If everything was already cached (so it
   *   never showed a loading state at all), never show it — there's nothing
   *   useful to report.
   * - Idle (nothing to load): hidden.
   */
  private applyPreloadProgress(progress: SlicePreloadProgress): void {
    this.preloadProgress = { ...progress, axes: { ...progress.axes } };

    if (progress.status === 'loading') {
      clearTimeout(this.preloadBannerHideTimer);
      this.isPreloadBannerVisible = true;
      return;
    }

    if (progress.status === 'done') {
      if (this.isPreloadBannerVisible) {
        clearTimeout(this.preloadBannerHideTimer);
        this.preloadBannerHideTimer = window.setTimeout(() => {
          this.isPreloadBannerVisible = false;
        }, PRELOAD_BANNER_LINGER_MS);
      }
      return;
    }

    // idle — nothing queued.
    clearTimeout(this.preloadBannerHideTimer);
    this.isPreloadBannerVisible = false;
  }

  private get selection(): Tiles3dSliceSelection | null {
    return this.layer?.sliceSelection ?? null;
  }

  private getSingleValue(axis: SeismicSliceAxis): number {
    return this.draftSingle?.[axis] ?? this.selection?.single[axis] ?? 0;
  }

  private updateSelection(patch: Partial<Tiles3dSliceSelection>): void {
    const current = this.selection;
    if (current === null) {
      return;
    }
    this.layerService.update(this.layerId, {
      sliceSelection: {
        ...current,
        ...patch,
        single: patch.single ?? current.single,
        multiple: patch.multiple ?? current.multiple,
      },
    });
  }

  private readonly setMode = (mode: SliceViewMode): void => {
    this.commitDraftSingle();
    this.updateSelection({ mode });
  };

  private readonly setSingleSlice = (
    axis: SeismicSliceAxis,
    value: number,
  ): void => {
    const current = this.selection;
    if (current === null) {
      return;
    }
    const nextSingle = {
      ...(this.draftSingle ?? current.single),
      [axis]: value,
    };
    this.draftSingle = nextSingle;
    this.controller?.prioritizeAxisNeighborhood(axis, value);
    this.updateSelection({ single: nextSingle });
  };

  private readonly onSliderInput = (
    axis: SeismicSliceAxis,
    event: SliderChangeEvent,
  ): void => {
    const current = this.selection;
    if (current === null) {
      return;
    }
    this.isSliderDragging = true;
    const value = Math.round(event.detail.value);
    this.draftSingle = {
      ...(this.draftSingle ?? current.single),
      [axis]: value,
    };
    // Keep the HTTP cache ahead of the scrub position.
    this.controller?.prioritizeAxisNeighborhood(axis, value);
    // `input` fires per pointer move (~60/s). Committing each one floods the
    // layer store and the tileset rebuild pipeline, so coalesce to one commit
    // per animation frame. The exact final value is committed on `done`.
    this.scheduleCommit();
  };

  private scheduleCommit(): void {
    if (this.commitFrameId !== 0) {
      return;
    }
    this.commitFrameId = requestAnimationFrame(() => {
      this.commitFrameId = 0;
      this.commitDraftSingle();
    });
  }

  private cancelScheduledCommit(): void {
    if (this.commitFrameId !== 0) {
      cancelAnimationFrame(this.commitFrameId);
      this.commitFrameId = 0;
    }
  }

  private readonly onSliderDone = (): void => {
    this.isSliderDragging = false;
    this.cancelScheduledCommit();
    this.commitDraftSingle();
  };

  private commitDraftSingle(): void {
    const current = this.selection;
    if (current === null || this.draftSingle === null) {
      return;
    }
    const isUnchanged = SEISMIC_SLICE_AXES.every(
      (axis) => this.draftSingle![axis] === current.single[axis],
    );
    if (isUnchanged) {
      return;
    }
    this.updateSelection({ single: { ...this.draftSingle } });
  }

  private readonly setMultipleAxis = (axis: SeismicSliceAxis): void => {
    const current = this.selection;
    if (current === null) {
      return;
    }
    this.updateSelection({
      multiple: { ...current.multiple, axis },
    });
  };

  private readonly setMultipleCount = (count: number): void => {
    const current = this.selection;
    if (current === null || this.controller === null) {
      return;
    }
    const max = this.controller.getAxisNumbers(current.multiple.axis).length;
    const clamped = Math.max(1, Math.min(count, Math.max(1, max)));
    this.updateSelection({
      multiple: { ...current.multiple, count: clamped },
    });
  };

  readonly render = () => {
    if (
      this.controller === null ||
      !this.controller.supportsSliceSelection ||
      this.selection === null
    ) {
      return html``;
    }

    const { selection } = this;
    return html`
      <div class="panel">
        <div class="controls">
          ${this.renderPreloadBanner()}
          <label class="mode">
            <span class="mode-label"
              >${i18next.t('catalog:slice_window.mode.label')}</span
            >
            <select
              .value=${selection.mode}
              @change=${(e: Event) =>
                this.setMode(
                  (e.target as HTMLSelectElement).value as SliceViewMode,
                )}
            >
              <option value="single">
                ${i18next.t('catalog:slice_window.mode.single')}
              </option>
              <option value="multiple" disabled>
                ${i18next.t('catalog:slice_window.mode.multiple')} —
                ${i18next.t('catalog:slice_window.mode.coming_soon')}
              </option>
            </select>
          </label>

          ${
            selection.mode === 'single'
              ? this.renderSingleMode()
              : this.renderMultipleMode(selection)
          }
        </div>
        ${this.renderLegend()}
      </div>
    `;
  };

  private readonly renderPreloadBanner = () => {
    if (!this.isPreloadBannerVisible) {
      return null;
    }
    const { preloadProgress } = this;
    const pct = Math.round(
      (preloadProgress.loaded / Math.max(1, preloadProgress.total)) * 100,
    );
    const isDone = preloadProgress.status === 'done';
    return html`
      <div class="preload-banner ${isDone ? 'is-done' : ''}" role="status">
        <div class="preload-banner-label">
          ${
            isDone
              ? i18next.t('catalog:slice_window.preload.done', {
                  total: preloadProgress.total,
                })
              : i18next.t('catalog:slice_window.preload.loading', {
                  loaded: preloadProgress.loaded,
                  total: preloadProgress.total,
                })
          }
        </div>
        <div
          class="progress"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${pct}
        >
          <div class="progress-bar" style="width: ${pct}%"></div>
        </div>
      </div>
    `;
  };

  private readonly renderSingleMode = () => html`
    <div class="axes">
      ${SEISMIC_SLICE_AXES.map((axis) => {
        const numbers = this.controller!.getAxisNumbers(axis);
        if (numbers.length === 0) {
          return null;
        }
        const min = numbers[0];
        const max = numbers[numbers.length - 1];
        const value = this.getSingleValue(axis);
        return html`
          <div class="axis">
            <div class="axis-header">
              <span class="axis-label">
                ${i18next.t(`catalog:slice_window.${axis}`)}
              </span>
              ${this.renderStepper(value, min, max, (next) =>
                this.setSingleSlice(axis, next),
              )}
            </div>
            <ngm-core-slider
              .value=${value}
              .min=${min}
              .max=${max}
              .step=${1}
              .label=${i18next.t(`catalog:slice_window.${axis}`)}
              @change=${(e: SliderChangeEvent) => this.onSliderInput(axis, e)}
              @done=${this.onSliderDone}
            ></ngm-core-slider>
          </div>
        `;
      })}
    </div>
  `;

  private readonly renderMultipleMode = (selection: Tiles3dSliceSelection) => {
    const { axis, count } = selection.multiple;
    const numbers = this.controller!.getAxisNumbers(axis);
    const maxCount = Math.max(1, numbers.length);
    const recommended = RECOMMENDED_MAX_SLICES_BY_AXIS[axis];
    const showWarning = count > recommended;

    return html`
      <div class="multiple">
        <div class="type-radios" role="radiogroup">
          ${SEISMIC_SLICE_AXES.map((candidate) => {
            if (this.controller!.getAxisNumbers(candidate).length === 0) {
              return null;
            }
            const isActive = candidate === axis;
            return html`
              <ngm-core-radio
                .isActive=${isActive}
                @click=${() => this.setMultipleAxis(candidate)}
              >
                ${i18next.t(`catalog:slice_window.${candidate}`)}
              </ngm-core-radio>
            `;
          })}
        </div>

        <div class="amount">
          <span class="amount-label">
            ${i18next.t('catalog:slice_window.amount')}
          </span>
          ${this.renderStepper(count, 1, maxCount, this.setMultipleCount)}
        </div>
        ${when(
          showWarning,
          () => html`
            <p class="warning">
              ${i18next.t('catalog:slice_window.warning_large', {
                max: recommended,
                axis: i18next.t(`catalog:slice_window.${axis}`),
              })}
            </p>
          `,
        )}
      </div>
    `;
  };

  private readonly renderStepper = (
    value: number,
    min: number,
    max: number,
    onChange: (value: number) => void,
  ) => html`
    <div class="stepper">
      <button
        type="button"
        class="stepper-btn"
        ?disabled=${value <= min}
        @click=${() => onChange(value - 1)}
      >
        &lt;
      </button>
      <input
        type="number"
        .value=${String(value)}
        min=${min}
        max=${max}
        step="1"
        @change=${(e: Event) => {
          const raw = Number((e.target as HTMLInputElement).value);
          if (Number.isNaN(raw)) {
            return;
          }
          onChange(Math.max(min, Math.min(max, Math.round(raw))));
        }}
      />
      <button
        type="button"
        class="stepper-btn"
        ?disabled=${value >= max}
        @click=${() => onChange(value + 1)}
      >
        &gt;
      </button>
    </div>
  `;

  private readonly renderLegend = () => html`
    <aside class="legend">
      <div class="legend-title">
        ${i18next.t('catalog:slice_window.legend.relative_amplitude')}
      </div>
      <div class="legend-range">
        <div class="legend-gradient"></div>
        ${AMPLITUDE_LEGEND_STEPS.map(
          (step) => html`
            <div
              class="legend-step"
              style="--step-percentage: ${step.percentage}"
            >
              ${step.label}
            </div>
          `,
        )}
      </div>
    </aside>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    :host {
      display: block;
      width: 520px;
      min-height: 280px;
    }

    .panel {
      display: flex;
      width: 100%;
      min-height: 280px;
    }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 20px;
      padding: 16px 24px;
      width: calc(100% - 160px);
    }

    .preload-banner {
      display: flex;
      flex-direction: column;
      gap: 4px;
      opacity: 0.75;
      transition: opacity 400ms ease;
    }

    .preload-banner-label {
      ${applyTypography('caption')};
      color: var(--sgc-color-text--emphasis-low, #999);
    }

    .preload-banner.is-done {
      opacity: 0.6;
    }

    .preload-banner.is-done .preload-banner-label {
      color: var(--color-primary--active, #607d52);
    }

    .progress {
      width: 100%;
      height: 3px;
      border-radius: 2px;
      background: var(--sgc-color-border--default, #ddd);
      overflow: hidden;
    }

    .progress-bar {
      height: 100%;
      background: var(--sgc-color-text--emphasis-low, #999);
      transition: width 120ms linear;
    }

    .preload-banner.is-done .progress-bar {
      background: var(--color-primary--active, #607d52);
    }

    .mode {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .mode-label,
    .axis-label,
    .amount-label {
      ${applyTypography('body-2-bold')};
      color: var(--sgc-color-text--emphasis-high);
    }

    .mode select {
      height: 36px;
      padding: 0 12px;
      border: 1px solid var(--sgc-color-border--default);
      border-radius: 4px;
      background: var(--sgc-color-bg--white);
      ${applyTypography('body-2')};
    }

    .axes {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .axis {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .axis-header,
    .amount {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .stepper {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .stepper input {
      width: 64px;
      height: 32px;
      text-align: center;
      border: 1px solid var(--sgc-color-border--default);
      border-radius: 4px;
      ${applyTypography('body-2')};
    }

    .stepper-btn {
      width: 28px;
      height: 32px;
      border: 1px solid var(--sgc-color-border--default);
      border-radius: 4px;
      background: var(--sgc-color-bg--white);
      cursor: pointer;
      ${applyTypography('body-2')};
    }

    .stepper-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .multiple {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .type-radios {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .warning {
      margin: 0;
      ${applyTypography('body-2')};
      color: var(--sgc-color-error, #c62828);
    }

    .legend {
      width: 160px;
      padding: 16px;
      border-left: 1px solid var(--sgc-color-border--default);
      background-color: var(--sgc-color-bg--grey);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }

    .legend-title {
      width: 100%;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--sgc-color-border--emphasis-high);
      text-align: center;
      ${applyTypography('body-2-bold')};
    }

    .legend-range {
      position: relative;
      height: 100%;
      min-height: 220px;
      width: 90px;
    }

    .legend-gradient {
      width: 36px;
      height: 100%;
      background: linear-gradient(
        to bottom,
        #ffffff 0%,
        #f5d0c8 25%,
        #e57373 50%,
        #8d6e63 75%,
        #424242 100%
      );
    }

    .legend-step {
      position: absolute;
      top: calc((100% - 1px) * var(--step-percentage));
      left: 48px;
      height: 20px;
      margin-top: -10px;
      white-space: nowrap;
      ${applyTypography('body-2')};
    }

    .legend-step::before {
      display: block;
      content: ' ';
      background-color: var(--sgc-color-secondary--900, #333);
      height: 1px;
      width: 28px;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      right: 100%;
      margin-right: 4px;
    }
  `;
}

const AMPLITUDE_LEGEND_STEPS: ReadonlyArray<{
  label: string;
  percentage: number;
}> = [
  { label: '0.20', percentage: 0 },
  { label: '0.10', percentage: 0.2 },
  { label: '0', percentage: 0.4 },
  { label: '-0.10', percentage: 0.6 },
  { label: '-0.20', percentage: 0.8 },
  { label: 'NDV', percentage: 1 },
];
