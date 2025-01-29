import { customElement, property, state } from 'lit/decorators.js';
import { html, LitElement } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

export type DropdownItem = {
  title: string;
  value: string;
};

export type DropdownChangedEvent<V = string> = {
  detail: {
    newValue: V | undefined;
  };
};

@customElement('ngm-dropdown')
export class NgmDropdown extends LitElement {
  @property({ type: Array })
  accessor items: DropdownItem[] = [];
  @property({ type: String })
  accessor selectedValue: string | undefined;
  @property({ type: String })
  accessor defaultText: string = '';
  @state()
  accessor dropdownShown = false;

  handleSelectionChange(newValue: string) {
    this.selectedValue = newValue;
    this.dispatchEvent(new CustomEvent('changed', { detail: { newValue } }));
  }

  get dropdownText() {
    const selectedItem = this.items.find((i) => i.value === this.selectedValue);
    if (selectedItem) {
      return selectedItem.title;
    }
    return this.defaultText;
  }

  render() {
    const text = this.dropdownText;
    return html`
      <div
        class="ui selection dropdown ngm-input"
        @click=${() => (this.dropdownShown = !this.dropdownShown)}
      >
        <input type="hidden" name="project" />
        <i class="dropdown icon"></i>
        <div class="text ${classMap({ default: this.defaultText === text })}">
          ${text}
        </div>
        <div class="menu ${classMap({ visible: this.dropdownShown })}">
          ${this.items.map(
            (item) =>
              html` <div
                class="item ${classMap({
                  selected: item.value === this.selectedValue,
                })}"
                data-value="${item.value}"
                @click=${() => this.handleSelectionChange(item.value)}
              >
                ${item.title}
              </div>`,
          )}
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}
