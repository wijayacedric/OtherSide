import { EN_UI } from './strings.js'

const loaders = {
  fr: () => import('../data/translations/fr.json'),
  de: () => import('../data/translations/de.json'),
  es: () => import('../data/translations/es.json'),
  zh: () => import('../data/translations/zh.json'),
  ja: () => import('../data/translations/ja.json'),
  id: () => import('../data/translations/id.json'),
}

const cache = new Map()

export async function loadTranslation(code) {
  if (code === 'en' || !loaders[code]) {
    return { ui: { ...EN_UI }, topics: {} }
  }
  if (!cache.has(code)) {
    const pending = loaders[code]()
      .then((module) => module.default ?? module)
      .catch(() => {
        // Do not cache a transient failure: a later retry can still succeed.
        cache.delete(code)
        return { ui: {}, topics: {} }
      })
    cache.set(code, pending)
  }
  const data = await cache.get(code)
  return {
    ui: { ...EN_UI, ...(data?.ui ?? {}) },
    topics: data?.topics ?? {},
  }
}
