// Compatibility exports for existing Admin imports. The provider is shared
// with Seller and the customer storefront so one preference controls the site.
export {
  LanguageProvider,
  LanguageSwitcher,
  useLanguage,
} from '../../../../packages/i18n/src'
export type {
  Language as AdminLanguage,
  LanguageContextValue,
  TranslationKey,
} from '../../../../packages/i18n/src'
