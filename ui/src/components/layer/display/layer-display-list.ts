import {customElement} from 'lit/decorators.js';
import {LitElementI18n} from 'src/i18n';
import 'src/components/layer/display/layer-display-list-item';
import {consume} from '@lit/context';
import {BackgroundLayerService} from 'src/components/layer/background/background-layer.service';


@customElement('ngm-layer-display-list')
export class LayerDisplayList extends LitElementI18n {
  @consume({context: BackgroundLayerService.context()})
  accessor backgroundLayerService!: BackgroundLayerService;

}
