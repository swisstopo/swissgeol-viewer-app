import {TranslationKey} from 'src/models/translation-key.model';
import {Id} from 'src/models/id.model';
import {Model} from 'src/models/model.model';

interface Layer extends Model {
  label: TranslationKey
  isVisible: boolean
}

export interface BackgroundLayer extends Layer {
  imagePath: string
  children: BackgroundSublayer[]
  opacity: number
  hasAlphaChannel: boolean
}

export interface BackgroundSublayer {
  id: Id<this>
  format: 'jpeg' | 'png'
  maximumLevel: number
  credit: string
}
