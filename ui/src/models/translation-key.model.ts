
export type TranslationKey = string & {
  readonly __translation_key__: unique symbol;
}

export const makeTranslationKey = (key: string): TranslationKey => key as TranslationKey;
