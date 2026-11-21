export const LANGUAGES = [
  { code: 'en', label: 'English', locale: 'en-US', voiceLang: 'en' },
  { code: 'fr', label: 'Français', locale: 'fr-FR', voiceLang: 'fr' },
  { code: 'de', label: 'Deutsch', locale: 'de-DE', voiceLang: 'de' },
  { code: 'es', label: 'Español', locale: 'es-ES', voiceLang: 'es' },
  { code: 'zh', label: 'Mandarin · 简体中文', locale: 'zh-CN', voiceLang: 'zh' },
  { code: 'ja', label: '日本語', locale: 'ja-JP', voiceLang: 'ja' },
  { code: 'id', label: 'Bahasa Indonesia', locale: 'id-ID', voiceLang: 'id' },
]

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code)

export function languageByCode(code) {
  return LANGUAGES.find((language) => language.code === code) ?? LANGUAGES[0]
}

export function isKnownLanguage(code) {
  return LANGUAGE_CODES.includes(code)
}
