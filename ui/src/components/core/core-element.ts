import {LitElement} from 'lit';
import {state} from 'lit/decorators.js';
import i18next from 'i18next';
import {Subscription} from 'rxjs';
import {TeardownLogic} from 'rxjs/src/internal/types';

export class CoreElement extends LitElement {
  @state()
  private accessor language!: string;

  private readonly _subscription = new Subscription();

  connectedCallback() {
    const handleLanguageChanged = (language) => {
      this.language = language;
    };
    i18next.on('languageChanged', handleLanguageChanged);
    this._subscription.add(() => i18next.off('languageChanged', handleLanguageChanged));

    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._subscription.unsubscribe();
  }

  willUpdate(): void {
    if (!this.hasUpdated) {
      this.willFirstUpdate();
    }
  }

  willFirstUpdate(): void {}

  protected register(teardown: TeardownLogic): void {
    this._subscription.add(teardown);
  }
}
