const assignments = { A: null, B: null }

export function browserVoiceId(voice) {
  return voice?.voiceURI || `${voice?.name ?? 'voice'}::${voice?.lang ?? ''}`
}

const PREFERRED_NAMES = {
  en: {
    A: ['Google UK English Male', 'Guy', 'Nathan', 'Brian', 'David', 'Daniel', 'Alex', 'Male'],
    B: ['Google UK English Female', 'Aria', 'Jenny', 'Ava', 'Emma', 'Samantha', 'Zira', 'Karen', 'Female'],
  },
  fr: {
    A: ['Google français', 'Henri', 'Thomas', 'Male'],
    B: ['Google français', 'Amelie', 'Céline', 'Female'],
  },
  de: {
    A: ['Google Deutsch', 'Markus', 'Konrad', 'Male'],
    B: ['Google Deutsch', 'Anna', 'Katja', 'Female'],
  },
  es: {
    A: ['Google español', 'Jorge', 'Pablo', 'Male'],
    B: ['Google español', 'Lucia', 'Helena', 'Female'],
  },
  zh: {
    A: ['Google 普通话', 'Kangkang', 'Yunxi', 'Male'],
    B: ['Google 普通话', 'Huihui', 'Yaoyao', 'Female'],
  },
  ja: {
    A: ['Google 日本語', 'Kenji', 'Hiroshi', 'Male'],
    B: ['Google 日本語', 'Nanami', 'Haruka', 'Female'],
  },
  id: {
    A: ['Google Bahasa Indonesia', 'Andi', 'Male'],
    B: ['Google Bahasa Indonesia', 'Siti', 'Female'],
  },
}

export function matchesLanguage(voiceLang, wanted) {
  const voice = String(voiceLang ?? '').toLowerCase().replace('_', '-')
  const target = String(wanted ?? 'en').toLowerCase().split('-')[0]
  return voice === target || voice.startsWith(`${target}-`) || voice.startsWith(target)
}

/**
 * Resolve a browser voice for the active debate language. An explicit user
 * choice always wins; otherwise prefer a natural match in that language.
 */
export function pickBrowserVoice(side, voiceLang = 'en', preferredId = null) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const all = window.speechSynthesis.getVoices() || []
  const localized = all.filter((voice) => matchesLanguage(voice.lang, voiceLang))
  const pool = localized.length ? localized : all
  if (!pool.length) return null

  if (preferredId) {
    const exact = pool.find((voice) => browserVoiceId(voice) === preferredId)
      ?? all.find((voice) => browserVoiceId(voice) === preferredId)
    if (exact) {
      assignments[side] = exact
      return exact
    }
  }

  const names = PREFERRED_NAMES[voiceLang]?.A && PREFERRED_NAMES[voiceLang]
    ? PREFERRED_NAMES[voiceLang][side]
    : PREFERRED_NAMES.en[side]
  let chosen = names
    .map((name) => pool.find((voice) => voice.name.includes(name)))
    .find(Boolean)

  if (!chosen) {
    const otherSide = side === 'A' ? 'B' : 'A'
    const distinct = pool.filter(
      (voice) => browserVoiceId(voice) !== browserVoiceId(assignments[otherSide]),
    )
    const candidates = distinct.length ? distinct : pool
    // If the machine exposes only one voice, both sides share it and are
    // differentiated by rate/pitch in the audio hook.
    const offset = side === 'A' ? 0 : Math.min(1, candidates.length - 1)
    chosen = candidates[offset] ?? candidates[0]
  }

  assignments[side] = chosen
  return chosen
}
