import { css, html, LitElement, render, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';

interface CoreModalProps {
  size?: Size;

  /**
   * Makes the modal persistent, which disables closing it by clicking outside of it.
   */
  isPersistent?: boolean;
  hasNoPadding?: boolean;
  onClose?: () => void;
}

@customElement('ngm-core-modal')
export class CoreModal extends LitElement {
  @property({ type: String, reflect: true })
  accessor size: Size = 'auto';
  @property({ type: Boolean })
  accessor isPersistent = true;
  @property({ type: Boolean, attribute: 'no-padding', reflect: true })
  accessor hasNoPadding = false;
  constructor() {
    super();

    this.close = this.close.bind(this);
  }

  static open(props: CoreModalProps, content: TemplateResult): CoreModal {
    const container = document.createElement('div');
    container.classList.add('ngm-core-modal-container');
    document.body.appendChild(container);

    const close = () => {
      render(null, container);
      document.body.removeChild(container);
      if (props.onClose != null) {
        props.onClose();
      }
    };

    render(
      html`<ngm-core-modal
        @close="${close}"
        .isPersistent="${props.isPersistent}"
        .size="${props.size ?? 'auto'}"
        .hasNoPadding="${props.hasNoPadding}"
        >${content}</ngm-core-modal
      >`,
      container,
    );

    const modal = container.querySelector('ngm-core-modal')!;
    return modal as CoreModal;
  }

  private dialog: HTMLDialogElement | null = null;

  firstUpdated(): void {
    this.dialog = this.shadowRoot!.querySelector('dialog')!;
    this.dialog.showModal();
  }

  disconnectedCallback(): void {
    this.dialog?.close();
  }

  close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  handleClick(e: MouseEvent): void {
    if (this.isPersistent) {
      return;
    }
    if (e.target === this.dialog) {
      this.close();
    }
  }

  readonly render = () => html`
    <dialog @click="${this.handleClick}">
      <div>
        <slot></slot>
      </div>
    </dialog>
  `;

  static readonly styles = css`
    :host,
    :host * {
      box-sizing: border-box;
    }

    dialog {
      border: none;
      border-radius: 4px;
      padding: 0;

      max-width: 80vw;
      max-height: 80vh;
    }

    :host([size='small']) dialog {
      width: 326px;
    }

    :host([size='large']) dialog {
      width: 909px;
    }

    dialog::backdrop {
      background-color: #111827b2;
      opacity: 0.7;
    }

    :host(:not([no-padding])) dialog > div {
      padding: 24px;
    }
  `;
}

type Size = 'auto' | 'small' | 'large';
