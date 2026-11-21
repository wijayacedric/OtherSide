import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, MotionConfig, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  BookmarkCheck,
  Flame,
  HeartHandshake,
  Maximize2,
  Mic2,
  Minimize2,
  Pause,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react'
import VoiceCard from './components/VoiceCard.jsx'
import WhyThisMatters from './components/WhyThisMatters.jsx'
import SavedDebates from './components/SavedDebates.jsx'
import LanguageSelect from './components/LanguageSelect.jsx'
import MiniPlayer from './components/MiniPlayer.jsx'
import ReflectionPrompt from './components/ReflectionPrompt.jsx'
import { SUGGESTION_TOPICS } from './data/demoTopics.js'
import {
  DEFAULT_VOICE_A,
  DEFAULT_VOICE_B,
  ELEVEN_VOICES,
  isElevenVoiceId,
  voiceById,
} from './data/elevenVoices.js'
import { LANGUAGES, isKnownLanguage, languageByCode } from './data/languages.js'
import {
  findTopicKey,
  localizeDebate,
  localizedSuggestions,
  localizedTopic,
  translate,
} from './i18n/helpers.js'
import { loadTranslation } from './i18n/translations.js'
import { EN_UI } from './i18n/strings.js'
import { useVoiceAudio } from './hooks/useVoiceAudio.js'
import { useVoicePreview } from './hooks/useVoicePreview.js'
import { generateDebate } from './lib/api.js'
import { isSchoolAppropriateTopic } from './lib/topicSafety.js'

const STORAGE_KEY = 'otherside.debates.v1'
const VOICE_PREFS_KEY = 'otherside.voices.v1'
const SUGGESTION_KEY = 'otherside.suggestions.v1'
const LANGUAGE_KEY = 'otherside.language.v1'
const REFLECTION_KEY = 'otherside.reflections.v1'

function shuffle(items) {
  const list = [...items]
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[list[index], list[swap]] = [list[swap], list[index]]
  }
  return list
}

function pickSuggestions() {
  const pool = SUGGESTION_TOPICS.map((item) => item.topic)
  let picks = shuffle(pool).slice(0, 4)
  let signature = picks.join('|')
  try {
    const previous = sessionStorage.getItem(SUGGESTION_KEY) || ''
    if (signature === previous) {
      picks = [picks[1], picks[2], picks[3], picks[0]]
      signature = picks.join('|')
    }
    sessionStorage.setItem(SUGGESTION_KEY, signature)
  } catch {
    // Private browsing can block storage; the random picks still change.
  }
  return picks
}

function emptyVoicePrefs() {
  return { A: DEFAULT_VOICE_A, B: DEFAULT_VOICE_B }
}

function readVoicePrefs() {
  const base = emptyVoicePrefs()
  try {
    const parsed = JSON.parse(localStorage.getItem(VOICE_PREFS_KEY) || '{}')
    for (const side of ['A', 'B']) {
      const value = parsed?.[side]
      const legacy = parsed?.elevenlabs?.[side]
      if (isElevenVoiceId(value)) base[side] = value
      else if (isElevenVoiceId(legacy)) base[side] = legacy
    }
  } catch {
    // Corrupted or outdated preferences fall back to the stage defaults.
  }
  return base
}

function persistVoicePrefs(next) {
  try {
    localStorage.setItem(VOICE_PREFS_KEY, JSON.stringify(next))
  } catch {
    // Storage can be disabled; the in-memory choice still works.
  }
}

function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.topic === 'string' &&
          typeof item.pro === 'string' &&
          typeof item.con === 'string',
      )
      .map((item, index) => ({
        ...item,
        id: typeof item.id === 'string' ? item.id : `legacy-${index}`,
        createdAt: Number.isNaN(Date.parse(item.createdAt))
          ? new Date().toISOString()
          : item.createdAt,
      }))
  } catch {
    return []
  }
}

function readLanguage() {
  try {
    const code = localStorage.getItem(LANGUAGE_KEY)
    return isKnownLanguage(code) ? code : 'en'
  } catch {
    return 'en'
  }
}

function readReflections() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REFLECTION_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export default function App() {
  const [language, setLanguage] = useState(readLanguage)
  const [bundle, setBundle] = useState({ ui: EN_UI, topics: {} })
  const [topic, setTopic] = useState('')
  const [suggestions, setSuggestions] = useState(pickSuggestions)
  const [debate, setDebate] = useState(null)
  const [busy, setBusy] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [autoPlayToken, setAutoPlayToken] = useState(0)
  const [saved, setSaved] = useState(readSaved)
  const [justSaved, setJustSaved] = useState(false)
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [voicePrefs, setVoicePrefs] = useState(readVoicePrefs)
  const [focusMode, setFocusMode] = useState(false)
  const [playAll, setPlayAll] = useState({ active: false, stage: null })
  const [miniDismissed, setMiniDismissed] = useState(false)
  const [showReflection, setShowReflection] = useState(false)
  const [reflections, setReflections] = useState(readReflections)

  const playAllRef = useRef(playAll)
  const voiceARef = useRef(null)
  const voiceBRef = useRef(null)
  const playAllWatchdogRef = useRef(null)
  const justSavedTimerRef = useRef(null)
  const generateSeqRef = useRef(0)
  const languageSeqRef = useRef(0)

  useEffect(() => {
    playAllRef.current = playAll
  }, [playAll])

  useEffect(() => {
    let alive = true
    loadTranslation(language).then((data) => {
      if (alive) setBundle(data)
    })
    return () => {
      alive = false
    }
  }, [language])

  useEffect(() => {
    document.documentElement.lang = languageByCode(language).locale
  }, [language])

  useEffect(() => {
    fetch('/api/health')
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth(null))
  }, [])

  const t = useCallback(
    (key, values = {}, fallback = '') => translate(bundle.ui, key, values, fallback),
    [bundle.ui],
  )

  const voiceLang = languageByCode(language).voiceLang
  const sideAArgument = debate ? (flipped ? debate.con : debate.pro) : ''
  const sideBArgument = debate ? (flipped ? debate.pro : debate.con) : ''
  const isElevenLabs = Boolean(health?.elevenlabs)
  const selectedVoice = (side) => voicePrefs[side]

  const handleVoiceChange = (side, value) => {
    if (!isElevenVoiceId(value)) return
    setVoicePrefs((previous) => {
      const next = { ...previous, [side]: value }
      persistVoicePrefs(next)
      return next
    })
  }

  // The stage uses an intentionally short list. No account voices, no browser
  // voice list, and no "automatic" option.
  const voiceOptions = () =>
    ELEVEN_VOICES.map((voice) => ({ id: voice.id, label: voice.name }))

  const voiceLabel = (side) => `${voiceById(selectedVoice(side)).name} · ElevenLabs`

  const clearPlayAllWatchdog = useCallback(() => {
    if (playAllWatchdogRef.current) {
      clearTimeout(playAllWatchdogRef.current)
      playAllWatchdogRef.current = null
    }
  }, [])

  const stopPlayAll = useCallback(() => {
    clearPlayAllWatchdog()
    playAllRef.current = { active: false, stage: null }
    setPlayAll({ active: false, stage: null })
  }, [clearPlayAllWatchdog])

  // A blocked or errored voice never fires onComplete. Without a watchdog the
  // "Play whole debate" button would read "Stop debate" forever.
  const armPlayAllWatchdog = useCallback(() => {
    clearPlayAllWatchdog()
    playAllWatchdogRef.current = setTimeout(() => {
      stopPlayAll()
      voiceARef.current?.pause()
      voiceBRef.current?.pause()
    }, 120_000)
  }, [clearPlayAllWatchdog, stopPlayAll])

  const handleSideComplete = useCallback(
    (side) => {
      const current = playAllRef.current
      if (!current.active || current.stage !== side) return
      if (side === 'A') {
        armPlayAllWatchdog()
        setPlayAll({ active: true, stage: 'B' })
        voiceBRef.current?.play()
      } else {
        stopPlayAll()
      }
    },
    [armPlayAllWatchdog, stopPlayAll],
  )

  useEffect(() => clearPlayAllWatchdog, [clearPlayAllWatchdog])

  // Baked clips are English and use the original stance, so they are only
  // eligible for the default topic in English while both voices use defaults.
  const isDemoTopic =
    language === 'en' &&
    Boolean(debate) &&
    debate.source === 'curated' &&
    /uniform|dress code/i.test(debate.topic)

  const voiceA = useVoiceAudio({
    side: 'A',
    text: sideAArgument,
    allowDemoClip: isDemoTopic && selectedVoice('A') === DEFAULT_VOICE_A,
    clipText: debate?.pro ?? null,
    ttsAvailable: isElevenLabs,
    voiceId: isElevenLabs ? selectedVoice('A') : null,
    browserVoiceId: null,
    voiceLabel: voiceLabel('A'),
    stageVoiceName: isElevenLabs ? voiceById(selectedVoice('A')).name : '',
    autoPlayToken,
    shouldAutoPlay: true,
    language: voiceLang,
    t,
    onComplete: () => handleSideComplete('A'),
  })
  const voiceB = useVoiceAudio({
    side: 'B',
    text: sideBArgument,
    allowDemoClip: isDemoTopic && selectedVoice('B') === DEFAULT_VOICE_B,
    clipText: debate?.con ?? null,
    ttsAvailable: isElevenLabs,
    voiceId: isElevenLabs ? selectedVoice('B') : null,
    browserVoiceId: null,
    voiceLabel: voiceLabel('B'),
    stageVoiceName: isElevenLabs ? voiceById(selectedVoice('B')).name : '',
    autoPlayToken,
    shouldAutoPlay: false,
    language: voiceLang,
    t,
    onComplete: () => handleSideComplete('B'),
  })

  voiceARef.current = voiceA
  voiceBRef.current = voiceB

  const handleBeforePreview = useCallback(() => {
    stopPlayAll()
    voiceARef.current?.pause()
    voiceBRef.current?.pause()
  }, [stopPlayAll])

  const { preview: previewVoice, previewing } = useVoicePreview({
    isElevenLabs,
    voiceLang,
    onBeforePreview: handleBeforePreview,
  })

  const handlePreview = (side) => {
    previewVoice({
      side,
      text: t('previewSentence', {}, 'Here is how this voice will sound.'),
      voiceId: selectedVoice(side),
    })
  }

  const handleGenerate = async (event, overrideTopic) => {
    event?.preventDefault()
    const value = (typeof overrideTopic === 'string' ? overrideTopic : topic).trim()
    if (!value || busy) return
    if (!isSchoolAppropriateTopic(value)) {
      setError(t('unsafeTopic', {}, EN_UI.unsafeTopic))
      return
    }

    const key = findTopicKey(value, language, bundle)
    const canonical = key ?? value
    const seq = ++generateSeqRef.current
    setTopic(localizedTopic(canonical, language, bundle))
    setBusy(true)
    setError('')
    stopPlayAll()
    voiceA.pause()
    voiceB.pause()

    try {
      const result = await generateDebate(canonical, language)
      if (seq !== generateSeqRef.current) return
      // Keep the original text for this language so switching away and back
      // restores it instead of replacing it with the generic template.
      const generatedText = {
        topic: canonical,
        description: result.description ?? '',
        pro: result.pro ?? '',
        con: result.con ?? '',
        common: result.common ?? null,
      }
      const base = {
        ...result,
        ...generatedText,
        topicKey: key,
        customTopic: key ? null : value,
        english: generatedText,
        generated: !key && result.source === 'llm' ? { [language]: generatedText } : null,
      }
      const localized =
        result.source === 'llm' && !key ? base : localizeDebate(base, language, bundle)
      setDebate(localized)
      setTopic(localized.topic)
      setFlipped(false)
      setShowReflection(false)
      setMiniDismissed(false)
    } catch (error) {
      if (seq !== generateSeqRef.current) return
      setError(t('generateError', { message: error.message }, `Could not generate the debate: ${error.message}`))
    } finally {
      if (seq === generateSeqRef.current) setBusy(false)
    }
  }

  const handleSuggestion = (suggestion) => handleGenerate(null, suggestion)

  const handleReshuffle = () => setSuggestions(pickSuggestions())

  const handleFlip = () => {
    if (!debate) return
    stopPlayAll()
    voiceA.pause()
    voiceB.pause()
    setFlipped((value) => !value)
    setAutoPlayToken((value) => value + 1)
    setMiniDismissed(false)
    setShowReflection(true)
  }

  const handlePlayAll = () => {
    if (!debate) return
    if (playAll.active) {
      stopPlayAll()
      voiceA.pause()
      voiceB.pause()
      return
    }
    voiceA.pause()
    voiceB.pause()
    setMiniDismissed(false)
    armPlayAllWatchdog()
    setPlayAll({ active: true, stage: 'A' })
    voiceA.play()
  }

  const handleLanguageChange = async (next) => {
    if (next === language || busy) return
    const seq = ++languageSeqRef.current
    generateSeqRef.current += 1
    stopPlayAll()
    voiceA.pause()
    voiceB.pause()
    const nextBundle = await loadTranslation(next)
    if (seq !== languageSeqRef.current) return
    const key = findTopicKey(topic, language, bundle)
    const nextTopic = key ? localizedTopic(key, next, nextBundle) : topic
    setLanguage(next)
    setBundle(nextBundle)
    setTopic(nextTopic)
    setDebate((previous) => (previous ? localizeDebate(previous, next, nextBundle) : previous))
    setSuggestions(pickSuggestions())
    setShowReflection(false)
    setMiniDismissed(false)
    try {
      localStorage.setItem(LANGUAGE_KEY, next)
    } catch {
      // Language still changes for this session if storage is disabled.
    }
  }

  const handleSave = () => {
    if (!debate) return
    const entry = {
      id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
      topic: debate.topic,
      pro: debate.pro,
      con: debate.con,
      description: debate.description ?? '',
      common: debate.common ?? null,
      proPoints: debate.proPoints ?? null,
      conPoints: debate.conPoints ?? null,
      source: debate.source ?? 'curated',
      topicKey: debate.topicKey ?? null,
      customTopic: debate.customTopic ?? null,
      english: debate.english ?? null,
      generated: debate.generated ?? null,
      language,
      createdAt: new Date().toISOString(),
    }
    const next = [entry, ...saved].slice(0, 20)
    setSaved(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Storage can be disabled; the in-memory list still works.
    }
    setJustSaved(true)
    if (justSavedTimerRef.current) clearTimeout(justSavedTimerRef.current)
    justSavedTimerRef.current = setTimeout(() => setJustSaved(false), 1600)
  }

  useEffect(() => () => clearTimeout(justSavedTimerRef.current), [])

  const handleLoad = (item) => {
    const key = item.topicKey ?? findTopicKey(item.topic, language, bundle)
    const base = {
      ...item,
      topic: item.topic,
      topicKey: key,
      customTopic: item.customTopic ?? (key ? null : item.topic),
      english: item.english ?? null,
    }
    const localized =
      item.source === 'llm' && !key ? base : localizeDebate(base, language, bundle)
    setTopic(localized.topic)
    setDebate(localized)
    setFlipped(false)
    setShowReflection(false)
    setMiniDismissed(false)
    stopPlayAll()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleDelete = (id) => {
    const next = saved.filter((item) => item.id !== id)
    setSaved(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  const handleClearAll = () => {
    setSaved([])
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(saved, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `otherside-debates-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleReflectionChoice = (choice) => {
    if (!debate) return
    const key = debate.topicKey ?? debate.customTopic ?? debate.topic
    setReflections((previous) => {
      const next = { ...previous, [key]: choice }
      try {
        localStorage.setItem(REFLECTION_KEY, JSON.stringify(next))
      } catch {
        // keep in memory only
      }
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.defaultPrevented || !debate || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      const target = event.target
      const tag = target?.tagName?.toLowerCase()
      const interactive =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        tag === 'button' ||
        tag === 'a' ||
        target?.isContentEditable ||
        target?.getAttribute?.('role') === 'button' ||
        target?.hasAttribute?.('tabindex')

      // Escape still works with a button focused so focus mode is escapable.
      if (event.key === 'Escape' && focusMode) {
        setFocusMode(false)
        return
      }
      if (interactive) return

      if (event.code === 'Space' || event.key === ' ') {
        event.preventDefault()
        voiceARef.current?.toggle()
      } else if (event.key.toLowerCase() === 'b') {
        event.preventDefault()
        voiceBRef.current?.toggle()
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        handleFlip()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [debate, focusMode, handleFlip])

  const visibleSuggestions = localizedSuggestions(suggestions, language, bundle)
  const reflectionKey = debate?.topicKey ?? debate?.customTopic ?? debate?.topic
  const reflectionChoice = reflectionKey ? reflections[reflectionKey] : null
  const commonGround = debate?.common || t('commonGroundFallback', {}, EN_UI.commonGroundFallback)
  const commonLabel =
    debate && !debate.topicKey && debate.source === 'template'
      ? t('sharedStartingPoint', {}, EN_UI.sharedStartingPoint)
      : t('commonGround', {}, 'Common ground')
  const miniVisible =
    Boolean(debate) &&
    !miniDismissed &&
    (voiceA.isPlaying || voiceB.isPlaying || playAll.active || voiceA.progress > 0 || voiceB.progress > 0)

  const languageSelect = (compact = false) => (
    <LanguageSelect
      languages={LANGUAGES}
      value={language}
      onChange={handleLanguageChange}
      label={t('language', {}, 'Language')}
      compact={compact}
    />
  )

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-hidden bg-[#0b1020] pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-rose-300/40 to-transparent" />

        <div className="relative mx-auto max-w-6xl px-5 pb-20 pt-8 sm:px-8">
          {focusMode ? (
            <header className="glass-card flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fb7185] ring-1 ring-white/20">
                  <Mic2 className="h-5 w-5 text-slate-950" />
                </div>
                <p className="truncate text-sm font-semibold text-white" title={debate?.topic}>
                  {debate?.topic ?? 'OtherSide'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {languageSelect(true)}
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/10"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                  {t('exitFocus', {}, 'Exit focus')}
                </button>
              </div>
            </header>
          ) : (
            <header className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fb7185] ring-1 ring-white/20 shadow-lg">
                  <Mic2 className="h-6 w-6 text-slate-950" />
                </div>
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-white">
                    OtherSide
                  </h1>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    {t('tagline', {}, 'Civil discourse, out loud')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {languageSelect()}
                {debate && (
                  <button
                    type="button"
                    onClick={() => setFocusMode(true)}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10"
                  >
                    <Maximize2 className="h-4 w-4" />
                    {t('focusMode', {}, 'Focus mode')}
                  </button>
                )}
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                  {isElevenLabs
                    ? t('elevenReady', {}, 'ElevenLabs voices ready')
                    : t('demoMode', {}, 'Demo mode · browser voices')}
                </span>
              </div>
            </header>
          )}

          {!focusMode && (
            <section className="relative mt-16 max-w-4xl">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-rose-200/80">
                  <span className="inline-block h-px w-9 bg-rose-300/70" />
                  {t('tagline', {}, 'Civil discourse, out loud')}
                  <span className="ml-auto hidden text-slate-500 sm:inline">No. 01 / Listen first</span>
                </div>
                <h2 className="mt-6 font-display text-5xl font-normal leading-[0.95] tracking-tight text-[#f4f1ea] sm:text-7xl">
                  {t('heroTitleBefore', {}, 'One opinion.')}
                  <br />
                  <span className="accent-gradient">
                    {t('heroTitleHighlight', {}, 'Two sides, out loud.')}
                  </span>
                </h2>
                <div className="editorial-rule mt-7 max-w-xl" />
                <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-300/90">
                  {t('heroBody', {}, EN_UI.heroBody)}
                </p>
              </motion.div>

              <form onSubmit={handleGenerate} className="mt-8">
                <div className="glass-card rounded-[2rem] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      placeholder={t(
                        'opinionPlaceholder',
                        {},
                        'e.g. School uniforms should be mandatory.',
                      )}
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-slate-950/60 px-5 py-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-rose-300/40 focus:ring-2 focus:ring-rose-300/20"
                      aria-label={t('opinionLabel', {}, 'Opinion to debate')}
                    />
                    <button
                      type="submit"
                      disabled={busy || !topic.trim()}
                      className="flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#fb7185] px-7 py-4 font-display text-lg font-semibold text-[#160a10] shadow-[4px_4px_0_#7f1d1d] transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_#7f1d1d] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <>
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                          {t('thinking', {}, 'Thinking…')}
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5" />
                          {t('generate', {}, 'Generate debate')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>

              {error && (
                <div
                  role="alert"
                  className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
                >
                  {error}{' '}
                  <button
                    type="button"
                    onClick={() => handleGenerate(null, topic)}
                    className="font-semibold underline underline-offset-2"
                  >
                    {t('retry', {}, 'Retry')}
                  </button>
                </div>
              )}

              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-rose-300" />
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {t('controversial', {}, 'Controversial topics')}
                  </p>
                  <span className="text-[11px] text-slate-500">
                    {t('freshPicks', {}, 'fresh picks every refresh')}
                  </span>
                  <button
                    type="button"
                    onClick={handleReshuffle}
                    className="ml-auto flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-rose-300/25 hover:text-white"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('reshuffle', {}, 'Reshuffle topics')}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {visibleSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handleSuggestion(item)}
                      aria-label={`${t('debateReady', { topic: item }, `Debate: ${item}`)}`}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${
                        topic === item
                          ? 'border-rose-300/40 bg-rose-400/15 text-rose-200'
                          : 'border-white/10 bg-white/5 text-slate-400 hover:border-rose-300/25 hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          <div role="status" aria-live="polite" className="sr-only">
            {debate
              ? t('debateReady', { topic: debate.topic }, `Debate ready for ${debate.topic}`)
              : ''}
          </div>

          <AnimatePresence mode="wait">
            {debate && (
              <motion.div
                key={debate.topic}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className={`space-y-6 ${focusMode ? 'mt-6' : 'mt-14'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      {t('nowDiscussing', {}, 'Now discussing')}
                    </p>
                    <h3 className="mt-1 max-w-2xl break-words font-display text-xl font-semibold text-white [overflow-wrap:anywhere] sm:text-2xl">
                      “{debate.topic}”
                    </h3>
                    {debate.description && (
                      <div className="glass-card mt-4 max-w-2xl rounded-2xl p-4">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {t('whyDisagree', {}, 'Why people disagree')}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          {debate.description}
                        </p>
                      </div>
                    )}
                    {Array.isArray(debate.sources) && debate.sources.length > 0 && (
                      <div className="mt-3 max-w-2xl">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                          {t('sources', {}, EN_UI.sources)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1.5">
                          {debate.sources
                            .filter((source) => /^https?:\/\//i.test(source?.url ?? ''))
                            .slice(0, 6)
                            .map((source) => (
                              <a
                                key={source.url}
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={source.title}
                                className="max-w-full truncate text-xs text-cyan-300/80 underline decoration-cyan-300/30 underline-offset-2 hover:text-cyan-200"
                              >
                                {source.title}
                              </a>
                            ))}
                        </div>
                      </div>
                    )}
                    <p className="mt-3 max-w-2xl text-xs leading-5 text-slate-500">
                      {t('practiceDisclaimer', {}, EN_UI.practiceDisclaimer)}
                    </p>
                    <div className="mt-3 flex max-w-2xl items-start gap-2.5 rounded-2xl border border-emerald-300/15 bg-emerald-400/10 px-4 py-3">
                      <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                      <p className="text-sm leading-6 text-emerald-100/90">
                        <span className="font-semibold">{commonLabel}: </span>
                        {commonGround}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleFlip}
                      className="group flex items-center gap-2 rounded-2xl bg-[#8b5cf6] px-6 py-3.5 text-base font-bold text-white shadow-[5px_5px_0_#3b1d73] ring-1 ring-white/20 transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#3b1d73]"
                    >
                      <ArrowLeftRight className="h-4 w-4 transition group-hover:-rotate-180" />
                      {t('flip', {}, 'Flip perspective')}
                    </button>
                    <button
                      type="button"
                      onClick={handlePlayAll}
                      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                        playAll.active
                          ? 'border-rose-300/30 bg-rose-500/20 text-rose-100'
                          : 'border-white/10 bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      {playAll.active ? (
                        <Pause className="h-4 w-4 fill-current" />
                      ) : (
                        <Play className="h-4 w-4 fill-current" />
                      )}
                      {playAll.active
                        ? t('playBothStop', {}, 'Stop debate')
                        : t('playBoth', {}, 'Play whole debate')}
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                    >
                      {justSaved ? (
                        <BookmarkCheck className="h-4 w-4 text-emerald-300" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      {justSaved ? t('saved', {}, 'Saved') : t('save', {}, 'Save debate')}
                    </button>
                  </div>
                </div>

                <p className="text-center text-xs text-slate-400">
                  {t('flipHint', {}, 'Flips sides and replays Voice A.')}{' '}
                  {t('keyboardHint', {}, EN_UI.keyboardHint)}
                </p>

                <div className="grid gap-5 lg:grid-cols-2">
                  <VoiceCard
                    side="A"
                    stance={t(flipped ? 'con' : 'pro', {}, flipped ? 'Con' : 'Pro')}
                    voiceName={voiceA.voiceName}
                    text={sideAArgument}
                    player={voiceA}
                    delay={0}
                    voiceOptions={voiceOptions('A')}
                    selectedVoice={selectedVoice('A')}
                    onVoiceChange={(value) => handleVoiceChange('A', value)}
                    onPreview={() => handlePreview('A')}
                    previewing={previewing}
                    previewLabel={
                      isElevenLabs
                        ? undefined
                        : t('previewBrowserVoice', {}, EN_UI.previewBrowserVoice)
                    }
                    voiceNote={
                      isElevenLabs ? null : t('voiceRequiresKey', {}, EN_UI.voiceRequiresKey)
                    }
                    t={t}
                  />
                  <VoiceCard
                    side="B"
                    stance={t(flipped ? 'pro' : 'con', {}, flipped ? 'Pro' : 'Con')}
                    voiceName={voiceB.voiceName}
                    text={sideBArgument}
                    player={voiceB}
                    delay={0.12}
                    voiceOptions={voiceOptions('B')}
                    selectedVoice={selectedVoice('B')}
                    onVoiceChange={(value) => handleVoiceChange('B', value)}
                    onPreview={() => handlePreview('B')}
                    previewing={previewing}
                    previewLabel={
                      isElevenLabs
                        ? undefined
                        : t('previewBrowserVoice', {}, EN_UI.previewBrowserVoice)
                    }
                    voiceNote={
                      isElevenLabs ? null : t('voiceRequiresKey', {}, EN_UI.voiceRequiresKey)
                    }
                    t={t}
                  />
                </div>

                <ReflectionPrompt
                  visible={showReflection}
                  choice={reflectionChoice}
                  saved={Boolean(reflectionChoice)}
                  onChoose={handleReflectionChoice}
                  t={t}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {focusMode && debate && (
            <p className="mt-6 text-center text-[11px] text-slate-500">
              {t('keyboardHint', {}, EN_UI.keyboardHint)}
            </p>
          )}

          {!focusMode && (
            <div className="mt-14 space-y-6">
              <WhyThisMatters t={t} />
              <SavedDebates
                items={saved}
                onLoad={handleLoad}
                onDelete={handleDelete}
                onClearAll={handleClearAll}
                onExport={handleExport}
                language={language}
                t={t}
              />
            </div>
          )}

          {!focusMode && (
            <footer className="mt-12 text-center text-xs text-slate-500">
              {t('footer', {}, EN_UI.footer)}
            </footer>
          )}
        </div>

        <MiniPlayer
          visible={miniVisible}
          topic={debate?.topic ?? ''}
          voiceA={voiceA}
          voiceB={voiceB}
          playAll={playAll}
          flipped={flipped}
          t={t}
          onFlip={handleFlip}
          onClose={() => setMiniDismissed(true)}
        />
      </div>
    </MotionConfig>
  )
}

