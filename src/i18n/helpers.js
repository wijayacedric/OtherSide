import { getFallbackDebate, TOPIC_KEYS } from '../data/demoTopics.js'
import { EN_UI } from './strings.js'

export function fill(text, values = {}) {
  return String(text ?? '').replace(/\{(\w+)\}/g, (match, key) =>
    Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : match,
  )
}

export function translate(ui, key, values = {}, fallback = '') {
  const source = Object.prototype.hasOwnProperty.call(ui ?? {}, key)
    ? ui[key]
    : EN_UI[key]
  // An empty translation is missing, not a deliberate blank label.
  const resolved =
    typeof source === 'string' && source.trim()
      ? source
      : typeof fallback === 'string' && fallback.trim()
        ? fallback
        : EN_UI[key] ?? key
  return fill(resolved, values)
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[.!?。！？]+$/u, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function findTopicKey(topic, code, bundle) {
  const wanted = normalize(topic)
  if (!wanted) return null

  if (code === 'en') {
    return TOPIC_KEYS.find((key) => normalize(key) === wanted) ?? null
  }

  for (const [key, entry] of Object.entries(bundle?.topics ?? {})) {
    if (normalize(key) === wanted || normalize(entry?.topic) === wanted) return key
  }
  return null
}

export function localizedTopic(topic, code, bundle) {
  if (code === 'en') return topic
  const key = findTopicKey(topic, code, bundle) ?? topic
  return bundle?.topics?.[key]?.topic ?? topic
}

export function localizedSuggestions(topics, code, bundle) {
  return topics.map((topic) => localizedTopic(topic, code, bundle))
}

function snapshotEnglish(debate) {
  return {
    topic: debate.topic,
    description: debate.description ?? '',
    pro: debate.pro ?? '',
    con: debate.con ?? '',
    common: debate.common ?? null,
  }
}

/**
 * Switch the visible topic, description and spoken arguments to the active
 * language. Curated topics have real translations; custom topics use the
 * translated template in the chosen language.
 */
export function localizeDebate(debate, code, bundle) {
  if (!debate) return debate

  const key = debate.topicKey ?? findTopicKey(debate.topic, code, bundle)
  const english = debate.english ?? (key ? snapshotEnglish(getFallbackDebate(key)) : null)

  if (code === 'en') {
    // A generated custom debate only has real text for the language it was
    // created in. English uses the template rather than showing another
    // language's generated prose under an English UI.
    if (debate.source === 'llm' && !key && !debate.generated?.en) {
      const customTopic = debate.customTopic ?? debate.topic
      return {
        ...debate,
        topic: customTopic,
        description: EN_UI.templateDescription,
        pro: fill(EN_UI.templatePro, { topic: customTopic }),
        con: fill(EN_UI.templateCon, { topic: customTopic }),
        common: EN_UI.commonGroundFallback,
        topicKey: null,
        english: debate.english ?? null,
      }
    }
    const original = debate.generated?.en ?? english
    return {
      ...debate,
      ...(original ?? {}),
      topic: original?.topic ?? debate.topic,
      topicKey: key ?? debate.topicKey ?? null,
      english: original ?? debate.english ?? null,
    }
  }

  const entry = key ? bundle?.topics?.[key] : null
  if (entry) {
    return {
      ...debate,
      topic: entry.topic,
      description: entry.description ?? debate.description ?? '',
      pro: entry.pro ?? debate.pro ?? '',
      con: entry.con ?? debate.con ?? '',
      common: entry.common ?? debate.common ?? null,
      topicKey: key,
      customTopic: null,
      english: debate.english ?? english,
    }
  }

  const customTopic = debate.customTopic ?? debate.topic
  const ui = bundle?.ui ?? EN_UI
  const saved = debate.generated?.[code]
  return {
    ...debate,
    topic: customTopic,
    description: saved?.description ?? ui.templateDescription ?? debate.description ?? '',
    pro: saved?.pro ?? fill(ui.templatePro ?? EN_UI.templatePro, { topic: customTopic }),
    con: saved?.con ?? fill(ui.templateCon ?? EN_UI.templateCon, { topic: customTopic }),
    common: saved?.common ?? ui.commonGroundFallback ?? debate.common ?? null,
    customTopic,
    topicKey: null,
    english: debate.english ?? null,
  }
}
